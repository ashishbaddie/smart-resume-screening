import type { Decision } from "../types";

export type Tone = "good" | "info" | "warn" | "bad" | "neutral";

// Class names are written out in full so Tailwind can see them.
export const TONE: Record<Tone, { soft: string; text: string; bar: string; dot: string }> = {
  good: { soft: "bg-good-soft text-good", text: "text-good", bar: "bg-good", dot: "bg-good" },
  info: { soft: "bg-info-soft text-info", text: "text-info", bar: "bg-info", dot: "bg-info" },
  warn: { soft: "bg-warn-soft text-warn", text: "text-warn", bar: "bg-warn", dot: "bg-warn" },
  bad: { soft: "bg-bad-soft text-bad", text: "text-bad", bar: "bg-bad", dot: "bg-bad" },
  neutral: { soft: "bg-surface-2 text-ink-2", text: "text-ink-2", bar: "bg-faint", dot: "bg-faint" },
};

export const DECISIONS: Decision[] = ["Interview", "Consider", "Review", "Low Match"];

export const decisionTone = (decision: Decision): Tone =>
  ({ Interview: "good", Consider: "info", Review: "warn", "Low Match": "bad" } as const)[decision];

/** Colour for a 0-100 score. Uses the same cut-offs as the decision labels so bar and label always agree. */
export const scoreTone = (value: number): Tone => (value >= 80 ? "good" : value >= 60 ? "info" : value >= 40 ? "warn" : "bad");

export const pct = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

export function initials(name: string): string {
  return (
    name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || "?"
  );
}

/** A stable hue per name, so each candidate keeps the same avatar colour. */
export function avatarHue(name: string): number {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return hash;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
