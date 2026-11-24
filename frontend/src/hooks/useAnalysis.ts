import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, deleteJob, getJob, startAnalysis } from "../api";
import type { Job, SkippedFile } from "../types";
import { DEMO_JOB, DEMO_MODE } from "../demo";

export type Phase = "idle" | "starting" | "running" | "done" | "failed";

interface State {
  phase: Phase;
  job: Job | null;
  total: number;
  error: string | null;
  skipped: SkippedFile[];
}

const INITIAL: State = { phase: "idle", job: null, total: 0, error: null, skipped: [] };
const POLL_MS = 1500;
const MAX_POLL_ERRORS = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Starts an analysis job on the API and polls it until it finishes. */
export function useAnalysis() {
  const [state, setState] = useState<State>(INITIAL);
  const runId = useRef(0); // bumps on every start/reset so old polling loops stop
  const jobId = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const cancelPolling = useCallback(() => {
    runId.current += 1;
    controller.current?.abort();
    controller.current = null;
  }, []);

  useEffect(() => () => cancelPolling(), [cancelPolling]);

  const poll = useCallback(async (id: string, myRun: number) => {
    let errors = 0;
    controller.current = new AbortController();
    const signal = controller.current.signal;

    while (runId.current === myRun) {
      try {
        const job = await getJob(id, signal);
        if (runId.current !== myRun) return;
        if (job.status === "done") {
          setState((s) => ({ ...s, phase: "done", job, total: job.total }));
          return;
        }
        if (job.status === "failed") {
          setState((s) => ({
            ...s, phase: "failed", job, total: job.total,
            error: job.error ?? "The analysis failed.",
          }));
          return;
        }
        setState((s) => ({ ...s, phase: "running", job, total: job.total }));
        errors = 0;
      } catch (err) {
        if (signal.aborted || runId.current !== myRun) return;
        errors += 1;
        const expired = err instanceof ApiError && err.status === 404;
        if (expired || errors >= MAX_POLL_ERRORS) {
          setState((s) => ({
            ...s, phase: "failed",
            error: expired ? "This analysis expired. Please run it again." : "Lost connection to the server.",
          }));
          return;
        }
      }
      await sleep(POLL_MS);
    }
  }, []);

  const start = useCallback(
    async (text: string, jdFile: File | null, resumes: File[]) => {
      cancelPolling();
      if (jobId.current) void deleteJob(jobId.current);
      jobId.current = null;
      const myRun = runId.current;
      setState({ ...INITIAL, phase: "starting" });
      if (DEMO_MODE) {
        setState({
          ...INITIAL,
          phase: "running",
          total: DEMO_JOB.total,
          skipped: DEMO_JOB.skipped,
        });
        await sleep(900);
        if (runId.current !== myRun) return;
        setState({
          ...INITIAL,
          phase: "done",
          job: DEMO_JOB,
          total: DEMO_JOB.total,
          skipped: DEMO_JOB.skipped,
        });
        jobId.current = DEMO_JOB.job_id;
        return;
      }
      try {
        const accepted = await startAnalysis(text, jdFile, resumes);
        if (runId.current !== myRun) return;
        jobId.current = accepted.job_id;
        setState({ ...INITIAL, phase: "running", total: accepted.total, skipped: accepted.skipped });
        void poll(accepted.job_id, myRun);
      } catch (err) {
        if (runId.current !== myRun) return;
        setState({
          ...INITIAL, phase: "failed",
          error: err instanceof Error ? err.message : "Something went wrong.",
        });
      }
    },
    [cancelPolling, poll],
  );

  /** Clear the results and remove the resume text from the server's memory. */
  const reset = useCallback(() => {
    cancelPolling();
    if (jobId.current) void deleteJob(jobId.current);
    jobId.current = null;
    setState(INITIAL);
  }, [cancelPolling]);

  /** Store a summary that was just generated so the card keeps it. */
  const setSummary = useCallback((candidateId: string, summary: string) => {
    setState((s) =>
      s.job
        ? {
            ...s,
            job: {
              ...s.job,
              results: s.job.results.map((c) =>
                c.candidate_id === candidateId ? { ...c, candidate_summary: summary } : c,
              ),
            },
          }
        : s,
    );
  }, []);

  return { ...state, jobId: state.job?.job_id ?? jobId.current, start, reset, setSummary };
}
