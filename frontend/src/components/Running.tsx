import { Sparkles } from "lucide-react";
import { formatDuration } from "../lib/format";
import { Card } from "./ui";

export default function Running({ completed, total, elapsed }: { completed: number; total: number; elapsed: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = completed > 0 && total > completed ? (elapsed / completed) * (total - completed) : null;

  return (
    <div className="mx-auto max-w-2xl animate-rise py-10 sm:py-16" role="status" aria-live="polite">
      <Card className="p-8 text-center sm:p-10">
        <div className="relative mx-auto mb-6 grid h-16 w-16 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" aria-hidden />
          <span className="relative grid h-16 w-16 place-items-center rounded-full bg-brand-soft text-brand"><Sparkles className="h-7 w-7" aria-hidden /></span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Analyzing resumes</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Each resume is read and every skill is checked against evidence, so larger batches take longer.
          Keep this tab open.
        </p>

        <div className="mt-8">
          <div className="tnum font-mono text-4xl font-bold">
            {completed}<span className="text-muted-faint"> / {total || "–"}</span>
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-muted">resumes analyzed</p>
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-line">
            {completed > 0 ? (
              <div className="h-full rounded-full bg-brand transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
            ) : (
              <div className="absolute inset-y-0 left-0 w-1/3 animate-slide rounded-full bg-gradient-to-r from-transparent via-brand to-transparent" />
            )}
          </div>
          <dl className="tnum mt-3 flex justify-center gap-8 font-mono text-[13px] text-muted">
            <div className="flex gap-2"><dt>Elapsed</dt><dd className="font-semibold text-ink">{formatDuration(elapsed)}</dd></div>
            <div className="flex gap-2"><dt>Remaining</dt><dd className="font-semibold text-ink">{remaining === null ? "estimating…" : `~${formatDuration(remaining)}`}</dd></div>
          </dl>
        </div>
      </Card>

      <ul className="mt-5 space-y-3" aria-hidden>
        {Array.from({ length: Math.min(Math.max(total, 3), 4) }, (_, i) => (
          <li key={i} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4" style={{ opacity: 1 - i * 0.18 }}>
            <div className="skeleton h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-2.5 w-1/2" /></div>
            <div className="skeleton h-6 w-14" />
          </li>
        ))}
      </ul>
    </div>
  );
}
