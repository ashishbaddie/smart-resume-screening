// These mirror the JSON returned by the FastAPI service (api/schemas.py).

export type Decision = "Interview" | "Consider" | "Review" | "Low Match";
export type JobStatus = "queued" | "running" | "done" | "failed";

export interface JobProfile {
  job_title: string | null;
  required_skills: string[];
  preferred_skills: string[];
  minimum_experience_years: number | null;
  required_education: string | null;
  used_skills_fallback: boolean;
}

export interface SkillGroup {
  alternatives: string[];
  matched_alternatives?: string[];
}

export interface Candidate {
  candidate_id: string;
  candidate_name: string;
  candidate_summary: string | null;
  decision: Decision;
  rank: number | null;

  jd_similarity_score: number;
  skills_match_score: number;
  final_score: number;
  required_skills_score: number | null;
  preferred_skills_score: number | null;
  experience_match_score: number | null;

  required_skills: string[];
  matched_skills: string[];
  missing_skills: string[];
  preferred_skills: string[];
  matched_preferred_skills: string[];
  missing_preferred_skills: string[];
  matched_required_groups: SkillGroup[];
  missing_required_groups: SkillGroup[];
  matched_preferred_groups: SkillGroup[];
  missing_preferred_groups: SkillGroup[];

  candidate_experience_years: number | null;
  required_experience_years: number | null;
  experience_match_status: string;
  candidate_education: string | null;
  education_in_progress: string[];
}

export interface SkippedFile {
  filename: string;
  reason: string;
}

export interface FailedCandidate {
  candidate_id: string;
  candidate_name: string;
  error: string;
}

export interface Job {
  job_id: string;
  status: JobStatus;
  total: number;
  completed: number;
  job_profile: JobProfile;
  results: Candidate[];
  failed: FailedCandidate[];
  skipped: SkippedFile[];
  error: string | null;
}

export interface AnalyzeAccepted {
  job_id: string;
  total: number;
  skipped: SkippedFile[];
}
