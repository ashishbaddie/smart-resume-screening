"""Runtime settings for the API, read from environment variables.

Everything has a safe default so the API runs with only GEMINI_API_KEY set.
Settings are read on every call (not cached) so tests can change them easily.
"""
import os
from dataclasses import dataclass


def _int(name: str, default: int) -> int:
    try:
        return max(1, int(os.getenv(name, default)))
    except ValueError:
        return default


@dataclass(frozen=True)
class Settings:
    cors_origins: list[str]
    max_file_mb: int
    max_resumes: int
    analysis_workers: int
    max_concurrent_jobs: int
    job_ttl_minutes: int
    skills_path: str
    preload_model: bool

    @property
    def max_file_bytes(self) -> int:
        return self.max_file_mb * 1024 * 1024


def get_settings() -> Settings:
    origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
    return Settings(
        cors_origins=[o.strip() for o in origins.split(",") if o.strip()],
        max_file_mb=_int("MAX_FILE_MB", 10),
        max_resumes=_int("MAX_RESUMES", 25),
        # 1 = same behaviour as the Streamlit app (one resume at a time).
        # Raise to 2-3 for speed once you have checked your Gemini rate limits.
        analysis_workers=_int("ANALYSIS_WORKERS", 1),
        max_concurrent_jobs=_int("MAX_CONCURRENT_JOBS", 2),
        job_ttl_minutes=_int("JOB_TTL_MINUTES", 120),
        skills_path=os.getenv("SKILLS_PATH", "data/skills.txt"),
        preload_model=os.getenv("PRELOAD_MODEL", "1") != "0",
    )
