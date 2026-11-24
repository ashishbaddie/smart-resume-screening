"""FastAPI service for the Smart Resume Screening & Candidate Ranking System.

Run from the project root:
    uvicorn api.main:app --reload --port 8000
Interactive docs: http://localhost:8000/docs
"""
import logging
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api import jobs, services
from api.config import get_settings
from api.schemas import (
    AnalyzeAccepted,
    CandidateOut,
    FailedCandidate,
    HealthOut,
    JobOut,
    JobProfileOut,
    SkippedFile,
    SummaryOut,
)

log = logging.getLogger("api")
VERSION = "2.0.0"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Load the Sentence Transformers model once at startup, not on the first request.
    if get_settings().preload_model:
        server_log = logging.getLogger("uvicorn.error")  # this logger is shown in the uvicorn terminal
        server_log.info("Loading the embedding model. The first run downloads it and can take a minute...")
        try:
            from src.matching.semantic_similarity import load_model

            load_model()
            server_log.info("Embedding model ready.")
        except Exception:  # noqa: BLE001
            log.exception("Could not preload the embedding model; it will load on first use")
    yield
    jobs.shutdown_executor()


app = FastAPI(
    title="Smart Resume Screening API",
    version=VERSION,
    description="Ranks PDF resumes against a job description. Scores are decision support, "
                "not hiring decisions.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    """Anything not handled below still returns readable JSON, and the traceback goes to the API terminal."""
    log.error("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=500,
        content={"detail": f"Unexpected server error ({type(exc).__name__}). Check the API terminal for details."},
    )


# ---------------------------------------------------------------- helpers

def _read_upload(upload: UploadFile) -> bytes:
    """Read an upload without loading more than the size limit into memory."""
    limit = get_settings().max_file_bytes
    data = upload.file.read(limit + 1)
    return data


def _job_description_text(job_description: Optional[str], jd_file: Optional[UploadFile]) -> str:
    """A job description PDF wins over pasted text when both are sent."""
    if jd_file is not None and jd_file.filename:
        try:
            return services.read_pdf(_read_upload(jd_file))
        except services.PdfError as exc:
            raise HTTPException(status_code=422, detail=f"Job description PDF: {exc}")
    if job_description and job_description.strip():
        return job_description
    raise HTTPException(status_code=422, detail="Please provide a Job Description (text or PDF).")


def _profile_out(profile, used_fallback: bool) -> JobProfileOut:
    return JobProfileOut(
        job_title=profile.job_title,
        required_skills=profile.required_skills,
        preferred_skills=profile.preferred_skills,
        minimum_experience_years=profile.minimum_experience_years,
        required_education=profile.required_education,
        used_skills_fallback=used_fallback,
    )


def _resolve_profile_or_502(job_description: str):
    try:
        return services.resolve_job_profile(job_description)
    except Exception:  # noqa: BLE001
        log.exception("Job profile extraction failed")
        raise HTTPException(
            status_code=502,
            detail="The job description could not be analyzed right now. Please try again.",
        )


def _get_job_or_404(job_id: str) -> jobs.Job:
    job = jobs.store.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return job


# ---------------------------------------------------------------- routes

@app.get("/api/health", response_model=HealthOut)
def health():
    return HealthOut(version=VERSION)


@app.post("/api/job-profile", response_model=JobProfileOut)
def preview_job_profile(
    job_description: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None),
):
    """Extract required/preferred skills so the user can review them before analyzing."""
    text = _job_description_text(job_description, jd_file)
    profile, used_fallback = _resolve_profile_or_502(text)
    return _profile_out(profile, used_fallback)


@app.post("/api/analyze", response_model=AnalyzeAccepted, status_code=202)
def start_analysis(
    job_description: Optional[str] = Form(None),
    jd_file: Optional[UploadFile] = File(None),
    resumes: list[UploadFile] = File(default=[]),
):
    """Validate the inputs and start a background analysis job."""
    settings = get_settings()
    text = _job_description_text(job_description, jd_file)

    uploads = [r for r in resumes if r.filename]
    if not uploads:
        raise HTTPException(status_code=422, detail="Please upload at least one resume.")
    if len(uploads) > settings.max_resumes:
        raise HTTPException(
            status_code=422,
            detail=f"Please upload at most {settings.max_resumes} resumes at a time.",
        )

    accepted: list[dict] = []
    skipped: list[dict] = []
    for upload in uploads:
        try:
            resume_text = services.read_pdf(_read_upload(upload))
        except services.PdfError as exc:
            skipped.append({"filename": upload.filename, "reason": str(exc)})
            continue
        accepted.append({
            "id": f"c{len(accepted) + 1}",
            "name": services.candidate_name_from_filename(upload.filename),
            "text": resume_text,
        })

    if not accepted:
        raise HTTPException(
            status_code=422,
            detail={"message": "No valid resumes could be analyzed.", "skipped": skipped},
        )

    profile, used_fallback = _resolve_profile_or_502(text)

    job = jobs.store.create(
        job_description=text,
        job_profile=profile,
        used_fallback=used_fallback,
        resumes=accepted,
        skipped=skipped,
    )
    jobs.submit(job)
    return AnalyzeAccepted(
        job_id=job.id,
        total=job.total,
        skipped=[SkippedFile(**s) for s in skipped],
    )


@app.get("/api/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str):
    """Poll this for progress; results appear once status is 'done'."""
    job = _get_job_or_404(job_id)
    with job.lock:
        results = [
            CandidateOut(**c, decision=services.decision_for(c["final_score"]))
            for c in job.results
        ]
        return JobOut(
            job_id=job.id,
            status=job.status,
            total=job.total,
            completed=job.completed,
            job_profile=_profile_out(job.job_profile, job.used_fallback),
            results=results,
            failed=[FailedCandidate(**f) for f in job.failed],
            skipped=[SkippedFile(**s) for s in job.skipped],
            error=job.error,
        )


@app.post("/api/jobs/{job_id}/candidates/{candidate_id}/summary", response_model=SummaryOut)
def candidate_summary(job_id: str, candidate_id: str):
    """Generate (once) the AI summary for one candidate."""
    job = _get_job_or_404(job_id)
    if job.status != "done":
        raise HTTPException(status_code=409, detail="The analysis is not finished yet.")
    if jobs.find_candidate(job, candidate_id) is None:
        raise HTTPException(status_code=404, detail="Candidate not found.")
    try:
        summary = jobs.get_or_create_summary(job, candidate_id)
    except Exception:  # noqa: BLE001
        log.exception("Summary generation failed for %s", candidate_id)
        raise HTTPException(
            status_code=502,
            detail="Candidate summary is temporarily unavailable.",
        )
    return SummaryOut(candidate_id=candidate_id, summary=summary or "")


@app.get("/api/jobs/{job_id}/export.csv")
def export_csv(job_id: str):
    """Ranking report in the same format as the Streamlit download."""
    job = _get_job_or_404(job_id)
    if job.status != "done":
        raise HTTPException(status_code=409, detail="The analysis is not finished yet.")
    with job.lock:
        body = services.to_csv(job.results)
    return Response(
        content=body,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="candidate_ranking.csv"'},
    )


@app.delete("/api/jobs/{job_id}", status_code=204)
def delete_job(job_id: str):
    """Remove a job and its resume text from memory."""
    if not jobs.store.delete(job_id):
        raise HTTPException(status_code=404, detail="Job not found or expired.")
    return Response(status_code=204)
