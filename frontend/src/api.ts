/// <reference types="vite/client" />

import type { AnalyzeAccepted, Job, JobProfile } from "./types";

const API_BASE_URL = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""
).replace(/\/$/, "");

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function failure(response: Response): Promise<never> {
  let message = `Request failed (${response.status}).`;
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (typeof detail === "string") message = detail;
    else if (detail?.message) message = detail.message;
    else if (Array.isArray(detail) && detail[0]?.msg) message = detail[0].msg;
  } catch {
    /* keep the default message */
  }
  throw new ApiError(message, response.status);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ApiError("Cannot reach the server. Is the API running?", 0);
  }
  if (!response.ok) return failure(response);
  return (await response.json()) as T;
}

function jobDescriptionForm(text: string, file: File | null): FormData {
  const form = new FormData();
  if (file) form.append("jd_file", file);
  else form.append("job_description", text);
  return form;
}

export function previewJobProfile(text: string, file: File | null): Promise<JobProfile> {
  return request<JobProfile>(apiUrl("/api/job-profile"), {
    method: "POST",
    body: jobDescriptionForm(text, file),
  });
}

export function startAnalysis(text: string, jdFile: File | null, resumes: File[]): Promise<AnalyzeAccepted> {
  const form = jobDescriptionForm(text, jdFile);
  resumes.forEach((file) => form.append("resumes", file));
  return request<AnalyzeAccepted>(apiUrl("/api/analyze"), { method: "POST", body: form });
}

export function getJob(jobId: string, signal?: AbortSignal): Promise<Job> {
  return request<Job>(apiUrl(`/api/jobs/${jobId}`), { signal });
}

export async function generateSummary(jobId: string, candidateId: string): Promise<string> {
  const body = await request<{ summary: string }>(
    apiUrl(`/api/jobs/${jobId}/candidates/${candidateId}/summary`),
    { method: "POST" },
  );
  return body.summary;
}

export const exportUrl = (jobId: string) => apiUrl(`/api/jobs/${jobId}/export.csv`);

export async function deleteJob(jobId: string): Promise<void> {
  await fetch(apiUrl(`/api/jobs/${jobId}`), { method: "DELETE" }).catch(() => undefined);
}
