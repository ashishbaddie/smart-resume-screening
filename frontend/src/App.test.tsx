import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Candidate, Job } from "./types";

const candidate = (overrides: Partial<Candidate>): Candidate => ({
  candidate_id: "c1", candidate_name: "Priya Nair", candidate_summary: null, decision: "Interview", rank: 1,
  jd_similarity_score: 80, skills_match_score: 90, final_score: 89,
  required_skills_score: 90, preferred_skills_score: 50, experience_match_score: 100,
  required_skills: ["React", "SQL"], matched_skills: ["React"], missing_skills: ["SQL"],
  preferred_skills: ["Docker"], matched_preferred_skills: ["Docker"], missing_preferred_skills: [],
  matched_required_groups: [], missing_required_groups: [], matched_preferred_groups: [], missing_preferred_groups: [],
  candidate_experience_years: 6, required_experience_years: 3, experience_match_status: "Meets",
  candidate_education: "B.Tech", education_in_progress: [],
  ...overrides,
});

const PROFILE = {
  job_title: "Full-Stack Engineer", required_skills: ["React", "SQL"], preferred_skills: ["Docker"],
  minimum_experience_years: 3, required_education: null, used_skills_fallback: false,
};

const FINAL_JOB: Job = {
  job_id: "j1", status: "done", total: 2, completed: 2, job_profile: PROFILE, failed: [], skipped: [], error: null,
  results: [
    candidate({}),
    candidate({
      candidate_id: "c2", candidate_name: "Tom Henderson", rank: 2, decision: "Low Match",
      jd_similarity_score: 20, skills_match_score: 10, final_score: 13.75,
      experience_match_score: null, candidate_experience_years: null, preferred_skills_score: null,
      matched_skills: [], missing_skills: ["React", "SQL"],
    }),
  ],
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

const pdf = (name: string) => new File(["%PDF-1.4"], name, { type: "application/pdf" });

function fillInputs() {
  fireEvent.change(screen.getByLabelText("Paste Job Description"), { target: { value: "We need React and SQL." } });
  fireEvent.change(screen.getByLabelText("Upload One or More PDF Resumes"), {
    target: { files: [pdf("Priya_Nair.pdf"), pdf("Tom_Henderson.pdf")] },
  });
}

async function runAnalysis() {
  fillInputs();
  fireEvent.click(screen.getByRole("button", { name: /Analyze resumes/ }));
  await screen.findByRole("listbox", { name: "Candidates" }, { timeout: 5000 });
}

describe("App", () => {
  let polls = 0;

  beforeEach(() => {
    polls = 0;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
    vi.stubGlobal("fetch", vi.fn((url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      if (url === "/api/job-profile") return json(PROFILE);
      if (url === "/api/analyze") return json({ job_id: "j1", total: 2, skipped: [] }, 202);
      if (url === "/api/jobs/j1" && method === "GET") {
        polls += 1;
        return json(polls === 1 ? { ...FINAL_JOB, status: "running", completed: 1, results: [] } : FINAL_JOB);
      }
      if (url === "/api/jobs/j1/candidates/c1/summary") return json({ candidate_id: "c1", summary: "Strong full-stack profile." });
      if (url === "/api/jobs/j1" && method === "DELETE") return Promise.resolve(new Response(null, { status: 204 }));
      return json({ detail: "unexpected " + url }, 500);
    }));
  });

  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("walks through inputs, progress and results", async () => {
    render(<App />);

    // The action stays disabled until both inputs exist.
    const analyze = screen.getByRole("button", { name: /Analyze resumes/ }) as HTMLButtonElement;
    expect(analyze.disabled).toBe(true);
    fillInputs();
    expect(screen.getByText("2 resumes")).toBeTruthy();
    expect(analyze.disabled).toBe(false);

    // Optional skill preview
    fireEvent.click(screen.getByRole("button", { name: /Preview required skills/ }));
    expect(await screen.findByText("Required skills · 2")).toBeTruthy();
    expect(screen.getByText("Preferred skills · 1")).toBeTruthy();

    // Progress screen, then the results workspace
    fireEvent.click(analyze);
    expect(await screen.findByText("Analyzing resumes")).toBeTruthy();
    const list = await screen.findByRole("listbox", { name: "Candidates" }, { timeout: 5000 });
    expect(within(list).getByText("Priya Nair")).toBeTruthy();
    expect(within(list).getByText("Tom Henderson")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Full-Stack Engineer" })).toBeTruthy();
    expect((screen.getByRole("link", { name: /Export CSV/ }) as HTMLAnchorElement).getAttribute("href")).toBe("/api/jobs/j1/export.csv");

    // The first candidate is open, with the score explained in points
    expect(screen.getByText("Rank #1 of 2")).toBeTruthy();
    expect(screen.getByText("+24.0")).toBeTruthy();
    expect(screen.getByText("+45.0")).toBeTruthy();

    // Summary on demand
    fireEvent.click(screen.getByRole("button", { name: "Generate AI Summary" }));
    expect(await screen.findByText("Strong full-stack profile.")).toBeTruthy();
  });

  it("explains a rescaled score when experience is unknown", async () => {
    render(<App />);
    await runAnalysis();
    fireEvent.click(within(screen.getByRole("listbox", { name: "Candidates" })).getByText("Tom Henderson"));
    expect(screen.getByText("Rank #2 of 2")).toBeTruthy();
    expect(screen.getByText(/Experience could not be determined/)).toBeTruthy();
    expect(screen.getAllByText("Could not be determined").length).toBeGreaterThan(0);
  });

  it("searches and filters candidates", async () => {
    render(<App />);
    await runAnalysis();
    fireEvent.change(screen.getByPlaceholderText("Search candidates"), { target: { value: "tom" } });
    const list = screen.getByRole("listbox", { name: "Candidates" });
    expect(within(list).queryByText("Priya Nair")).toBeNull();
    expect(within(list).getByText("Tom Henderson")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search candidates"), { target: { value: "zzz" } });
    expect(screen.getByText("No candidates match")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search candidates"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Interview/, pressed: false }));
    expect(within(screen.getByRole("listbox", { name: "Candidates" })).queryByText("Tom Henderson")).toBeNull();
  });

  it("shows the skills matrix", async () => {
    render(<App />);
    await runAnalysis();
    fireEvent.click(screen.getByRole("radio", { name: "Skills matrix" }));
    const table = screen.getByRole("table");
    expect(within(table).getByText("React")).toBeTruthy();
    expect(within(table).getByText("Docker")).toBeTruthy();
    fireEvent.click(within(table).getByText("Tom Henderson"));
    expect(screen.getByRole("listbox", { name: "Candidates" })).toBeTruthy(); // back on the ranking view
    expect(screen.getByText("Rank #2 of 2")).toBeTruthy();
  });

  it("starts a new analysis, deletes the job and keeps the inputs", async () => {
    render(<App />);
    await runAnalysis();
    fireEvent.click(screen.getByRole("button", { name: "New analysis" }));
    await waitFor(() => expect(screen.getByText("Find the best-fit candidates, faster.")).toBeTruthy());
    expect((screen.getByLabelText("Paste Job Description") as HTMLTextAreaElement).value).toBe("We need React and SQL.");
    expect((fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.some(
      ([url, init]) => url === "/api/jobs/j1" && init?.method === "DELETE",
    )).toBe(true);
  });

  it("shows a clear error when the server rejects the request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ detail: "Please provide a Job Description (text or PDF)." }, 422)));
    render(<App />);
    fillInputs();
    fireEvent.click(screen.getByRole("button", { name: /Analyze resumes/ }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Please provide a Job Description (text or PDF).")).toBeTruthy();
  });

  it("rejects non-PDF resumes in the browser", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText("Upload One or More PDF Resumes"), {
      target: { files: [new File(["x"], "notes.txt", { type: "text/plain" })] },
    });
    expect(screen.getByText(/notes.txt is not a PDF/)).toBeTruthy();
  });

  it("toggles the theme and opens the scoring help", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Switch to dark theme/ }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    fireEvent.click(screen.getByRole("button", { name: /Switch to light theme/ }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    fireEvent.click(screen.getByRole("button", { name: "How scoring works" }));
    expect(screen.getByRole("dialog", { name: "How scoring works" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
