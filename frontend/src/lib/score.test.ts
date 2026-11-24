import { describe, expect, it } from "vitest";
import { scoreComposition } from "./score";
import type { Candidate } from "../types";

const base = {
  jd_similarity_score: 80, skills_match_score: 90, experience_match_score: 100, final_score: 89,
} as Candidate;

describe("scoreComposition", () => {
  it("splits the final score into weighted points that add up to it", () => {
    const comp = scoreComposition(base);
    expect(comp.parts.map((p) => p.key)).toEqual(["semantic", "skills", "experience"]);
    expect(comp.parts.map((p) => Number(p.points.toFixed(1)))).toEqual([24, 45, 20]);
    expect(comp.consistent).toBe(true);
    expect(comp.rescaled).toBe(false);
  });

  it("drops experience and rescales the other weights when it is unknown", () => {
    const comp = scoreComposition({ ...base, experience_match_score: null, jd_similarity_score: 20, skills_match_score: 10, final_score: 13.75 });
    expect(comp.parts.map((p) => p.key)).toEqual(["semantic", "skills"]);
    expect(comp.rescaled).toBe(true);
    expect(comp.consistent).toBe(true);
    expect(comp.parts.reduce((s, p) => s + p.points, 0)).toBeCloseTo(13.75, 5);
  });

  it("flags numbers that do not add up so the UI can hide the breakdown", () => {
    expect(scoreComposition({ ...base, final_score: 70 }).consistent).toBe(false);
  });
});
