"""Pure helpers used by the API routes.

These wrap your existing modules (src/ and models/) without changing them.
"""
import csv
import io
import os
from functools import lru_cache
from threading import Lock
from typing import Optional

from models.job_profile import JobProfile
from src.analysis.llm_extractor import extract_job_profile, generate_candidate_summary  # noqa: F401
from src.analysis.resume_analyzer import ResumeAnalyzer
from src.matching.skill_extractor import extract_skills, load_skills
from src.parsers.pdf_extractor import extract_text_from_pdf

from api.config import get_settings


class PdfError(ValueError):
    """A user-facing problem with an uploaded PDF."""


# ---------------------------------------------------------------- decisions

def decision_for(score: float) -> str:
    """Same thresholds as the Streamlit app and the README."""
    if score >= 80:
        return "Interview"
    if score >= 60:
        return "Consider"
    if score >= 40:
        return "Review"
    return "Low Match"


# ---------------------------------------------------------------- PDF input

def read_pdf(data: bytes) -> str:
    """Validate an uploaded PDF and return its text."""
    settings = get_settings()
    if len(data) > settings.max_file_bytes:
        raise PdfError(f"File is larger than {settings.max_file_mb} MB.")
    if not data.startswith(b"%PDF"):
        raise PdfError("Not a valid PDF file.")
    try:
        text = extract_text_from_pdf(io.BytesIO(data))
    except Exception as exc:  # pdfplumber raises many different errors
        raise PdfError("The PDF could not be read.") from exc
    if not text.strip():
        raise PdfError("No readable text found. The PDF may be scanned or image-based.")
    return text


def candidate_name_from_filename(filename: str) -> str:
    """Same rule as the Streamlit app: file name without extension, underscores to spaces."""
    base = os.path.splitext(os.path.basename(filename or "resume"))[0]
    return base.replace("_", " ").strip() or "Candidate"


# ---------------------------------------------------------------- job profile

_skills_db: Optional[list[str]] = None
_skills_db_lock = Lock()


def get_skills_database() -> list[str]:
    global _skills_db
    with _skills_db_lock:
        if _skills_db is None:
            _skills_db = load_skills(get_settings().skills_path)
        return _skills_db


@lru_cache(maxsize=64)
def _extract_profile_cached(job_description: str) -> JobProfile:
    # Equivalent of the @st.cache_data get_job_profile() in app.py.
    return extract_job_profile(job_description)


def clear_caches() -> None:
    _extract_profile_cached.cache_clear()


def resolve_job_profile(job_description: str) -> tuple[JobProfile, bool]:
    """Extract the job profile and apply the skills.txt fallback in ONE place.

    The preview endpoint and the analysis endpoint both call this, so the skills the
    user sees are exactly the skills used for scoring.
    """
    profile = _extract_profile_cached(job_description).model_copy(deep=True)
    used_fallback = False

    if not profile.required_skills:
        fallback = extract_skills(job_description, get_skills_database())
        if fallback:
            profile.required_skills = fallback
            required = {" ".join(s.lower().split()) for s in fallback}
            profile.preferred_skills = [
                s for s in profile.preferred_skills
                if " ".join(s.lower().split()) not in required
            ]
            used_fallback = True

    return profile, used_fallback


# ---------------------------------------------------------------- analysis

_analyzer: Optional[ResumeAnalyzer] = None
_analyzer_lock = Lock()


def get_analyzer() -> ResumeAnalyzer:
    global _analyzer
    with _analyzer_lock:
        if _analyzer is None:
            _analyzer = ResumeAnalyzer(get_settings().skills_path)
        return _analyzer


def analyze_one(job_description: str, resume: dict, job_profile: JobProfile) -> dict:
    """Run the existing pipeline for a single resume.

    Calling analyze_multiple_resumes with one resume re-uses its validation
    (AnalysisResult) and gives per-resume progress without copying its logic.
    """
    return get_analyzer().analyze_multiple_resumes(
        job_description,
        [{"name": resume["name"], "text": resume["text"]}],
        job_profile,
    )[0]


def rank_candidates(indexed_results: list[tuple[int, dict]]) -> list[dict]:
    """Sort by final score (ties keep upload order) and assign ranks from 1."""
    ordered = sorted(indexed_results, key=lambda t: (-t[1]["final_score"], t[0]))
    results = [r for _, r in ordered]
    for rank, candidate in enumerate(results, start=1):
        candidate["rank"] = rank
    return results


# ---------------------------------------------------------------- export

_MEDALS = {1: "🥇", 2: "🥈", 3: "🥉"}


def _csv_safe(value: str) -> str:
    # Stop spreadsheet apps from running a file name such as "=cmd|..." as a formula.
    return "'" + value if value[:1] in ("=", "+", "-", "@") else value


def to_csv(results: list[dict]) -> str:
    """Same columns and format as the Streamlit download, so bias_audit/analyze_bias.py
    can read an export from either app."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(["Rank", "Candidate", "Final Score", "Decision"])
    for c in results:
        rank = c["rank"]
        medal = _MEDALS.get(rank)
        writer.writerow([
            f"{medal} {rank}" if medal else str(rank),
            _csv_safe(str(c["candidate_name"])),
            f'{c["final_score"]:.2f}%',
            decision_for(c["final_score"]),
        ])
    return buffer.getvalue()
