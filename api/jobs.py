"""In-memory job store and background runner.

Analysis needs several Gemini calls per resume, which is too slow for one HTTP request,
so /api/analyze returns a job id immediately and the work runs here in the background.

Limits (by design, for a single-server project):
  * Jobs live in memory and disappear on restart or after JOB_TTL_MINUTES.
  * Resume text is kept only in memory (never written to disk) so summaries can be generated
    on demand. DELETE /api/jobs/{id} removes it immediately.
To scale beyond one process, swap this module for Redis or PostgreSQL plus a task queue.
"""
import logging
import time
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from threading import Lock
from typing import Optional

from models.job_profile import JobProfile

from api import services
from api.config import get_settings

log = logging.getLogger("api.jobs")


@dataclass
class Job:
    id: str
    job_description: str
    job_profile: JobProfile
    used_fallback: bool
    resumes: list[dict]            # [{"id", "name", "text"}]
    skipped: list[dict]
    status: str = "queued"
    completed: int = 0
    results: list[dict] = field(default_factory=list)
    failed: list[dict] = field(default_factory=list)
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    lock: Lock = field(default_factory=Lock, repr=False)

    @property
    def total(self) -> int:
        return len(self.resumes)


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = Lock()

    def create(self, **kwargs) -> Job:
        self.prune()
        job = Job(id=uuid.uuid4().hex, **kwargs)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Optional[Job]:
        with self._lock:
            return self._jobs.get(job_id)

    def delete(self, job_id: str) -> bool:
        with self._lock:
            return self._jobs.pop(job_id, None) is not None

    def prune(self) -> None:
        ttl = get_settings().job_ttl_minutes * 60
        cutoff = time.time() - ttl
        with self._lock:
            for job_id in [j for j, job in self._jobs.items() if job.created_at < cutoff]:
                del self._jobs[job_id]

    def clear(self) -> None:
        with self._lock:
            self._jobs.clear()


store = JobStore()

_executor: Optional[ThreadPoolExecutor] = None
_executor_lock = Lock()


def _get_executor() -> ThreadPoolExecutor:
    global _executor
    with _executor_lock:
        if _executor is None:
            _executor = ThreadPoolExecutor(
                max_workers=get_settings().max_concurrent_jobs,
                thread_name_prefix="analysis-job",
            )
        return _executor


def shutdown_executor() -> None:
    global _executor
    with _executor_lock:
        if _executor is not None:
            _executor.shutdown(wait=False, cancel_futures=True)
            _executor = None


def submit(job: Job) -> None:
    _get_executor().submit(run_job, job)


def run_job(job: Job) -> None:
    """Analyze every resume in the job. A failure on one resume never stops the others."""
    job.status = "running"
    workers = get_settings().analysis_workers

    def work(index: int, resume: dict):
        try:
            result = services.analyze_one(job.job_description, resume, job.job_profile)
            result["candidate_id"] = resume["id"]
            return index, result, None
        except Exception as exc:  # noqa: BLE001 - report any failure per resume
            log.exception("Analysis failed for candidate %s", resume["id"])
            return index, None, exc

    try:
        indexed: list[tuple[int, dict]] = []
        with ThreadPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(work, i, r) for i, r in enumerate(job.resumes)]
            for future in as_completed(futures):
                index, result, exc = future.result()
                with job.lock:
                    if result is not None:
                        indexed.append((index, result))
                    else:
                        resume = job.resumes[index]
                        job.failed.append({
                            "candidate_id": resume["id"],
                            "candidate_name": resume["name"],
                            "error": f"Analysis failed ({type(exc).__name__}).",
                        })
                    job.completed += 1

        with job.lock:
            job.results = services.rank_candidates(indexed)
            if job.results:
                job.status = "done"
            else:
                job.status = "failed"
                job.error = "None of the resumes could be analyzed."
    except Exception as exc:  # noqa: BLE001
        log.exception("Job %s crashed", job.id)
        with job.lock:
            job.status = "failed"
            job.error = f"Analysis failed ({type(exc).__name__})."


def find_candidate(job: Job, candidate_id: str) -> Optional[dict]:
    for candidate in job.results:
        if candidate.get("candidate_id") == candidate_id:
            return candidate
    return None


def resume_text(job: Job, candidate_id: str) -> Optional[str]:
    for resume in job.resumes:
        if resume["id"] == candidate_id:
            return resume["text"]
    return None


def get_or_create_summary(job: Job, candidate_id: str) -> Optional[str]:
    """Return the stored summary, or generate it once on demand.

    Mirrors the 'Generate AI Summary' button in the Streamlit app. Raises on Gemini failure
    so the route can return a clear error instead of storing a placeholder.
    """
    candidate = find_candidate(job, candidate_id)
    text = resume_text(job, candidate_id)
    if candidate is None or text is None:
        return None
    if candidate.get("candidate_summary"):
        return candidate["candidate_summary"]

    summary = services.generate_candidate_summary(
        resume_text=text,
        job_description=job.job_description,
        required_skills=candidate.get("required_skills", []),
        matched_skills=candidate.get("matched_skills", []),
        missing_skills=candidate.get("missing_skills", []),
    )
    with job.lock:
        candidate["candidate_summary"] = summary
    return summary
