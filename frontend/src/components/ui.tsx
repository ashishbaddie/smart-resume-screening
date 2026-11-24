import { useEffect, useRef, useState } from "react";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { CircleAlert, Info, LoaderCircle, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEscape } from "../hooks/hooks";
import { avatarHue, decisionTone, initials, scoreTone, TONE } from "../lib/format";
import type { Tone } from "../lib/format";
import { cn } from "../lib/cn";
import type { Decision } from "../types";

// ------------------------------------------------------------------ buttons

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-brand-on shadow-sm hover:bg-brand-strong",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 gap-1.5 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-6 text-[15px]",
};

export const buttonClass = (variant: Variant = "secondary", size: Size = "md", extra = "") =>
  cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-xl font-semibold transition",
    "disabled:cursor-not-allowed disabled:opacity-50",
    VARIANT[variant], SIZE[size], extra,
  );

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: LucideIcon;
  loading?: boolean;
}

export function Button({ variant = "secondary", size = "md", icon: Icon, loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button {...rest} disabled={disabled || loading} className={buttonClass(variant, size, className)}>
      {loading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden /> : Icon && <Icon className="h-4 w-4" aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "secondary", size = "md", icon: Icon, className, children, ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: Variant; size?: Size; icon?: LucideIcon }) {
  return (
    <a {...rest} className={buttonClass(variant, size, className)}>
      {Icon && <Icon className="h-4 w-4" aria-hidden />}
      {children}
    </a>
  );
}

export function IconButton({ icon: Icon, label, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      {...rest} aria-label={label} title={label}
      className={cn("grid h-10 w-10 place-items-center rounded-xl text-ink-2 transition hover:bg-surface-2 hover:text-ink", className)}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
    </button>
  );
}

// ------------------------------------------------------------------ surfaces

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-line bg-surface shadow-card", className)}>{children}</section>;
}

export function CardHeader({ icon: Icon, title, subtitle, right }: { icon: LucideIcon; title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-brand-soft text-brand" aria-hidden>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-[15px] font-bold leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-muted">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export function Alert({ tone = "info", children, onClose }: { tone?: "info" | "warn" | "error"; children: ReactNode; onClose?: () => void }) {
  const style = {
    info: { box: "border-info/25 bg-info-soft text-ink", icon: Info, color: "text-info" },
    warn: { box: "border-warn/30 bg-warn-soft text-ink", icon: TriangleAlert, color: "text-warn" },
    error: { box: "border-bad/30 bg-bad-soft text-ink", icon: CircleAlert, color: "text-bad" },
  }[tone];
  const Icon = style.icon;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-xl border px-4 py-3 text-sm", style.box)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", style.color)} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ small pieces

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", TONE[tone].soft, className)}>
      {children}
    </span>
  );
}

export function DecisionBadge({ decision }: { decision: Decision }) {
  const tone = decisionTone(decision);
  return (
    <Badge tone={tone}>
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE[tone].dot)} aria-hidden />
      {decision}
    </Badge>
  );
}

export function SkillChip({ label, state }: { label: string; state: "matched" | "missing" | "preferred" | "preferred-missing" | "preferred-tag" | "neutral" }) {
  const style = {
    matched: "border-good/25 bg-good-soft text-good",
    missing: "border-bad/25 bg-bad-soft text-bad",
    preferred: "border-info/25 bg-info-soft text-info",
    "preferred-tag": "border-info/25 bg-info-soft text-info",
    "preferred-missing": "border-line bg-surface-2 text-muted",
    neutral: "border-line bg-surface-2 text-ink-2",
  }[state];
  const mark = { matched: "✓", missing: "✕", preferred: "✓", "preferred-missing": "–", "preferred-tag": "", neutral: "" }[state];
  return (
    <li className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-semibold", style)}>
      {mark && <span aria-hidden className="text-[11px]">{mark}</span>}
      {label}
    </li>
  );
}

export function ChipList({ children, empty }: { children: ReactNode[] | ReactNode; empty?: string }) {
  const items = Array.isArray(children) ? children : [children];
  if (items.length === 0) return <p className="text-[13px] text-muted">{empty ?? "None"}</p>;
  return <ul className="flex flex-wrap gap-1.5">{children}</ul>;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const hue = avatarHue(name);
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: `hsl(${hue} 70% 50% / 0.16)`, color: `hsl(${hue} 60% var(--avatar-l))` }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function ProgressBar({ value, tone = "good", className }: { value: number; tone?: Tone; className?: string }) {
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full bg-line", className)} role="presentation">
      <div className={cn("h-full rounded-full transition-[width] duration-700 ease-out", TONE[tone].bar)} style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  );
}

export function ScoreRing({ value, size = 96, stroke = 9, label }: { value: number; size?: number; stroke?: number; label?: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const pct = Math.max(0, Math.min(value, 100));
  const tone = scoreTone(value);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${value.toFixed(1)} percent`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-line" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} strokeLinecap="round"
          className={cn("transition-[stroke-dashoffset] duration-1000 ease-out", { good: "stroke-good", warn: "stroke-warn", bad: "stroke-bad", info: "stroke-info", neutral: "stroke-faint" }[tone])}
          strokeDasharray={circumference} strokeDashoffset={drawn ? circumference * (1 - pct / 100) : circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="tnum font-mono font-bold" style={{ fontSize: size * 0.26 }}>{value.toFixed(1)}</span>
        {label && <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted">{label}</span>}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  options, value, onChange, label, size = "md",
}: { options: { value: T; label: string; icon?: LucideIcon }[]; value: T; onChange: (value: T) => void; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
      {options.map((option) => {
        const active = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value} type="button" role="radio" aria-checked={active} onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[10px] font-semibold transition",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[13px]",
              active ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEscape(open, onClose);
  useEffect(() => { if (open) closeRef.current?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative max-h-[90vh] w-full max-w-lg animate-rise overflow-y-auto rounded-2xl border border-line bg-surface p-6 shadow-pop thin-scroll">
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-ink"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
