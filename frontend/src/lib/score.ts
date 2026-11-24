import type { Candidate } from "../types";

// These mirror src/analysis/resume_analyzer.py: final = sum(score x weight) / sum(weights),
// and the experience weight is dropped when experience could not be determined.
export const WEIGHTS = { semantic: 0.3, skills: 0.5, experience: 0.2 } as const;

export interface ScorePart {
  key: "semantic" | "skills" | "experience";
  label: string;
  weight: number;   // nominal weight, e.g. 0.3
  score: number;    // 0-100 component score
  points: number;   // points this component adds to the final score
}

export interface ScoreComposition {
  parts: ScorePart[];
  rescaled: boolean; // true when experience was left out
  /** False if the numbers do not add up to the backend's final score; the UI then hides the breakdown. */
  consistent: boolean;
}

export function scoreComposition(c: Candidate): ScoreComposition {
  const hasExperience = c.experience_match_score !== null;
  const entries: Omit<ScorePart, "points">[] = [
    { key: "semantic", label: "Semantic similarity", weight: WEIGHTS.semantic, score: c.jd_similarity_score },
    { key: "skills", label: "Skills match", weight: WEIGHTS.skills, score: c.skills_match_score },
  ];
  if (hasExperience) {
    entries.push({ key: "experience", label: "Experience", weight: WEIGHTS.experience, score: c.experience_match_score as number });
  }
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  const parts = entries.map((e) => ({ ...e, points: (e.score * e.weight) / totalWeight }));
  const sum = parts.reduce((s, p) => s + p.points, 0);
  return { parts, rescaled: !hasExperience, consistent: Math.abs(sum - c.final_score) <= 0.6 };
}
