"""Tests for the FastAPI layer (api/).

Gemini, Sentence Transformers and the per-resume analysis are replaced with fixed values,
exactly like the rest of the suite, so these run offline and give the same result every time.
Scores are controlled by writing "SCORE=<number>" into each test resume's text.
"""
import io
import os
import re
import time

import pytest
from fastapi.testclient import TestClient
from reportlab.pdfgen import canvas

os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ["PRELOAD_MODEL"] = "0"

from conftest import make_result  # noqa: E402
from models.job_profile import JobProfile  # noqa: E402
from api import jobs, services  # noqa: E402
from api.main import app  # noqa: E402
from src.analysis.resume_analyzer import ResumeAnalyzer  # noqa: E402

PROFILE = JobProfile(
    job_title="Full-Stack Engineer",
    required_skills=["Python", "Git"],
    preferred_skills=["React"],
    minimum_experience_years=2,
)


def make_pdf(text: str) -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer)
    y = 800
    for line in text.split("\n"):
        pdf.drawString(50, y, line)
        y -= 18
    pdf.save()
    return buffer.getvalue()


def blank_pdf() -> bytes:
    buffer = io.BytesIO()
    pdf = canvas.Canvas(buffer)
    pdf.showPage()
    pdf.save()
    return buffer.getvalue()


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    """Replace every external call and reset shared state before each test."""
    services.clear_caches()
    jobs.store.clear()
    calls = {"profile": 0, "analyze": [], "summary": 0}

    def fake_profile(_jd):
        calls["profile"] += 1
        return PROFILE.model_copy(deep=True)

    def fake_analyze(self, **kwargs):
        calls["analyze"].append(kwargs)
        text = kwargs["resume_text"]
        if "FAIL" in text:
            raise RuntimeError("boom")
        score = float(re.search(r"SCORE=([\d.]+)", text).group(1))
        return make_result(score)

    def fake_summary(**kwargs):
        calls["summary"] += 1
        return "A factual summary."

    monkeypatch.setattr(services, "extract_job_profile", fake_profile)
    monkeypatch.setattr(ResumeAnalyzer, "analyze_resume", fake_analyze)
    monkeypatch.setattr(services, "generate_candidate_summary", fake_summary)
    return calls


@pytest.fixture
def client():
    return TestClient(app)


def post_analyze(client, resumes, jd="We need a Python developer."):
    files = [("resumes", (name, data, "application/pdf")) for name, data in resumes]
    return client.post("/api/analyze", data={"job_description": jd}, files=files)


def wait_done(client, job_id, timeout=10):
    deadline = time.time() + timeout
    while time.time() < deadline:
        body = client.get(f"/api/jobs/{job_id}").json()
        if body["status"] in ("done", "failed"):
            return body
        time.sleep(0.05)
    raise AssertionError("job did not finish")


# ---------------------------------------------------------------- basics

def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_job_profile_requires_a_job_description(client):
    response = client.post("/api/job-profile", data={"job_description": "   "})
    assert response.status_code == 422


def test_job_profile_returns_required_and_preferred_skills(client):
    body = client.post("/api/job-profile", data={"job_description": "Python dev"}).json()
    assert body["required_skills"] == ["Python", "Git"]
    assert body["preferred_skills"] == ["React"]
    assert body["used_skills_fallback"] is False


def test_job_profile_accepts_a_pdf(client):
    pdf = make_pdf("Senior Python developer")
    response = client.post("/api/job-profile", files={"jd_file": ("jd.pdf", pdf, "application/pdf")})
    assert response.status_code == 200


# ---------------------------------------------------------------- skills.txt fallback

def test_fallback_skills_are_used_and_flagged(client, monkeypatch):
    monkeypatch.setattr(
        services, "extract_job_profile",
        lambda _jd: JobProfile(required_skills=[], preferred_skills=[]),
    )
    monkeypatch.setattr(services, "get_skills_database", lambda: ["python", "docker"])
    body = client.post(
        "/api/job-profile", data={"job_description": "We use Python and Docker daily."}
    ).json()
    assert body["used_skills_fallback"] is True
    assert body["required_skills"] == ["python", "docker"]


def test_analysis_scores_with_the_same_skills_the_preview_showed(client, fakes, monkeypatch):
    """Regression test for the known UI/analyzer mismatch: the fallback list shown to the
    user must be the list passed to the analyzer."""
    monkeypatch.setattr(
        services, "extract_job_profile",
        lambda _jd: JobProfile(required_skills=[], preferred_skills=[]),
    )
    monkeypatch.setattr(services, "get_skills_database", lambda: ["python", "docker"])
    jd = "We use Python and Docker daily."

    shown = client.post("/api/job-profile", data={"job_description": jd}).json()["required_skills"]
    job_id = post_analyze(client, [("a.pdf", make_pdf("SCORE=70"))], jd=jd).json()["job_id"]
    wait_done(client, job_id)

    assert fakes["analyze"][0]["required_skills"] == shown == ["python", "docker"]


# ---------------------------------------------------------------- analysis

def test_ranking_order_ranks_and_decisions(client):
    resumes = [
        ("Low_One.pdf", make_pdf("SCORE=30")),
        ("Top_One.pdf", make_pdf("SCORE=88.5")),
        ("Mid_One.pdf", make_pdf("SCORE=65")),
    ]
    accepted = post_analyze(client, resumes)
    assert accepted.status_code == 202
    body = wait_done(client, accepted.json()["job_id"])

    assert body["status"] == "done"
    assert [c["candidate_name"] for c in body["results"]] == ["Top One", "Mid One", "Low One"]
    assert [c["rank"] for c in body["results"]] == [1, 2, 3]
    assert [c["decision"] for c in body["results"]] == ["Interview", "Consider", "Low Match"]
    assert body["completed"] == body["total"] == 3


def test_ties_keep_upload_order(client):
    resumes = [("A.pdf", make_pdf("SCORE=50")), ("B.pdf", make_pdf("SCORE=50"))]
    body = wait_done(client, post_analyze(client, resumes).json()["job_id"])
    assert [c["candidate_name"] for c in body["results"]] == ["A", "B"]


def test_duplicate_file_names_get_distinct_ids(client):
    resumes = [("Same.pdf", make_pdf("SCORE=60")), ("Same.pdf", make_pdf("SCORE=40"))]
    body = wait_done(client, post_analyze(client, resumes).json()["job_id"])
    ids = [c["candidate_id"] for c in body["results"]]
    assert len(set(ids)) == 2


def test_one_failing_resume_does_not_stop_the_others(client):
    resumes = [("Good.pdf", make_pdf("SCORE=75")), ("Bad.pdf", make_pdf("FAIL"))]
    body = wait_done(client, post_analyze(client, resumes).json()["job_id"])
    assert body["status"] == "done"
    assert [c["candidate_name"] for c in body["results"]] == ["Good"]
    assert body["failed"][0]["candidate_name"] == "Bad"
    assert body["completed"] == 2


def test_job_fails_when_every_resume_fails(client):
    body = wait_done(client, post_analyze(client, [("Bad.pdf", make_pdf("FAIL"))]).json()["job_id"])
    assert body["status"] == "failed"
    assert body["error"]


def test_result_shape_matches_the_analysis_model(client):
    body = wait_done(client, post_analyze(client, [("A.pdf", make_pdf("SCORE=70"))]).json()["job_id"])
    candidate = body["results"][0]
    for key in ("final_score", "jd_similarity_score", "skills_match_score", "matched_skills",
                "missing_skills", "required_skills_count", "candidate_id", "decision", "rank"):
        assert key in candidate


# ---------------------------------------------------------------- input validation

def test_requires_a_job_description(client):
    response = client.post(
        "/api/analyze", files=[("resumes", ("a.pdf", make_pdf("SCORE=1"), "application/pdf"))]
    )
    assert response.status_code == 422


def test_requires_at_least_one_resume(client):
    response = client.post("/api/analyze", data={"job_description": "Python developer"})
    assert response.status_code == 422


def test_non_pdf_files_are_skipped_not_fatal(client):
    resumes = [("good.pdf", make_pdf("SCORE=70")), ("notes.pdf", b"this is plain text")]
    accepted = post_analyze(client, resumes).json()
    assert accepted["total"] == 1
    assert accepted["skipped"][0]["filename"] == "notes.pdf"


def test_scanned_pdf_is_skipped_with_a_clear_reason(client):
    accepted = post_analyze(client, [("ok.pdf", make_pdf("SCORE=70")), ("scan.pdf", blank_pdf())]).json()
    assert accepted["total"] == 1
    assert "scanned" in accepted["skipped"][0]["reason"].lower()


def test_all_invalid_resumes_is_an_error(client):
    response = post_analyze(client, [("x.pdf", b"nope")])
    assert response.status_code == 422
    assert response.json()["detail"]["skipped"][0]["filename"] == "x.pdf"


def test_oversized_file_is_rejected(client, monkeypatch):
    monkeypatch.setenv("MAX_FILE_MB", "1")
    big = make_pdf("SCORE=1") + b"0" * (1024 * 1024 + 10)
    response = post_analyze(client, [("big.pdf", big)])
    assert response.status_code == 422


def test_too_many_resumes_is_rejected(client, monkeypatch):
    monkeypatch.setenv("MAX_RESUMES", "2")
    resumes = [(f"r{i}.pdf", make_pdf("SCORE=1")) for i in range(3)]
    assert post_analyze(client, resumes).status_code == 422


# ---------------------------------------------------------------- summary, export, delete

def test_summary_is_generated_once_and_cached(client, fakes):
    job_id = post_analyze(client, [("A.pdf", make_pdf("SCORE=70"))]).json()["job_id"]
    wait_done(client, job_id)

    first = client.post(f"/api/jobs/{job_id}/candidates/c1/summary")
    second = client.post(f"/api/jobs/{job_id}/candidates/c1/summary")
    assert first.json()["summary"] == second.json()["summary"] == "A factual summary."
    assert fakes["summary"] == 1
    assert client.get(f"/api/jobs/{job_id}").json()["results"][0]["candidate_summary"] == "A factual summary."


def test_summary_failure_returns_a_clear_error(client, monkeypatch):
    def boom(**_):
        raise RuntimeError("gemini down")

    monkeypatch.setattr(services, "generate_candidate_summary", boom)
    job_id = post_analyze(client, [("A.pdf", make_pdf("SCORE=70"))]).json()["job_id"]
    wait_done(client, job_id)
    response = client.post(f"/api/jobs/{job_id}/candidates/c1/summary")
    assert response.status_code == 502
    assert "temporarily unavailable" in response.json()["detail"]


def test_summary_unknown_candidate_and_job(client):
    job_id = post_analyze(client, [("A.pdf", make_pdf("SCORE=70"))]).json()["job_id"]
    wait_done(client, job_id)
    assert client.post(f"/api/jobs/{job_id}/candidates/zzz/summary").status_code == 404
    assert client.post("/api/jobs/nope/candidates/c1/summary").status_code == 404


def test_csv_export_matches_the_streamlit_format(client):
    resumes = [("Top_One.pdf", make_pdf("SCORE=88.5")), ("Low_One.pdf", make_pdf("SCORE=30"))]
    job_id = post_analyze(client, resumes).json()["job_id"]
    wait_done(client, job_id)

    response = client.get(f"/api/jobs/{job_id}/export.csv")
    lines = response.text.strip().splitlines()
    assert response.headers["content-type"].startswith("text/csv")
    assert lines[0] == "Rank,Candidate,Final Score,Decision"
    assert lines[1] == "🥇 1,Top One,88.50%,Interview"
    assert lines[2] == "🥈 2,Low One,30.00%,Low Match"


def test_csv_neutralises_spreadsheet_formulas():
    csv_text = services.to_csv([{"rank": 1, "candidate_name": "=cmd", "final_score": 50.0}])
    assert "'=cmd" in csv_text


def test_export_before_the_job_is_done_is_a_conflict(client):
    job = jobs.store.create(
        job_description="x", job_profile=PROFILE, used_fallback=False,
        resumes=[{"id": "c1", "name": "A", "text": "t"}], skipped=[],
    )
    assert client.get(f"/api/jobs/{job.id}/export.csv").status_code == 409


def test_delete_removes_the_job(client):
    job_id = post_analyze(client, [("A.pdf", make_pdf("SCORE=70"))]).json()["job_id"]
    wait_done(client, job_id)
    assert client.delete(f"/api/jobs/{job_id}").status_code == 204
    assert client.get(f"/api/jobs/{job_id}").status_code == 404
    assert client.delete(f"/api/jobs/{job_id}").status_code == 404


def test_expired_jobs_are_pruned(client, monkeypatch):
    job = jobs.store.create(
        job_description="x", job_profile=PROFILE, used_fallback=False,
        resumes=[{"id": "c1", "name": "A", "text": "t"}], skipped=[],
    )
    job.created_at -= 3 * 3600
    jobs.store.prune()
    assert jobs.store.get(job.id) is None
