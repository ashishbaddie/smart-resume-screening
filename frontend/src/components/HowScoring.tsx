import { Modal, DecisionBadge } from "./ui";
import type { Decision } from "../types";

const LEVELS: [Decision, string][] = [
  ["Interview", "80% and above"],
  ["Consider", "60% to 79%"],
  ["Review", "40% to 59%"],
  ["Low Match", "Below 40%"],
];

export default function HowScoring({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="How scoring works">
      <div className="space-y-5 text-sm leading-relaxed text-ink-2">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Final score</h3>
          <ul className="space-y-2">
            <li className="flex gap-3"><b className="tnum w-10 shrink-0 font-mono text-ink">30%</b><span><b className="text-ink">Semantic similarity.</b> How close the meaning of the resume is to the job description.</span></li>
            <li className="flex gap-3"><b className="tnum w-10 shrink-0 font-mono text-ink">50%</b><span><b className="text-ink">Skills match.</b> 80% required skills and 20% preferred skills, each checked against evidence in the resume.</span></li>
            <li className="flex gap-3"><b className="tnum w-10 shrink-0 font-mono text-ink">20%</b><span><b className="text-ink">Experience.</b> Based on dated employment. Personal and academic projects do not count.</span></li>
          </ul>
          <p className="mt-2 text-[13px] text-muted">If experience cannot be determined, it is left out and the other weights are rescaled.</p>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Decision labels</h3>
          <ul className="space-y-2">
            {LEVELS.map(([decision, range]) => (
              <li key={decision} className="flex items-center justify-between"><DecisionBadge decision={decision} /><span className="tnum font-mono text-[13px] text-muted">{range}</span></li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[13px]">
          Scores are decision support, not hiring decisions. Resume text is sent to Gemini for analysis, held in server
          memory only, and removed when you clear the results.
        </div>
      </div>
    </Modal>
  );
}
