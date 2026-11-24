import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Grid3x3, ListOrdered } from "lucide-react";
import { exportUrl } from "../api";
import { useEscape, useMediaQuery } from "../hooks/hooks";
import { cn } from "../lib/cn";
import { DECISIONS, decisionTone, pct, TONE } from "../lib/format";
import type { Candidate, Decision, FailedCandidate, Job, SkippedFile } from "../types";
import CandidateDetail from "./CandidateDetail";
import CandidateList from "./CandidateList";
import SkillsMatrix from "./SkillsMatrix";
import { Alert, ButtonLink, Card, Segmented } from "./ui";

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="min-w-0 p-3 sm:p-5">
      <div className="truncate text-[10px] font-bold uppercase tracking-wider text-muted sm:text-xs">{label}</div>
      <div className="tnum mt-1.5 font-mono text-xl font-bold tracking-tight sm:mt-2 sm:text-3xl">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted sm:mt-1 sm:text-[13px]">{sub}</div>
    </Card>
  );
}

function Distribution({ results, filter, onFilter }: { results: Candidate[]; filter: Decision | null; onFilter: (d: Decision | null) => void }) {
  const counts = DECISIONS.map((d) => ({ decision: d, count: results.filter((c) => c.decision === d).length }));
  return (
    <Card className="col-span-3 p-5 xl:col-span-1">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-muted">Decisions</div>
        {filter && <button type="button" onClick={() => onFilter(null)} className="text-xs font-semibold text-brand hover:underline">Clear filter</button>}
      </div>
      <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-line" role="img" aria-label="Candidates by decision">
        {counts.filter((c) => c.count > 0).map(({ decision, count }) => (
          <div key={decision} className={cn("h-full transition-opacity", TONE[decisionTone(decision)].bar, filter && filter !== decision && "opacity-25")} style={{ width: `${(count / results.length) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
        {counts.map(({ decision, count }) => {
          const active = filter === decision;
          return (
            <button
              key={decision} type="button" aria-pressed={active} disabled={count === 0} onClick={() => onFilter(active ? null : decision)}
              className={cn("flex items-center justify-between rounded-lg px-2 py-1.5 text-[13px] font-semibold transition disabled:opacity-40", active ? "bg-surface-2 ring-1 ring-line-strong" : "hover:bg-surface-2")}
            >
              <span className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", TONE[decisionTone(decision)].dot)} aria-hidden />{decision}</span>
              <span className="tnum font-mono">{count}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

interface Props {
  job: Job;
  results: Candidate[];
  jobId: string;
  skipped: SkippedFile[];
  failed: FailedCandidate[];
  onSummary: (id: string, text: string) => void;
}

export default function ResultsView({ job, results, jobId, skipped, failed, onSummary }: Props) {
  const [view, setView] = useState<"ranking" | "matrix">("ranking");
  const [selectedId, setSelectedId] = useState(results[0].candidate_id);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Decision | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const selected = results.find((c) => c.candidate_id === selectedId) ?? results[0];
  const visible = useMemo(
    () => results.filter((c) => (!filter || c.decision === filter) && c.candidate_name.toLowerCase().includes(query.trim().toLowerCase())),
    [results, filter, query],
  );

  const select = (id: string) => {
    setSelectedId(id);
    if (!isDesktop) setSheetOpen(true);
  };
  const closeSheet = () => setSheetOpen(false);
  useEscape(sheetOpen && !isDesktop, closeSheet);

  const scores = results.map((c) => c.final_score);
  const top = results.reduce((best, c) => (c.final_score > best.final_score ? c : best), results[0]);
  const title = job.job_profile.job_title ?? "Candidate ranking";

  return (
    <div className="animate-rise">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-brand">Results</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted">
            <span className="tnum font-mono">{results.length}</span> candidate{results.length === 1 ? "" : "s"} ranked against this role
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="Results view" value={view} onChange={setView}
            options={[{ value: "ranking", label: "Ranking", icon: ListOrdered }, { value: "matrix", label: "Skills matrix", icon: Grid3x3 }]}
          />
          <ButtonLink icon={Download} href={exportUrl(jobId)} download="candidate_ranking.csv">Export CSV</ButtonLink>
        </div>
      </div>

      {(skipped.length > 0 || failed.length > 0) && (
        <div className="mb-5 space-y-3">
          {skipped.length > 0 && (
            <Alert tone="warn">
              <b>Skipped files</b>
              <ul className="mt-1 list-disc pl-4">{skipped.map((s) => <li key={s.filename}>{s.filename}: {s.reason}</li>)}</ul>
            </Alert>
          )}
          {failed.length > 0 && (
            <Alert tone="warn">
              <b>Could not analyze</b>
              <ul className="mt-1 list-disc pl-4">{failed.map((f) => <li key={f.candidate_id}>{f.candidate_name}: {f.error}</li>)}</ul>
            </Alert>
          )}
        </div>
      )}

      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4 xl:grid-cols-[1fr_1fr_1fr_1.5fr]">
        <Stat label="Candidates" value={String(results.length)} sub="analyzed" />
        <Stat label="Top match" value={pct(top.final_score)} sub={top.candidate_name} />
        <Stat label="Average" value={pct(scores.reduce((a, b) => a + b, 0) / scores.length)} sub="score overall" />
        <Distribution results={results} filter={filter} onFilter={setFilter} />
      </div>

      {view === "matrix" ? (
        <SkillsMatrix candidates={visible} onSelect={(id) => { setView("ranking"); select(id); }} />
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,400px)_minmax(0,1fr)]">
          <div className="lg:sticky lg:top-20">
            <CandidateList candidates={visible} selectedId={selected.candidate_id} query={query} onQuery={setQuery} onSelect={select} totalCount={results.length} />
          </div>
          {isDesktop && <CandidateDetail candidate={selected} total={results.length} jobId={jobId} onSummary={onSummary} />}
        </div>
      )}

      {/* Rendered in a portal so it sits above the sticky header (an animated ancestor creates its own stacking context). */}
      {!isDesktop && sheetOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto bg-bg p-4 animate-rise" role="dialog" aria-modal="true" aria-label={`${selected.candidate_name} details`}>
          <CandidateDetail candidate={selected} total={results.length} jobId={jobId} onSummary={onSummary} onBack={closeSheet} />
        </div>,
        document.body,
      )}
    </div>
  );
}
