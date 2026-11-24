import { Check, CircleHelp, FileCheck2, Moon, RotateCcw, Sun } from "lucide-react";
import type { Theme } from "../hooks/hooks";
import { cn } from "../lib/cn";
import { Button, IconButton } from "./ui";

export type View = "setup" | "running" | "results";

const STEPS: { id: View; label: string }[] = [
  { id: "setup", label: "Inputs" },
  { id: "running", label: "Analysis" },
  { id: "results", label: "Results" },
];

interface Props {
  view: View;
  theme: Theme;
  onToggleTheme: () => void;
  onHelp: () => void;
  onNew: () => void;
}

export default function Header({ view, theme, onToggleTheme, onHelp, onNew }: Props) {
  const current = STEPS.findIndex((s) => s.id === view);

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-brand to-brand-strong text-brand-on shadow-sm" aria-hidden>
            <FileCheck2 className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="whitespace-nowrap text-[15px] font-extrabold tracking-tight">Resume Screening</div>
            <div className="hidden text-[11px] font-medium text-muted sm:block">Candidate ranking for recruiters</div>
          </div>
        </div>

        <nav aria-label="Progress" className="mx-auto hidden items-center gap-2 md:flex">
          {STEPS.map((step, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
                  <span
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-full text-xs font-bold",
                      done && "bg-brand text-brand-on",
                      active && "bg-brand-soft text-brand ring-2 ring-brand/40",
                      !done && !active && "bg-surface-2 text-muted-faint ring-1 ring-line",
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                  </span>
                  <span className={cn("text-[13px] font-semibold", active ? "text-ink" : done ? "text-ink-2" : "text-muted-faint")}>{step.label}</span>
                </div>
                {i < STEPS.length - 1 && <span className={cn("h-px w-8", done ? "bg-brand" : "bg-line-strong")} aria-hidden />}
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          {view === "results" && <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onNew} aria-label="New analysis" className="mr-1"><span className="hidden sm:inline">New analysis</span></Button>}
          <IconButton icon={CircleHelp} label="How scoring works" onClick={onHelp} />
          <IconButton icon={theme === "dark" ? Sun : Moon} label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} onClick={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
