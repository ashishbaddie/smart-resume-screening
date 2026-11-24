"""Response models. They define the JSON the React app receives (and the /docs page)."""
from typing import Literal, Optional

from pydantic import BaseModel, Field

from models.analysis_result import AnalysisResult

Decision = Literal["Interview", "Consider", "Review", "Low Match"]
JobStatus = Literal["queued", "running", "done", "failed"]


class JobProfileOut(BaseModel):
    job_title: Optional[str] = None
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    minimum_experience_years: Optional[float] = None
    required_education: Optional[str] = None
    # True when Gemini returned no required skills and data/skills.txt was used instead.
    used_skills_fallback: bool = False


class CandidateOut(AnalysisResult):
    """Your existing AnalysisResult plus the fields the UI needs."""

    candidate_id: str
    decision: Decision


class SkippedFile(BaseModel):
    filename: str
    reason: str


class FailedCandidate(BaseModel):
    candidate_id: str
    candidate_name: str
    error: str


class AnalyzeAccepted(BaseModel):
    job_id: str
    total: int
    skipped: list[SkippedFile] = Field(default_factory=list)


class JobOut(BaseModel):
    job_id: str
    status: JobStatus
    total: int
    completed: int
    job_profile: JobProfileOut
    results: list[CandidateOut] = Field(default_factory=list)
    failed: list[FailedCandidate] = Field(default_factory=list)
    skipped: list[SkippedFile] = Field(default_factory=list)
    error: Optional[str] = None


class SummaryOut(BaseModel):
    candidate_id: str
    summary: str


class HealthOut(BaseModel):
    status: str = "ok"
    version: str
