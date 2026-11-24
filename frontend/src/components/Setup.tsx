import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { ArrowRight, Brain, Briefcase, Check, FileText, Sparkles, Target, Trash2, Upload, X } from "lucide-react";
import { cn } from "../lib/cn";
import { formatBytes } from "../lib/format";
import type { JobProfile } from "../types";
import { Alert, Button, Card, CardHeader, ChipList, Segmented, SkillChip } from "./ui";

export const MAX_RESUMES = 25;
export const MAX_MB = 10;

const isPdf = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

// ------------------------------------------------------------------ drop zone

function DropZone({
  multiple, onFiles, label, title, hint, compact, grow,
}: { multiple: boolean; onFiles: (files: File[]) => void; label: string; title: string; hint: string; compact?: boolean; grow?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    onFiles(Array.from(event.dataTransfer.files));
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition",
        compact ? "gap-2 px-4 py-6" : "gap-3 px-6 py-10",
        grow && "h-full min-h-[240px]",
        over ? "border-brand bg-brand-soft" : "border-line-strong bg-surface-2 hover:border-brand/60",
      )}
    >
      <span className={cn("grid place-items-center rounded-full bg-brand-soft text-brand", compact ? "h-10 w-10" : "h-12 w-12")} aria-hidden>
        <Upload className={compact ? "h-5 w-5" : "h-6 w-6"} />
      </span>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] text-muted">{hint}</p>
      </div>
      <Button type="button" size="sm" onClick={() => input.current?.click()}>Browse files</Button>
      <input
        ref={input} type="file" accept="application/pdf,.pdf" multiple={multiple} className="sr-only" aria-label={label}
        onChange={(e) => { onFiles(Array.from(e.target.files ?? [])); e.target.value = ""; }}
      />
    </div>
  );
}

function FileRow({ file, onRemove }: { file: File; onRemove: () => void }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-bad-soft text-bad" aria-hidden><FileText className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{file.name}</span>
        <span className="tnum block font-mono text-xs text-muted">{formatBytes(file.size)}</span>
      </span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`} className="rounded-lg p-1.5 text-muted transition hover:bg-bad-soft hover:text-bad">
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

// ------------------------------------------------------------------ job description

export interface JdProps {
  mode: "text" | "pdf";
  onMode: (mode: "text" | "pdf") => void;
  text: string;
  onText: (text: string) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  profile: JobProfile | null;
  previewing: boolean;
  previewError: string | null;
  canPreview: boolean;
  onPreview: () => void;
}

export function JobDescriptionCard(p: JdProps) {
  const [fileError, setFileError] = useState<string | null>(null);

  const acceptJdFile = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!isPdf(file)) return setFileError("Please choose a PDF file.");
    if (file.size > MAX_MB * 1024 * 1024) return setFileError(`File is larger than ${MAX_MB} MB.`);
    setFileError(null);
    p.onFile(file);
  };

  const words = p.text.trim() ? p.text.trim().split(/\s+/).length : 0;
  const profile = p.profile;

  return (
    <Card className="p-5 sm:p-6">
      <CardHeader
        icon={FileText} title="Job description" subtitle="The role every resume is scored against."
        right={
          <Segmented
            label="Choose Job Description Input Method" size="sm" value={p.mode} onChange={p.onMode}
            options={[{ value: "text", label: "Paste text" }, { value: "pdf", label: "Upload PDF" }]}
          />
        }
      />

      <div className="mt-5">
        {p.mode === "text" ? (
          <div>
            <textarea
              value={p.text} onChange={(e) => p.onText(e.target.value)} rows={11}
              aria-label="Paste Job Description" placeholder="Paste the full job description here…"
              className="thin-scroll w-full resize-y rounded-xl border border-line-strong bg-surface p-4 text-sm leading-relaxed placeholder:text-muted-faint focus:border-brand"
            />
            <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
              <span className="tnum font-mono">{words} words</span>
              {p.text && (
                <button type="button" onClick={() => p.onText("")} className="inline-flex items-center gap-1 font-semibold hover:text-ink">
                  <Trash2 className="h-3 w-3" aria-hidden /> Clear
                </button>
              )}
            </div>
          </div>
        ) : p.file ? (
          <ul><FileRow file={p.file} onRemove={() => p.onFile(null)} /></ul>
        ) : (
          <DropZone multiple={false} compact onFiles={acceptJdFile} label="Upload Job Description PDF" title="Drop the job description PDF here" hint={`PDF up to ${MAX_MB} MB`} />
        )}
        {fileError && <div className="mt-3"><Alert tone="error">{fileError}</Alert></div>}
      </div>

      <div className="mt-5 rounded-xl border border-line bg-surface-2 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Check the skills first</p>
            <p className="text-[13px] text-muted">Optional. See what will be scored before you analyze.</p>
          </div>
          <Button size="sm" icon={Sparkles} loading={p.previewing} disabled={!p.canPreview} onClick={p.onPreview}>
            {p.previewing ? "Extracting…" : "Preview required skills"}
          </Button>
        </div>
        {p.previewError && <div className="mt-3"><Alert tone="error">{p.previewError}</Alert></div>}

        {profile && (
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            {(profile.job_title || profile.minimum_experience_years !== null || profile.required_education) && (
              <dl className="flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                {profile.job_title && <div><dt className="text-muted">Role</dt><dd className="font-semibold">{profile.job_title}</dd></div>}
                {profile.minimum_experience_years !== null && <div><dt className="text-muted">Minimum experience</dt><dd className="tnum font-semibold">{profile.minimum_experience_years}+ years</dd></div>}
                {profile.required_education && <div><dt className="text-muted">Education</dt><dd className="font-semibold">{profile.required_education}</dd></div>}
              </dl>
            )}
            {profile.required_skills.length > 0 ? (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Required skills · {profile.required_skills.length}</h3>
                <ChipList>{profile.required_skills.map((s) => <SkillChip key={s} label={s} state="neutral" />)}</ChipList>
                {profile.used_skills_fallback && <p className="mt-2 text-xs text-muted">No skills were found by the AI, so the skills.txt list was used.</p>}
              </div>
            ) : (
              <Alert>No technical skills were detected in the Job Description.</Alert>
            )}
            {profile.preferred_skills.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Preferred skills · {profile.preferred_skills.length}</h3>
                <ChipList>{profile.preferred_skills.map((s) => <SkillChip key={s} label={s} state="preferred-tag" />)}</ChipList>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------ resumes

export function ResumeCard({ files, onFiles }: { files: File[]; onFiles: (files: File[]) => void }) {
  const [message, setMessage] = useState<string | null>(null);

  const add = (incoming: File[]) => {
    const problems: string[] = [];
    const next = [...files];
    for (const file of incoming) {
      if (!isPdf(file)) { problems.push(`${file.name} is not a PDF.`); continue; }
      if (file.size > MAX_MB * 1024 * 1024) { problems.push(`${file.name} is larger than ${MAX_MB} MB.`); continue; }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      if (next.length >= MAX_RESUMES) { problems.push(`Only ${MAX_RESUMES} resumes can be analyzed at once.`); break; }
      next.push(file);
    }
    setMessage(problems.length ? problems.join(" ") : null);
    onFiles(next);
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <CardHeader icon={Upload} title="Resumes" subtitle={`PDF files, up to ${MAX_RESUMES} at a time.`} />
      <div className={cn("mt-5", files.length === 0 && "flex-1")}>
        <DropZone multiple grow={files.length === 0} onFiles={add} label="Upload One or More PDF Resumes" title="Drop resumes here" hint={`PDF up to ${MAX_MB} MB each`} />
        {message && <div className="mt-3"><Alert tone="warn">{message}</Alert></div>}
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">
              <span className="tnum font-mono">{files.length}</span> resume{files.length === 1 ? "" : "s"} ready
              <span className="tnum ml-2 font-mono text-xs font-normal text-muted">{formatBytes(totalSize)}</span>
            </p>
            <button type="button" onClick={() => { onFiles([]); setMessage(null); }} className="text-xs font-semibold text-muted hover:text-ink">Clear all</button>
          </div>
          <ul className="thin-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
            {files.map((file) => (
              <FileRow key={`${file.name}-${file.size}`} file={file} onRemove={() => onFiles(files.filter((f) => f !== file))} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------ explainer + action bar

export function ScoringExplainer() {
  const items = [
    { icon: Brain, weight: "30%", title: "Semantic match", text: "Compares the meaning of each resume with the job description." },
    { icon: Target, weight: "50%", title: "Skills match", text: "Every skill is checked against evidence in the resume, not just keywords." },
    { icon: Briefcase, weight: "20%", title: "Experience", text: "Counts dated employment only. Projects do not count as experience." },
  ];
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {items.map(({ icon: Icon, weight, title, text }) => (
        <li key={title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-brand-soft text-brand" aria-hidden><Icon className="h-[18px] w-[18px]" /></span>
            <span className="tnum font-mono text-xl font-bold text-ink">{weight}</span>
          </div>
          <h3 className="mt-3 text-sm font-bold">{title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{text}</p>
        </li>
      ))}
    </ul>
  );
}

function Requirement({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", done ? "text-ink" : "text-muted")}>
      <span className={cn("grid h-5 w-5 place-items-center rounded-full", done ? "bg-brand text-brand-on" : "bg-surface-2 ring-1 ring-line-strong")} aria-hidden>
        {done && <Check className="h-3 w-3" />}
      </span>
      {label}
    </span>
  );
}

export function ActionBar({ hasJd, resumeCount, onStart }: { hasJd: boolean; resumeCount: number; onStart: () => void }) {
  const ready = hasJd && resumeCount > 0;
  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/90 px-5 py-3.5 shadow-pop backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Requirement done={hasJd} label="Job description" />
        <Requirement done={resumeCount > 0} label={resumeCount > 0 ? `${resumeCount} resume${resumeCount === 1 ? "" : "s"}` : "Resumes"} />
      </div>
      <div className="flex items-center gap-3">
        {!ready && <span className="hidden text-[13px] text-muted sm:inline">{!hasJd ? "Add a job description to continue" : "Add at least one resume to continue"}</span>}
        <Button variant="primary" size="lg" disabled={!ready} onClick={onStart}>
          Analyze resumes <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
