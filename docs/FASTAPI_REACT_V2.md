# FastAPI + React version (v2)

A second front end for the same screening engine. The Streamlit app (`app.py`) is unchanged and
still works; this version reuses `src/` and `models/` exactly as they are.

```
React (Vite, TypeScript, Tailwind)  ──/api──▶  FastAPI (api/)  ──▶  ResumeAnalyzer, llm_extractor, ...
        frontend/                              background jobs        (your existing src/ and models/)
```

## Run it

**Two terminals (development)**

```bash
# 1) API  (from the project root; needs GEMINI_API_KEY in .env)
pip install -r api/requirements.txt
uvicorn api.main:app --reload --port 8000        # docs at http://localhost:8000/docs

# 2) Frontend
cd frontend
npm install
npm run dev                                       # http://localhost:5173 (proxies /api to :8000)
```

**Docker**

```bash
cp .env.example .env      # add your GEMINI_API_KEY
docker compose up --build # app on http://localhost:8080
```

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/job-profile` | Extract required/preferred skills (text or PDF) so they can be reviewed first |
| POST | `/api/analyze` | Validate inputs and start a background job. Returns `202` and a `job_id` |
| GET | `/api/jobs/{id}` | Poll progress; includes ranked results when `status` is `done` |
| POST | `/api/jobs/{id}/candidates/{cid}/summary` | Generate the AI summary for one candidate (once, then cached) |
| GET | `/api/jobs/{id}/export.csv` | Ranking report, same format as the Streamlit download |
| DELETE | `/api/jobs/{id}` | Remove the job and its resume text from memory |
| GET | `/api/health` | Liveness check |

## Design decisions

- **Background jobs.** Each resume needs several Gemini calls, so `/api/analyze` returns immediately and the
  React app polls. Progress is per resume (`completed` / `total`).
- **One resume at a time by default** (`ANALYSIS_WORKERS=1`), matching the Streamlit app. Raise it to 2-3 for
  speed once you have checked your Gemini rate limits.
- **A failing resume does not stop the batch.** It is reported under `failed`; the rest are ranked.
- **`skills.txt` fallback is resolved in one place** (`api/services.py::resolve_job_profile`). The preview and
  the scoring use the same list, so what the user sees is what is scored.
- **`analyze_multiple_resumes` is reused, not copied.** The API calls it once per resume (to get progress) and
  then sorts and ranks the results, so scoring logic stays in one place.
- **CSV format is identical** to the Streamlit export (medal ranks, `82.72%`), so
  `bias_audit/analyze_bias.py` works on exports from either app. Cells that start with `= + - @` are prefixed
  with `'` so a crafted file name cannot run as a spreadsheet formula.

## Limits to know about

- Jobs and resume text live **in memory** on one server process. They are lost on restart and expire after
  `JOB_TTL_MINUTES`. Nothing is written to disk. To scale out, replace `api/jobs.py` with Redis or PostgreSQL
  and a task queue.
- There is **no authentication or rate limiting**. Put the API behind your own auth before exposing it publicly,
  since every analysis spends Gemini quota and resumes contain personal data.
- Resume text is sent to the Gemini API, as in the Streamlit version. Say so in your README.
- The 30/50/20 weights and all scoring come from `src/`; the API does not change them.

## Tests

```bash
GEMINI_API_KEY=test pytest tests/test_api.py -q       # or: pytest tests -q
```

`tests/test_api.py` mocks Gemini and the embedding model like the rest of the suite. In CI, set a dummy
`GEMINI_API_KEY` (importing `llm_extractor` fails without one) and `pip install -r api/requirements.txt`.
The frontend has a UI test (`cd frontend && npm test`) that drives the whole screen in a simulated browser: job description, uploads, skill preview, progress polling, results, summary generation, tabs and clearing. `npm run build` runs the TypeScript type-check plus the production build.
