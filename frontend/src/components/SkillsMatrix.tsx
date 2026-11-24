import { Check, Minus, X } from "lucide-react";
import { cn } from "../lib/cn";
import { scoreTone, TONE } from "../lib/format";
import type { Candidate } from "../types";
import { Avatar, Card } from "./ui";

/** Candidates down the side, skills across the top. The fastest way to compare people side by side. */
export default function SkillsMatrix({ candidates, onSelect }: { candidates: Candidate[]; onSelect: (id: string) => void }) {
  const required = candidates[0]?.required_skills ?? [];
  const preferred = Array.from(new Set(candidates.flatMap((c) => c.preferred_skills)));

  if (required.length + preferred.length === 0) {
    return <Card className="p-10 text-center text-sm text-muted">No skills were extracted from the job description, so there is nothing to compare.</Card>;
  }

  const header = (skill: string, kind: "required" | "preferred") => (
    <th key={`${kind}-${skill}`} scope="col" className="h-36 w-11 min-w-11 p-0 align-bottom">
      <div className="flex h-full items-end justify-center pb-2">
        <span className={cn("max-h-32 truncate text-xs font-semibold [writing-mode:vertical-rl] rotate-180", kind === "preferred" ? "text-info" : "text-ink-2")} title={skill}>
          {skill}
        </span>
      </div>
    </th>
  );

  return (
    <Card className="overflow-hidden">
      <div className="thin-scroll overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Skills matrix: which candidates show evidence for each skill</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="sticky left-0 z-10 min-w-[240px] bg-surface p-4 text-left align-bottom">
                <div className="text-xs font-bold uppercase tracking-wider text-muted">Candidate</div>
                <div className="mt-2 flex items-center gap-4 text-[11px] font-semibold text-muted">
                  <span className="inline-flex items-center gap-1"><span className="grid h-4 w-4 place-items-center rounded-full bg-good text-brand-on"><Check className="h-2.5 w-2.5" /></span>Evidence found</span>
                  <span className="inline-flex items-center gap-1"><span className="grid h-4 w-4 place-items-center rounded-full bg-bad-soft text-bad"><X className="h-2.5 w-2.5" /></span>Not found</span>
                </div>
              </th>
              <th scope="col" className="w-16 p-2 text-right align-bottom text-xs font-bold uppercase tracking-wider text-muted">Score</th>
              {required.map((s) => header(s, "required"))}
              {preferred.length > 0 && <th aria-hidden className="w-3 border-l border-line p-0" />}
              {preferred.map((s) => header(s, "preferred"))}
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.candidate_id} className="group border-b border-line last:border-0 hover:bg-surface-2">
                <th scope="row" className="sticky left-0 z-10 bg-surface p-0 text-left font-normal group-hover:bg-surface-2">
                  <button type="button" onClick={() => onSelect(c.candidate_id)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="tnum w-5 font-mono text-xs font-bold text-muted">{c.rank}</span>
                    <Avatar name={c.candidate_name} size={30} />
                    <span className="truncate font-semibold">{c.candidate_name}</span>
                  </button>
                </th>
                <td className={cn("tnum p-2 text-right font-mono font-bold", TONE[scoreTone(c.final_score)].text)}>{c.final_score.toFixed(1)}</td>
                {required.map((s) => {
                  const hit = c.matched_skills.includes(s);
                  return (
                    <td key={s} className="p-0 text-center" title={`${c.candidate_name}: ${s} ${hit ? "found" : "not found"}`}>
                      <span className={cn("mx-auto grid h-6 w-6 place-items-center rounded-full", hit ? "bg-good text-brand-on" : "bg-bad-soft text-bad")}>
                        {hit ? <Check className="h-3.5 w-3.5" aria-label="Evidence found" /> : <X className="h-3.5 w-3.5" aria-label="Not found" />}
                      </span>
                    </td>
                  );
                })}
                {preferred.length > 0 && <td aria-hidden className="border-l border-line p-0" />}
                {preferred.map((s) => {
                  const hit = c.matched_preferred_skills.includes(s);
                  return (
                    <td key={s} className="p-0 text-center" title={`${c.candidate_name}: ${s} ${hit ? "found" : "not found"}`}>
                      <span className={cn("mx-auto grid h-6 w-6 place-items-center rounded-full", hit ? "bg-info text-brand-on" : "text-faint")}>
                        {hit ? <Check className="h-3.5 w-3.5" aria-label="Evidence found" /> : <Minus className="h-3.5 w-3.5" aria-label="Not found" />}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
