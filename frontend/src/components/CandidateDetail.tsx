import { useState } from "react";
import { Briefcase, ChevronLeft, GraduationCap, ListChecks, Sparkles, Target } from "lucide-react";
import { ApiError, generateSummary } from "../api";
import { cn } from "../lib/cn";
import { decisionTone, pct, scoreTone, TONE } from "../lib/format";
import { scoreComposition } from "../lib/score";
import type { Candidate, SkillGroup } from "../types";
import { Avatar, Button, Card, CardHeader, ChipList, DecisionBadge, ProgressBar, ScoreRing, SkillChip } from "./ui";

const SERIES: Record<string, string> = { semantic: "bg-info", skills: "bg-brand", experience: "bg-warn" };

function Groups({ matched, missing }: { matched: SkillGroup[]; missing: SkillGroup[] }) {
  if (matched.length + missing.length === 0) return null;
  return (
    <div className="mt-3 space-y-2">
      {matched.map((g, i) => (
        <p key={`m${i}`} className="rounded-lg border border-good/25 bg-good-soft px-3 py-2 text-[13px]">
          ✓ Satisfied: {g.alternatives.join(" OR ")} (matched: {(g.matched_alternatives ?? []).join(", ")})
        </p>
      ))}
      {missing.map((g, i) => (
        <p key={`x${i}`} className="rounded-lg border border-bad/25 bg-bad-soft px-3 py-2 text-[13px]">✗ Not satisfied: {g.alternatives.join(" OR ")}</p>
      ))}
    </div>
  );
}

function SummaryCard({ candidate, jobId, onSummary }: { candidate: Candidate; jobId: string; onSummary: (id: string, text: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      onSummary(candidate.candidate_id, await generateSummary(jobId, candidate.candidate_id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Candidate summary is temporarily unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <CardHeader icon={Sparkles} title="AI summary" subtitle="Written from the resume only. It never changes the score." />
      <div className="mt-4">
        {candidate.candidate_summary ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{candidate.candidate_summary}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" size="sm" icon={Sparkles} loading={loading} onClick={generate}>Generate AI Summary</Button>
            <span className="text-[13px] text-muted">{loading ? "Reading the resume…" : "No summary generated yet."}</span>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-medium text-bad">{error}</p>}
      </div>
    </Card>
  );
}

function ScoreCard({ c }: { c: Candidate }) {
  const comp = scoreComposition(c);
  return (
    <Card className="p-5">
      <CardHeader icon={Target} title="How the score is built" subtitle="Each part's weight times its score, in points out of 100." />
      <div className="mt-5">
        {comp.consistent ? (
          <>
            <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`Final score ${c.final_score.toFixed(1)} out of 100`}>
              {comp.parts.map((p) => (
                <div key={p.key} className={cn("h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-700", SERIES[p.key])} style={{ width: `${Math.max(p.points, 0)}%` }} />
              ))}
            </div>
            <ul className="mt-4 divide-y divide-line text-sm">
              {comp.parts.map((p) => (
                <li key={p.key} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-2.5">
                  <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-semibold">
                    <span className="flex items-center gap-2.5">
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", SERIES[p.key])} aria-hidden />
                      {p.label}
                    </span>
                    <span className="tnum whitespace-nowrap rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-muted ring-1 ring-line">
                      {Math.round(p.weight * 100)}%<span className="hidden sm:inline"> weight</span>
                    </span>
                  </span>
                  <span className="tnum hidden w-14 text-right font-mono text-muted sm:block" aria-label={`score ${p.score.toFixed(1)}`}>{p.score.toFixed(1)}</span>
                  <span className="tnum w-16 text-right font-mono font-bold">+{p.points.toFixed(1)}</span>
                </li>
              ))}
              <li className="grid grid-cols-[1fr_auto] items-center gap-4 pt-3 font-bold">
                <span>Final score</span>
                <span className="tnum font-mono text-base">{c.final_score.toFixed(1)}</span>
              </li>
            </ul>
            {comp.rescaled && (
              <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs leading-relaxed text-muted">
                Experience could not be determined, so it was left out and the other weights were scaled up to fill 100.
              </p>
            )}
          </>
        ) : (
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Semantic similarity</dt><dd className="tnum font-mono font-bold">{pct(c.jd_similarity_score)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Skills match</dt><dd className="tnum font-mono font-bold">{pct(c.skills_match_score)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Experience</dt><dd className="tnum font-mono font-bold">{c.experience_match_score === null ? "N/A" : pct(c.experience_match_score)}</dd></div>
          </dl>
        )}
      </div>
    </Card>
  );
}

function SkillsCard({ c }: { c: Candidate }) {
  const requiredTotal = c.required_skills.length;
  const requiredMatched = c.matched_skills.length;
  const preferredTotal = c.preferred_skills.length + c.matched_preferred_groups.length + c.missing_preferred_groups.length;
  const preferredMatched = c.matched_preferred_skills.length + c.matched_preferred_groups.length;

  return (
    <Card className="p-5">
      <CardHeader icon={ListChecks} title="Skills" subtitle="Each skill is matched against evidence in the resume." />

      <div className="mt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold">Required skills</h3>
          <span className="tnum font-mono text-sm text-muted"><b className="text-ink">{requiredMatched}</b> / {requiredTotal} matched</span>
        </div>
        <ProgressBar value={requiredTotal ? (requiredMatched / requiredTotal) * 100 : 0} tone={scoreTone(c.required_skills_score ?? 0)} className="mb-3" />
        {requiredTotal === 0 ? (
          <p className="text-[13px] text-muted">No required skills were extracted from the job description.</p>
        ) : (
          <ChipList>
            {[
              ...c.matched_skills.map((s) => <SkillChip key={`m-${s}`} label={s} state="matched" />),
              ...c.missing_skills.map((s) => <SkillChip key={`x-${s}`} label={s} state="missing" />),
            ]}
          </ChipList>
        )}
        <Groups matched={c.matched_required_groups} missing={c.missing_required_groups} />
        {c.missing_skills.length > 0 && (
          <p className="mt-2 text-xs text-muted">Missing means no evidence was found in the resume. It does not prove the candidate lacks the skill.</p>
        )}
      </div>

      <div className="mt-6 border-t border-line pt-5">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-sm font-bold">Preferred skills</h3>
          {preferredTotal > 0 && <span className="tnum font-mono text-sm text-muted"><b className="text-ink">{preferredMatched}</b> / {preferredTotal} matched</span>}
        </div>
        {preferredTotal === 0 ? (
          <p className="text-[13px] text-muted">No preferred requirements were identified.</p>
        ) : (
          <>
            <ProgressBar value={(preferredMatched / preferredTotal) * 100} tone="info" className="mb-3" />
            <ChipList>
              {[
                ...c.matched_preferred_skills.map((s) => <SkillChip key={`pm-${s}`} label={s} state="preferred" />),
                ...c.missing_preferred_skills.map((s) => <SkillChip key={`px-${s}`} label={s} state="preferred-missing" />),
              ]}
            </ChipList>
            <Groups matched={c.matched_preferred_groups} missing={c.missing_preferred_groups} />
          </>
        )}
      </div>
    </Card>
  );
}

function BackgroundCard({ c }: { c: Candidate }) {
  return (
    <Card className="p-5">
      <CardHeader icon={Briefcase} title="Background" subtitle="Dated employment only. Projects are not counted as experience." />
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted"><Briefcase className="h-3.5 w-3.5" aria-hidden />Experience</dt>
          <dd className="mt-2">
            {c.candidate_experience_years !== null ? (
              <p className="tnum font-mono text-2xl font-bold">{c.candidate_experience_years}<span className="ml-1 text-sm font-semibold text-muted">years</span></p>
            ) : (
              <p className="text-sm font-semibold">Could not be determined</p>
            )}
            <p className="mt-1 text-[13px] text-muted">
              {c.required_experience_years !== null ? `Required: ${c.required_experience_years}+ years` : "No minimum stated"}
              {c.experience_match_score !== null && <> · match <b className="tnum font-mono text-ink">{pct(c.experience_match_score)}</b></>}
            </p>
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted"><GraduationCap className="h-3.5 w-3.5" aria-hidden />Education</dt>
          <dd className="mt-2">
            <p className="text-sm font-semibold">{c.candidate_education ?? "Not identified"}</p>
            {c.education_in_progress.length > 0 && <p className="mt-1 text-[13px] text-muted">In progress: {c.education_in_progress.join(", ")}</p>}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

interface Props {
  candidate: Candidate;
  total: number;
  jobId: string;
  onSummary: (id: string, text: string) => void;
  onBack?: () => void;
}

export default function CandidateDetail({ candidate: c, total, jobId, onSummary, onBack }: Props) {
  const tone = decisionTone(c.decision);
  return (
    <div className="animate-rise space-y-4" key={c.candidate_id}>
      <Card className="p-5 sm:p-6">
        {onBack && (
          <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-ink">
            <ChevronLeft className="h-4 w-4" aria-hidden /> All candidates
          </button>
        )}
        <div className="flex items-center gap-4 sm:gap-5">
          <Avatar name={c.candidate_name} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{c.candidate_name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="tnum whitespace-nowrap rounded-full bg-surface-2 px-2.5 py-1 font-mono text-xs font-bold text-ink-2 ring-1 ring-line">Rank #{c.rank} of {total}</span>
              <DecisionBadge decision={c.decision} />
            </div>
          </div>
          <ScoreRing value={c.final_score} size={92} label="Final" />
        </div>
        <div className={cn("mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4 text-center")}>
          {[
            ["Semantic", c.jd_similarity_score],
            ["Skills", c.skills_match_score],
            ["Experience", c.experience_match_score],
          ].map(([label, value]) => (
            <div key={label as string}>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
              <div className={cn("tnum mt-1 font-mono text-lg font-bold", value === null ? "text-muted-faint" : TONE[scoreTone(value as number)].text)}>
                {value === null ? "N/A" : (value as number).toFixed(1)}
              </div>
            </div>
          ))}
        </div>
        <span className="sr-only">Decision tone {tone}</span>
      </Card>

      <SummaryCard key={`sum-${c.candidate_id}`} candidate={c} jobId={jobId} onSummary={onSummary} />
      <ScoreCard c={c} />
      <SkillsCard c={c} />
      <BackgroundCard c={c} />
    </div>
  );
}
