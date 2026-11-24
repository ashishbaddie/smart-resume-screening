import { useRef } from "react";
import type { KeyboardEvent } from "react";
import { Search, SearchX } from "lucide-react";
import { cn } from "../lib/cn";
import { decisionTone, scoreTone, TONE } from "../lib/format";
import type { Candidate } from "../types";
import { Avatar, ProgressBar } from "./ui";

function RankBadge({ rank }: { rank: number }) {
  return (
    <span
      className={cn(
        "tnum grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-bold",
        rank === 1 ? "bg-brand text-brand-on" : rank <= 3 ? "bg-brand-soft text-brand" : "bg-surface-2 text-muted ring-1 ring-line",
      )}
    >
      {rank}
    </span>
  );
}

interface Props {
  candidates: Candidate[];
  selectedId: string;
  query: string;
  onQuery: (query: string) => void;
  onSelect: (id: string) => void;
  totalCount: number;
}

export default function CandidateList({ candidates, selectedId, query, onQuery, onSelect, totalCount }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  // Arrow keys move through the list, like a listbox.
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const options = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const index = options.findIndex((o) => o === document.activeElement);
    const next = options[Math.min(options.length - 1, Math.max(0, index + (event.key === "ArrowDown" ? 1 : -1)))];
    next?.focus();
    next?.click();
  };

  return (
    <div className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="border-b border-line p-3">
        <label className="relative block">
          <span className="sr-only">Search candidates</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search candidates"
            className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm placeholder:text-muted-faint focus:border-brand"
          />
        </label>
        <p className="tnum mt-2 px-1 font-mono text-xs text-muted">Showing {candidates.length} of {totalCount}</p>
      </div>

      {candidates.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <SearchX className="mx-auto h-8 w-8 text-muted-faint" aria-hidden />
          <p className="mt-3 text-sm font-semibold">No candidates match</p>
          <p className="mt-1 text-[13px] text-muted">Try a different name or clear the filter.</p>
        </div>
      ) : (
        <ul ref={listRef} role="listbox" aria-label="Candidates" onKeyDown={onKeyDown} className="thin-scroll max-h-[calc(100vh-15rem)] space-y-1 overflow-y-auto p-2">
          {candidates.map((c) => {
            const selected = c.candidate_id === selectedId;
            return (
              <li key={c.candidate_id} role="none">
                <button
                  type="button" role="option" aria-selected={selected} onClick={() => onSelect(c.candidate_id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                    selected ? "border-brand/40 bg-brand-soft" : "border-transparent hover:bg-surface-2",
                  )}
                >
                  <RankBadge rank={c.rank ?? 0} />
                  <Avatar name={c.candidate_name} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{c.candidate_name}</span>
                    <span className={cn("mt-0.5 flex items-center gap-1.5 text-xs font-semibold", TONE[decisionTone(c.decision)].text)}>
                      <span className={cn("h-1.5 w-1.5 rounded-full", TONE[decisionTone(c.decision)].dot)} aria-hidden />
                      {c.decision}
                    </span>
                  </span>
                  <span className="w-16 text-right">
                    <span className="tnum block font-mono text-base font-bold leading-none">{c.final_score.toFixed(1)}</span>
                    <ProgressBar value={c.final_score} tone={scoreTone(c.final_score)} className="mt-1.5 h-1" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
