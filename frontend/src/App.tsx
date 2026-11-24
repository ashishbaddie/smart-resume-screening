import { useEffect, useState } from "react";
import { previewJobProfile } from "./api";
import Header from "./components/Header";
import type { View } from "./components/Header";
import HowScoring from "./components/HowScoring";
import ResultsView from "./components/Results";
import Running from "./components/Running";
import { ActionBar, JobDescriptionCard, ResumeCard, ScoringExplainer } from "./components/Setup";
import { Alert } from "./components/ui";
import { useAnalysis } from "./hooks/useAnalysis";
import { useElapsed, useTheme } from "./hooks/hooks";
import type { JobProfile } from "./types";

export default function App() {
  const [mode, setMode] = useState<"text" | "pdf">("text");
  const [jdText, setJdText] = useState("");
  const [jdFile, setJdFile] = useState<File | null>(null);
  const [resumes, setResumes] = useState<File[]>([]);

  const [profile, setProfile] = useState<JobProfile | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [helpOpen, setHelpOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const analysis = useAnalysis();

  const results = analysis.job?.results ?? [];
  const busy = analysis.phase === "starting" || analysis.phase === "running";
  const view: View = busy ? "running" : analysis.phase === "done" && results.length > 0 && analysis.jobId ? "results" : "setup";
  const elapsed = useElapsed(busy);
  const hasJd = mode === "text" ? jdText.trim().length > 0 : jdFile !== null;

  useEffect(() => { window.scrollTo({ top: 0 }); }, [view]);

  // Any change to the job description makes the previewed skills out of date.
  const clearPreview = () => { setProfile(null); setPreviewError(null); };

  const preview = async () => {
    setPreviewing(true);
    setPreviewError(null);
    try {
      setProfile(await previewJobProfile(mode === "text" ? jdText : "", mode === "pdf" ? jdFile : null));
    } catch (err) {
      setProfile(null);
      setPreviewError(err instanceof Error ? err.message : "Could not extract skills.");
    } finally {
      setPreviewing(false);
    }
  };

  const start = () => analysis.start(mode === "text" ? jdText : "", mode === "pdf" ? jdFile : null, resumes);

  return (
    <div className="min-h-screen">
      <Header view={view} theme={theme} onToggleTheme={toggleTheme} onHelp={() => setHelpOpen(true)} onNew={analysis.reset} />

      <main className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 sm:pt-10">
        {view === "running" && <Running completed={analysis.job?.completed ?? 0} total={analysis.total} elapsed={elapsed} />}

        {view === "results" && analysis.job && analysis.jobId && (
          <ResultsView
            job={analysis.job} results={results} jobId={analysis.jobId}
            skipped={analysis.skipped} failed={analysis.job.failed} onSummary={analysis.setSummary}
          />
        )}

        {view === "setup" && (
          <div className="animate-rise">
            <div className="mb-8 max-w-2xl">
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Find the best-fit candidates, faster.</h1>
              <p className="mt-3 text-base leading-relaxed text-muted">
                Add a job description and your resumes. Each candidate is scored on meaning, evidence-backed skills and
                experience, and every number is explained.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
              <JobDescriptionCard
                mode={mode} onMode={(m) => { setMode(m); clearPreview(); }}
                text={jdText} onText={(t) => { setJdText(t); clearPreview(); }}
                file={jdFile} onFile={(f) => { setJdFile(f); clearPreview(); }}
                profile={profile} previewing={previewing} previewError={previewError}
                canPreview={hasJd} onPreview={preview}
              />
              <ResumeCard files={resumes} onFiles={setResumes} />
            </div>

            <div className="mt-6"><ScoringExplainer /></div>

            {analysis.phase === "failed" && analysis.error && (
              <div className="mt-6"><Alert tone="error">{analysis.error}</Alert></div>
            )}
            <div className="mt-6"><ActionBar hasJd={hasJd} resumeCount={resumes.length} onStart={start} /></div>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-7xl px-4 pb-10 text-center text-xs text-muted sm:px-6">
        Built by <b className="text-ink-2">Ashish Kumar Pal</b>. Scores are decision-support signals; final hiring decisions stay with people.
      </footer>

      <HowScoring open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
