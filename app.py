import html
import os

import pandas as pd
import streamlit as st

from src.analysis.resume_analyzer import ResumeAnalyzer
from src.analysis.llm_extractor import (
    extract_job_profile,
    generate_candidate_summary,
)
from src.parsers.pdf_extractor import extract_text_from_pdf
from src.matching.skill_extractor import extract_skills, load_skills

# set_page_config must be the first Streamlit call, so it now sits above the cached helpers.
st.set_page_config(
    page_title="Smart Resume Screening Tool",
    page_icon="📄",
    layout="wide",
)


@st.cache_data
def get_skills_database():
    return load_skills("data/skills.txt")


@st.cache_data
def get_job_profile(job_description):
    return extract_job_profile(job_description)


skills_database = get_skills_database()

if "analysis_results" not in st.session_state:
    st.session_state.analysis_results = None
if "analysis_resume_texts" not in st.session_state:
    st.session_state.analysis_resume_texts = {}
if "analysis_job_description" not in st.session_state:
    st.session_state.analysis_job_description = ""

# --------------------------------------------------
# Design system (presentation only)
# --------------------------------------------------

st.markdown(
    """
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

    :root {
        --bg: #F5F7FB;
        --surface: #FFFFFF;
        --surface-2: #F8FAFC;
        --border: #E4E8F0;
        --border-strong: #CBD3E1;
        --table-border: #D5DBE7;
        --ink: #0F172A;
        --text-primary: #0F172A;
        --text-secondary: #5B6577;
        --text-muted: #8792A6;
        --accent: #059669;
        --accent-dark: #047857;
        --accent-soft: #ECFDF5;
        --accent-ring: #A7F3D0;
        --success: #059669;
        --success-bg: #ECFDF5;
        --info: #2563EB;
        --info-bg: #EFF6FF;
        --warn: #B45309;
        --warn-bg: #FFFBEB;
        --danger: #DC2626;
        --danger-bg: #FEF2F2;
    }

    /* ---------- Base ---------- */
    .stApp {
        background: var(--bg);
        font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    button, input, textarea { font-family: inherit; }
    .block-container {
        max-width: 1240px;
        padding-top: 1.4rem !important;
        padding-bottom: 3rem !important;
    }
    header[data-testid="stHeader"] { background: transparent; }
    #MainMenu, footer { visibility: hidden; }
    h1, h2, h3, h4 {
        font-family: 'Sora', sans-serif !important;
        color: var(--text-primary) !important;
    }
    [data-testid="stAlert"] { border-radius: 12px; }
    [data-testid="stCaptionContainer"],
    [data-testid="stCaptionContainer"] * { color: var(--text-secondary) !important; }

    /* ---------- Sidebar ---------- */
    section[data-testid="stSidebar"] {
        background: #0B1220 !important;
        border-right: 1px solid #1B2740;
    }
    section[data-testid="stSidebar"] > div:first-child { background: transparent !important; }
    .sb-brand { display: flex; align-items: center; gap: 0.7rem; margin-bottom: 1.2rem; }
    .sb-brand-name {
        font-family: 'Sora', sans-serif; font-weight: 700; font-size: 0.98rem;
        color: #F8FAFC; line-height: 1.2;
    }
    .sb-brand-sub { font-size: 0.74rem; color: #94A3B8; }
    .sb-label {
        font-size: 0.68rem; font-weight: 700; letter-spacing: 0.14em;
        text-transform: uppercase; color: #64748B; margin: 1.3rem 0 0.65rem;
    }
    .sb-step {
        display: flex; gap: 0.7rem; align-items: flex-start;
        margin-bottom: 0.65rem; color: #CBD5E1; font-size: 0.86rem; line-height: 1.45;
    }
    .sb-num {
        flex: 0 0 22px; height: 22px; border-radius: 50%;
        background: #12343A; color: #6EE7B7; border: 1px solid #1F5A52;
        display: grid; place-items: center; font-size: 0.72rem; font-weight: 700;
    }
    .sb-card {
        background: #111B2E; border: 1px solid #1E2B45; border-radius: 12px;
        padding: 0.85rem 0.95rem; color: #CBD5E1; font-size: 0.83rem; line-height: 1.55;
    }
    .sb-card b { color: #F1F5F9; }
    .sb-legend-row {
        display: flex; align-items: center; gap: 0.6rem;
        color: #CBD5E1; font-size: 0.84rem; margin-bottom: 0.45rem;
    }
    .sb-dot { width: 9px; height: 9px; border-radius: 50%; flex: 0 0 9px; }
    .sb-note { margin-top: 1.3rem; font-size: 0.75rem; color: #7C8AA3; line-height: 1.5; }

    /* ---------- Top bar ---------- */
    .topbar {
        display: flex; align-items: center; justify-content: space-between;
        gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;
    }
    .brand { display: flex; align-items: center; gap: 0.75rem; }
    .logo {
        width: 40px; height: 40px; border-radius: 11px;
        background: linear-gradient(135deg, #10B981, #047857);
        display: grid; place-items: center; color: #FFFFFF;
        font-family: 'Sora', sans-serif; font-weight: 800; font-size: 1.1rem;
        box-shadow: 0 6px 16px rgba(5, 150, 105, 0.35);
    }
    .brand-name { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 1.05rem; color: var(--ink); }
    .brand-sub { font-size: 0.78rem; color: var(--text-secondary); }
    .topbar-chips { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .chip {
        background: #FFFFFF; border: 1px solid var(--border); color: var(--text-secondary);
        padding: 0.3rem 0.75rem; border-radius: 999px; font-size: 0.74rem; font-weight: 600;
    }

    /* ---------- Hero ---------- */
    .hero {
        position: relative; overflow: hidden;
        background:
            radial-gradient(900px 300px at 88% -20%, rgba(16, 185, 129, 0.38), transparent 60%),
            linear-gradient(135deg, #0B1220 0%, #0F172A 55%, #11302A 100%);
        border-radius: 20px; padding: 2.2rem 2.4rem; margin-bottom: 1.25rem;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.18);
    }
    .hero .eyebrow {
        display: inline-block; color: #6EE7B7; font-size: 0.74rem; font-weight: 700;
        letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.6rem;
    }
    .hero h1 {
        color: #FFFFFF !important; font-size: 2rem; font-weight: 800;
        line-height: 1.2; margin: 0 0 0.6rem 0;
    }
    .hero p {
        color: rgba(226, 232, 240, 0.88) !important; font-size: 1rem;
        max-width: 740px; line-height: 1.6; margin: 0;
    }
    .hero-pills { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 1.1rem; }
    .hero-pill {
        background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.18);
        color: #E2E8F0; padding: 0.3rem 0.8rem; border-radius: 999px;
        font-size: 0.78rem; font-weight: 500;
    }

    /* ---------- Stepper ---------- */
    .stepper {
        display: flex; align-items: center; background: #FFFFFF;
        border: 1px solid var(--border); border-radius: 14px;
        padding: 0.9rem 1.2rem; margin-bottom: 1.25rem;
        box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    }
    .step { display: flex; align-items: center; gap: 0.6rem; flex: 0 0 auto; }
    .step-dot {
        width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
        font-size: 0.8rem; font-weight: 700; background: #FFFFFF;
        border: 2px solid var(--border-strong); color: var(--text-muted);
    }
    .step-label { font-size: 0.86rem; font-weight: 600; color: var(--text-muted); }
    .step.done .step-dot { background: var(--accent); border-color: var(--accent); color: #FFFFFF; }
    .step.done .step-label, .step.active .step-label { color: var(--ink); }
    .step.active .step-dot {
        border-color: var(--accent); color: var(--accent-dark);
        box-shadow: 0 0 0 4px var(--accent-ring);
    }
    .step-line { flex: 1; height: 2px; background: var(--border); margin: 0 0.8rem; min-width: 16px; }
    .step-line.done { background: var(--accent); }
    @media (max-width: 700px) { .step-label { display: none; } }

    /* ---------- Cards (native bordered containers) ---------- */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        background: var(--surface) !important;
        border: 1px solid var(--border) !important;
        border-radius: 16px !important;
        box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 6px 18px rgba(16, 24, 40, 0.03);
        margin-bottom: 1.2rem;
    }
    div[data-testid="stVerticalBlockBorderWrapper"] div[data-testid="stVerticalBlockBorderWrapper"] {
        background: #F7FBF9 !important;
        border: 1px solid #D1F0E2 !important;
        border-radius: 12px !important;
        box-shadow: none;
        margin-bottom: 0.9rem;
    }
    div[data-testid="stVerticalBlockBorderWrapper"] [data-testid="stMarkdownContainer"] p,
    div[data-testid="stVerticalBlockBorderWrapper"] [data-testid="stMarkdownContainer"] li {
        color: var(--text-primary);
    }

    .section-header { display: flex; align-items: center; gap: 0.75rem; margin: 0.1rem 0 0.9rem; }
    .sec-icon {
        width: 36px; height: 36px; border-radius: 10px; background: var(--accent-soft);
        display: grid; place-items: center; font-size: 1.05rem; flex: 0 0 36px;
    }
    .sec-title { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 1.12rem; color: var(--ink); }
    .sec-sub { font-size: 0.82rem; color: var(--text-secondary); margin-top: 1px; }
    .mini-title {
        display: flex; align-items: center; gap: 0.45rem; margin: 0.5rem 0 0.5rem;
        font-family: 'Sora', sans-serif; font-weight: 700; font-size: 0.96rem; color: var(--ink);
    }

    /* ---------- Buttons ---------- */
    div.stButton > button {
        background: var(--accent); color: #FFFFFF; border: none; border-radius: 12px;
        padding: 0.8rem 1.5rem; font-weight: 600; font-size: 1rem;
        transition: all 0.15s ease; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.22);
    }
    div.stButton > button:hover {
        background: var(--accent-dark); color: #FFFFFF; transform: translateY(-1px);
        box-shadow: 0 8px 20px rgba(5, 150, 105, 0.3);
    }
    div.stButton > button p { color: #FFFFFF !important; }
    div.stDownloadButton > button {
        background: var(--surface); color: var(--accent-dark); border: 1.5px solid var(--accent);
        border-radius: 12px; font-weight: 600; padding: 0.6rem 1.2rem;
    }
    div.stDownloadButton > button p { color: var(--accent-dark) !important; }
    div.stDownloadButton > button:hover { background: var(--accent-soft); }

    /* ---------- Theme-independent form readability ---------- */
    [data-testid="stWidgetLabel"] p,
    [data-testid="stWidgetLabel"] label { color: var(--text-primary) !important; font-weight: 600; }
    .stRadio [data-testid="stMarkdownContainer"] p { color: var(--text-primary) !important; }
    .stTextArea textarea {
        border-radius: 12px !important; border: 1px solid var(--border-strong) !important;
        background: var(--surface) !important; color: var(--text-primary) !important;
    }
    .stTextArea textarea:focus {
        border-color: var(--accent) !important; box-shadow: 0 0 0 3px var(--accent-ring) !important;
    }
    .stTextArea textarea::placeholder { color: var(--text-muted) !important; opacity: 1 !important; }
    div[data-testid="stFileUploaderDropzone"] {
        border-radius: 12px !important; background: var(--surface-2) !important;
        border: 1.5px dashed var(--border-strong) !important;
    }
    div[data-testid="stFileUploaderDropzone"]:hover { border-color: var(--accent) !important; }
    div[data-testid="stFileUploaderDropzone"] section,
    div[data-testid="stFileUploaderDropzone"] div,
    div[data-testid="stFileUploaderDropzone"] span,
    div[data-testid="stFileUploaderDropzone"] small { color: var(--text-primary) !important; }
    div[data-testid="stFileUploaderDropzone"] button {
        background: var(--accent) !important; color: #FFFFFF !important;
        border: none !important; border-radius: 8px !important;
    }
    div[data-testid="stFileUploaderDropzone"] button:hover { background: var(--accent-dark) !important; }
    [data-testid="stFileUploaderFile"],
    [data-testid="stFileUploaderFile"] *,
    [data-testid="stFileUploaderFileName"] { color: var(--text-primary) !important; }

    /* ---------- Tabs ---------- */
    button[data-baseweb="tab"] p { color: var(--text-secondary) !important; font-weight: 600; }
    button[data-baseweb="tab"][aria-selected="true"] p { color: var(--accent-dark) !important; }
    [data-baseweb="tab-highlight"] { background-color: var(--accent) !important; }
    [data-baseweb="tab-border"] { background-color: var(--border) !important; }

    /* ---------- Expanders (candidate cards) ---------- */
    div[data-testid="stExpander"] {
        border: 1px solid var(--border) !important; border-radius: 14px !important;
        background: var(--surface) !important; margin-bottom: 0.7rem; overflow: hidden;
    }
    div[data-testid="stExpander"] summary,
    div[data-testid="stExpander"] summary p,
    div[data-testid="stExpander"] summary span,
    div[data-testid="stExpander"] summary div { color: var(--text-primary) !important; font-weight: 600; }
    div[data-testid="stExpander"] summary:hover { background: var(--surface-2); }
    div[data-testid="stExpander"] details,
    div[data-testid="stExpander"] div[data-testid="stExpanderDetails"] { background: var(--surface) !important; }
    div[data-testid="stExpander"] [data-testid="stMarkdownContainer"] p { color: var(--text-primary) !important; }

    /* ---------- KPI cards ---------- */
    .kpi-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem; margin: 0 0 1.2rem;
    }
    .kpi {
        background: #FFFFFF; border: 1px solid var(--border); border-radius: 16px;
        padding: 1.05rem 1.2rem; box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
    }
    .kpi-label {
        font-size: 0.74rem; font-weight: 700; color: var(--text-secondary);
        text-transform: uppercase; letter-spacing: 0.06em;
    }
    .kpi-value {
        font-family: 'Sora', sans-serif; font-weight: 800; font-size: 1.75rem;
        color: var(--ink); margin-top: 0.25rem;
    }
    .kpi-sub {
        font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.15rem;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ---------- Ranking table ---------- */
    .table-wrap { overflow-x: auto; border: 1px solid var(--table-border); border-radius: 14px; }
    .ranking-table { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
    .ranking-table thead th {
        background: var(--ink); color: #FFFFFF; text-align: left; padding: 0.8rem 1rem;
        font-family: 'Sora', sans-serif; font-weight: 600; font-size: 0.78rem;
        letter-spacing: 0.05em; text-transform: uppercase;
        border-right: 1px solid rgba(255, 255, 255, 0.14);
    }
    .ranking-table thead th:last-child { border-right: none; }
    .ranking-table tbody td {
        padding: 0.75rem 1rem; border-bottom: 1px solid var(--table-border);
        border-right: 1px solid var(--table-border); background: #FFFFFF;
        color: var(--text-primary); vertical-align: middle;
    }
    .ranking-table tbody td:last-child { border-right: none; }
    .ranking-table tbody tr:last-child td { border-bottom: none; }
    .ranking-table tbody tr:nth-child(even) td { background: #F8FAFC; }
    .ranking-table tbody tr:hover td { background: var(--accent-soft); }
    .rank-cell { font-weight: 700; white-space: nowrap; }
    .cand-cell { display: flex; align-items: center; gap: 0.65rem; font-weight: 600; }
    .avatar {
        width: 30px; height: 30px; border-radius: 50%; background: var(--accent-soft);
        color: var(--accent-dark); display: grid; place-items: center;
        font-size: 0.74rem; font-weight: 700; flex: 0 0 30px; border: 1px solid var(--accent-ring);
    }
    .score-cell { min-width: 150px; }
    .score-num { font-weight: 700; }
    .mini-track { background: #E8EBF3; border-radius: 999px; height: 6px; margin-top: 0.3rem; overflow: hidden; }
    .mini-fill { height: 100%; border-radius: 999px; }
    .decision-badge {
        display: inline-block; padding: 0.28rem 0.75rem; border-radius: 999px;
        font-size: 0.78rem; font-weight: 700;
    }

    /* ---------- Loading state ---------- */
    .analyzing-status {
        display: flex; flex-direction: column; gap: 0.6rem; padding: 0.95rem 1.2rem;
        background: var(--accent-soft); border: 1px solid var(--accent-ring);
        color: #065F46; border-radius: 12px; font-weight: 600; width: 100%; box-sizing: border-box;
    }
    .analyzing-row { display: flex; align-items: center; justify-content: center; gap: 0.7rem; }
    .analyzing-sub { font-size: 0.8rem; font-weight: 500; color: var(--accent-dark); text-align: center; }
    .loading-spinner {
        width: 20px; height: 20px; border: 3px solid #A7F3D0; border-top-color: var(--accent);
        border-radius: 50%; animation: resume-spin 0.8s linear infinite; flex-shrink: 0;
    }
    .analyzing-bar { height: 5px; border-radius: 99px; background: #BBF7D0; overflow: hidden; position: relative; }
    .analyzing-bar::after {
        content: ""; position: absolute; top: 0; bottom: 0; left: 0; width: 35%;
        background: linear-gradient(90deg, transparent, var(--accent), transparent);
        animation: resume-slide 1.2s ease-in-out infinite;
    }
    @keyframes resume-spin { to { transform: rotate(360deg); } }
    @keyframes resume-slide { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }

    /* ---------- Score ring, bars, tiles ---------- */
    .ring-wrap { display: flex; flex-direction: column; align-items: center; gap: 0.7rem; padding: 0.2rem 0; }
    .ring {
        width: 124px; height: 124px; border-radius: 50%;
        background: conic-gradient(var(--c) calc(var(--p) * 1%), #E8EBF3 0);
        display: grid; place-items: center;
    }
    .ring-inner {
        width: 96px; height: 96px; border-radius: 50%; background: #FFFFFF;
        display: flex; flex-direction: column; align-items: center; justify-content: center;
    }
    .ring-val { font-family: 'Sora', sans-serif; font-weight: 800; font-size: 1.45rem; color: var(--ink); line-height: 1.1; }
    .ring-val span { font-size: 0.85rem; font-weight: 700; color: var(--text-secondary); }
    .ring-cap { font-size: 0.68rem; color: var(--text-secondary); font-weight: 600; margin-top: 2px; }
    .score-row { margin-bottom: 0.9rem; }
    .score-row .score-label-row {
        display: flex; justify-content: space-between; font-size: 0.85rem;
        color: var(--text-secondary); margin-bottom: 0.3rem; font-weight: 500;
    }
    .score-track { background: #E8EBF3; border-radius: 999px; height: 9px; overflow: hidden; }
    .score-fill { height: 100%; border-radius: 999px; }
    .tile-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap: 0.8rem; margin: 0.4rem 0 1rem;
    }
    .tile { background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 0.85rem 1rem; }
    .tile-label { font-size: 0.76rem; color: var(--text-secondary); font-weight: 600; }
    .tile-value { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 1.35rem; color: var(--ink); margin-top: 0.2rem; }

    /* ---------- Skill pills ---------- */
    .pill-row { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0.2rem 0 0.4rem; }
    .pill {
        display: inline-flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.7rem;
        border-radius: 999px; font-size: 0.79rem; font-weight: 600; border: 1px solid transparent;
    }
    .pill.ok, .pill.req { color: #047857; background: #ECFDF5; border-color: #A7F3D0; }
    .pill.bad { color: #B91C1C; background: #FEF2F2; border-color: #FECACA; }
    .pill.pref { color: #1D4ED8; background: #EFF6FF; border-color: #BFDBFE; }
    .pill-empty { color: var(--text-secondary); font-size: 0.85rem; }

    /* ---------- Empty state ---------- */
    .empty-state {
        background: #FFFFFF; border: 1.5px dashed var(--border-strong);
        border-radius: 18px; padding: 2rem 1.5rem; text-align: center;
    }
    .empty-title { font-family: 'Sora', sans-serif; font-weight: 700; font-size: 1.15rem; color: var(--ink); }
    .empty-sub { color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.3rem; }
    .feature-grid {
        display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1rem; margin-top: 1.4rem; text-align: left;
    }
    .feature {
        background: var(--surface-2); border: 1px solid var(--border);
        border-radius: 14px; padding: 1rem 1.1rem;
    }
    .feature-title { font-weight: 700; font-size: 0.92rem; color: var(--ink); }
    .feature-text { font-size: 0.84rem; color: var(--text-secondary); margin-top: 0.3rem; line-height: 1.5; }

    /* ---------- Footer ---------- */
    .site-footer {
        margin-top: 2.5rem; padding: 1.4rem 0 0.5rem; border-top: 1px solid var(--border);
        text-align: center; color: var(--text-secondary); font-size: 0.85rem; line-height: 1.7;
    }
    .site-footer .note { font-size: 0.78rem; color: var(--text-muted); }
    </style>
    """,
    unsafe_allow_html=True,
)

# --------------------------------------------------
# Presentation helpers (display only, no logic change)
# --------------------------------------------------


def _compact(markup: str) -> str:
    """Collapse HTML to one line so Streamlit's markdown parser never splits the block
    on a blank line or treats indented lines as code."""
    return " ".join(line.strip() for line in markup.splitlines() if line.strip())


def html_block(markup: str):
    st.markdown(_compact(markup), unsafe_allow_html=True)


def section_header(icon: str, title: str, subtitle: str = ""):
    sub = f"<div class='sec-sub'>{html.escape(subtitle)}</div>" if subtitle else ""
    html_block(
        f"""
        <div class="section-header">
            <div class="sec-icon">{icon}</div>
            <div><div class="sec-title">{html.escape(title)}</div>{sub}</div>
        </div>
        """
    )


def mini_title(icon: str, text: str):
    html_block(
        f"<div class='mini-title'><span>{icon}</span><span>{html.escape(text)}</span></div>"
    )


def decision_style(decision: str):
    mapping = {
        "Interview": ("#047857", "#ECFDF5"),  # Green
        "Consider": ("#1D4ED8", "#EFF6FF"),   # Blue
        "Review": ("#B45309", "#FFFBEB"),     # Amber
        "Low Match": ("#B91C1C", "#FEF2F2"),  # Red
    }
    return mapping.get(decision, ("var(--text-secondary)", "#F0F1F4"))


def decision_for(score: float) -> str:
    if score >= 80:
        return "Interview"
    if score >= 60:
        return "Consider"
    if score >= 40:
        return "Review"
    return "Low Match"


def score_style(value: float):
    if value >= 80:
        return "var(--success)"
    if value >= 40:
        return "var(--warn)"
    return "var(--danger)"


def render_score_bar(label: str, value: float):
    color = score_style(value)
    pct = max(0, min(value, 100))
    html_block(
        f"""
        <div class="score-row">
            <div class="score-label-row">
                <span>{html.escape(label)}</span>
                <span style="font-weight:700; color:{color};">{value:.2f}%</span>
            </div>
            <div class="score-track">
                <div class="score-fill" style="width:{pct}%; background:{color};"></div>
            </div>
        </div>
        """
    )


def render_score_ring(value: float, decision: str):
    color = score_style(value)
    d_color, d_bg = decision_style(decision)
    pct = max(0, min(value, 100))
    html_block(
        f"""
        <div class="ring-wrap">
            <div class="ring" style="--p:{pct:.2f}; --c:{color};">
                <div class="ring-inner">
                    <div class="ring-val">{value:.1f}<span>%</span></div>
                    <div class="ring-cap">Final score</div>
                </div>
            </div>
            <span class="decision-badge" style="color:{d_color}; background:{d_bg};">{html.escape(decision)}</span>
        </div>
        """
    )


def render_skill_pills(skills, matched: bool):
    if not skills:
        html_block("<div class='pill-row'><span class='pill-empty'>None</span></div>")
        return
    cls = "ok" if matched else "bad"
    icon = "✓" if matched else "✕"
    pills = "".join(
        f"<span class='pill {cls}'>{icon} {html.escape(str(skill))}</span>"
        for skill in skills
    )
    html_block(f"<div class='pill-row'>{pills}</div>")


def render_tag_pills(skills, tone: str):
    pills = "".join(
        f"<span class='pill {tone}'>{html.escape(str(skill))}</span>" for skill in skills
    )
    html_block(f"<div class='pill-row'>{pills}</div>")


def render_tiles(items):
    tiles = "".join(
        f"<div class='tile'><div class='tile-label'>{html.escape(label)}</div>"
        f"<div class='tile-value'>{html.escape(value)}</div></div>"
        for label, value in items
    )
    html_block(f"<div class='tile-grid'>{tiles}</div>")


def render_stepper(placeholder, has_jd: bool, has_resumes: bool, has_results: bool):
    labels = ["Job Description", "Resumes", "Analyze", "Results"]
    done = [has_jd, has_resumes, has_results]
    current = next((i for i, d in enumerate(done) if not d), 3)
    parts = []
    for i, label in enumerate(labels):
        if i < 3 and done[i]:
            state = "done"
        elif i == current:
            state = "active"
        else:
            state = "todo"
        dot = "✓" if state == "done" else str(i + 1)
        parts.append(
            f"<div class='step {state}'><span class='step-dot'>{dot}</span>"
            f"<span class='step-label'>{label}</span></div>"
        )
        if i < len(labels) - 1:
            parts.append(f"<div class='step-line {'done' if state == 'done' else ''}'></div>")
    placeholder.markdown(
        _compact(f"<div class='stepper'>{''.join(parts)}</div>"),
        unsafe_allow_html=True,
    )


def render_kpis(results):
    if not results:
        return
    scores = [c["final_score"] for c in results]
    top = max(results, key=lambda c: c["final_score"])
    cards = [
        ("Candidates analyzed", str(len(results)), "resumes processed"),
        ("Top match", f"{top['final_score']:.1f}%", html.escape(str(top["candidate_name"]))),
        ("Average score", f"{sum(scores) / len(scores):.1f}%", "across all candidates"),
        ("Interview-ready", str(sum(1 for s in scores if s >= 80)), "scored 80% or higher"),
    ]
    body = "".join(
        f"<div class='kpi'><div class='kpi-label'>{label}</div>"
        f"<div class='kpi-value'>{value}</div><div class='kpi-sub'>{sub}</div></div>"
        for label, value, sub in cards
    )
    html_block(f"<div class='kpi-grid'>{body}</div>")


def render_empty_state():
    html_block(
        """
        <div class="empty-state">
            <div class="empty-title">Your ranked candidates will appear here</div>
            <div class="empty-sub">Add a job description and at least one resume, then run the analysis.</div>
            <div class="feature-grid">
                <div class="feature">
                    <div class="feature-title">🎯 Evidence-based skills</div>
                    <div class="feature-text">Each skill match is checked against a quote from the resume, not just a keyword.</div>
                </div>
                <div class="feature">
                    <div class="feature-title">🧠 Semantic matching</div>
                    <div class="feature-text">Embeddings compare the meaning of the resume with the job description.</div>
                </div>
                <div class="feature">
                    <div class="feature-title">📊 Transparent scoring</div>
                    <div class="feature-text">See how similarity, skills and experience each contribute to the final score.</div>
                </div>
            </div>
        </div>
        """
    )


# --------------------------------------------------
# Top bar and hero
# --------------------------------------------------

html_block(
    """
    <div class="topbar">
        <div class="brand">
            <div class="logo">R</div>
            <div>
                <div class="brand-name">Smart Resume Screening</div>
                <div class="brand-sub">Candidate ranking for recruiters</div>
            </div>
        </div>
        <div class="topbar-chips">
            <span class="chip">Gemini</span>
            <span class="chip">Sentence Transformers</span>
            <span class="chip">Streamlit</span>
        </div>
    </div>
    """
)

html_block(
    """
    <div class="hero">
        <span class="eyebrow">AI-assisted recruitment</span>
        <h1>LLM-Powered Resume Screening &amp; Candidate Ranking System</h1>
        <p>
            Automatically analyze and rank multiple resumes against a job description using
            AI, semantic embeddings, Gemini-powered profile extraction, evidence-based skill
            matching, and transparent weighted scoring.
            Built to help recruiters quickly identify the most relevant candidates with a
            clear and efficient screening process.
        </p>
        <div class="hero-pills">
            <span class="hero-pill">🧠 Semantic Embeddings</span>
            <span class="hero-pill">✨ Gemini Profile Extraction</span>
            <span class="hero-pill">🎯 Required &amp; Preferred Skills</span>
            <span class="hero-pill">📊 Weighted Scoring</span>
            <span class="hero-pill">🏆 Candidate Ranking</span>
        </div>
    </div>
    """
)

# Filled in later, once the inputs are known.
stepper_placeholder = st.empty()

# --------------------------------------------------
# Sidebar
# --------------------------------------------------

with st.sidebar:
    html_block(
        """
        <div class="sb-brand">
            <div class="logo">R</div>
            <div>
                <div class="sb-brand-name">Smart Resume Screening</div>
                <div class="sb-brand-sub">Ranking system</div>
            </div>
        </div>
        <div class="sb-label">How it works</div>
        <div class="sb-step"><span class="sb-num">1</span><span>Provide the Job Description (paste or upload a PDF)</span></div>
        <div class="sb-step"><span class="sb-num">2</span><span>Upload one or more candidate resumes (PDF)</span></div>
        <div class="sb-step"><span class="sb-num">3</span><span>Click <b>Analyze Resumes</b></span></div>
        <div class="sb-step"><span class="sb-num">4</span><span>Review rankings, scores, and skill gaps</span></div>
        <div class="sb-step"><span class="sb-num">5</span><span>Download the ranking report as CSV</span></div>
        <div class="sb-label">Scoring</div>
        <div class="sb-card">
            <b>30%</b> semantic similarity<br>
            <b>50%</b> skills match<br>
            <b>20%</b> experience<br>
            Weights are rescaled when experience cannot be determined.
        </div>
        <div class="sb-label">Score legend</div>
        <div class="sb-legend-row"><span class="sb-dot" style="background:#10B981;"></span>80%+ &nbsp;Interview</div>
        <div class="sb-legend-row"><span class="sb-dot" style="background:#3B82F6;"></span>60–79% Consider</div>
        <div class="sb-legend-row"><span class="sb-dot" style="background:#F59E0B;"></span>40–59% Review</div>
        <div class="sb-legend-row"><span class="sb-dot" style="background:#EF4444;"></span>Below 40% Low Match</div>
        <div class="sb-note">Scores support recruiters' decisions. They do not replace human judgment.</div>
        """
    )

# --------------------------------------------------
# Inputs: Job Description + Resume Upload
# --------------------------------------------------

col_jd, col_resumes = st.columns([1.35, 1], gap="large")

with col_jd:
    with st.container(border=True):
        section_header("📋", "Job Description", "Paste the role details or upload a PDF.")

        input_method = st.radio(
            "Choose Job Description Input Method",
            (
                "Paste Job Description",
                "Upload JD PDF",
            ),
            horizontal=True,
        )

        job_description = ""
        uploaded_jd_pdf = None
        required_skills = []
        preferred_skills = []

        if input_method == "Paste Job Description":

            job_description = st.text_area(
                "Paste Job Description",
                height=250,
                placeholder="Paste the full job description here...",
            )

        else:

            uploaded_jd_pdf = st.file_uploader(
                "Upload Job Description PDF",
                type=["pdf"],
            )
            if uploaded_jd_pdf:
                job_description = extract_text_from_pdf(uploaded_jd_pdf)

        # Extract skills only if a JD is available
        if job_description.strip():

            job_profile = get_job_profile(job_description)
            required_skills = job_profile.required_skills or extract_skills(
                job_description,
                skills_database,
            )
            preferred_skills = job_profile.preferred_skills

            if required_skills:

                mini_title("📋", "Extracted Required Skills")
                render_tag_pills(required_skills, "req")

            else:

                st.info(
                    "No technical skills were detected in the Job Description."
                )

            if preferred_skills:
                mini_title("⭐", "Preferred Skills")
                render_tag_pills(preferred_skills, "pref")

with col_resumes:
    with st.container(border=True):
        section_header("📁", "Upload Resume(s)", "PDF resumes, one or many.")

        uploaded_resumes = st.file_uploader(
            "Upload One or More PDF Resumes",
            type=["pdf"],
            accept_multiple_files=True,
        )

        if uploaded_resumes:
            html_block(
                f"<div class='pill-row'><span class='pill req'>"
                f"{len(uploaded_resumes)} resume(s) ready to analyze</span></div>"
            )

render_stepper(
    stepper_placeholder,
    has_jd=bool(job_description.strip()),
    has_resumes=bool(uploaded_resumes),
    has_results=bool(st.session_state.analysis_results),
)

# --------------------------------------------------
# Analyze Button
# --------------------------------------------------

# Keep a placeholder so the button can be replaced by a loading animation
# immediately after it is clicked.
analyze_button_placeholder = st.empty()
analyze_button = analyze_button_placeholder.button(
    "🚀 Analyze Resumes",
    use_container_width=True,
    key="analyze_resumes",
)


if analyze_button or st.session_state.analysis_results:

    # -----------------------------
    # Validate Job Description
    # -----------------------------
    analyzer = ResumeAnalyzer("data/skills.txt")

    if not job_description.strip():
        st.error("Please provide a Job Description.")
        st.stop()

    # -----------------------------
    # Validate Resume Upload
    # -----------------------------
    if not uploaded_resumes:
        st.error("Please upload at least one resume.")
        st.stop()

    resumes = []

    for uploaded_resume in uploaded_resumes:

        resume_text = extract_text_from_pdf(uploaded_resume)

        if not resume_text.strip():
            st.warning(
                f"No readable text found in '{uploaded_resume.name}'. "
                "The PDF may be scanned or image-based."
            )
            continue

        candidate_name = os.path.splitext(uploaded_resume.name)[0]
        candidate_name = candidate_name.replace("_", " ")

        resumes.append(
            {
                "name": candidate_name,
                "text": resume_text,
            }
        )
    if not resumes:
        st.error("No valid resumes could be analyzed.")
        st.stop()

    if analyze_button:
        # Replace the clicked button with an animated status indicator.
        analyze_button_placeholder.markdown(
            _compact(
                """
                <div class="analyzing-status">
                    <div class="analyzing-row">
                        <div class="loading-spinner"></div>
                        <span>Analyzing Resumes...</span>
                    </div>
                    <div class="analyzing-bar"></div>
                    <div class="analyzing-sub">Extracting profiles, matching skills and scoring candidates</div>
                </div>
                """
            ),
            unsafe_allow_html=True,
        )

        with st.spinner(
            "Extracting candidate profiles and matching skills..."
        ):
            results = analyzer.analyze_multiple_resumes(
                job_description,
                resumes,
                job_profile,
            )

        st.session_state.analysis_results = results
        st.session_state.analysis_job_description = job_description
        st.session_state.analysis_resume_texts = {
            resume["name"]: resume["text"]
            for resume in resumes
        }
        analyze_button_placeholder.success("✅ Analysis Completed Successfully!")
        render_stepper(stepper_placeholder, True, True, True)
    else:
        results = st.session_state.analysis_results

    ranking_data = []

    for candidate in results:

        rank = candidate["rank"]

        if rank == 1:
            rank_display = "🥇 1"
        elif rank == 2:
            rank_display = "🥈 2"
        elif rank == 3:
            rank_display = "🥉 3"
        else:
            rank_display = str(rank)

        score = candidate["final_score"]

        if score >= 80:
            decision = "Interview"
        elif score >= 60:
            decision = "Consider"
        elif score >= 40:
            decision = "Review"
        else:
            decision = "Low Match"

        ranking_data.append(
            {
                "Rank": rank_display,
                "Candidate": candidate["candidate_name"],
                "Final Score": f'{candidate["final_score"]:.2f}%',
                "Decision": decision,
            }
        )

    ranking_df = pd.DataFrame(ranking_data)

    csv = ranking_df.to_csv(index=False).encode("utf-8")

    render_kpis(results)

    with st.container(border=True):
        head_left, head_right = st.columns([3, 1])

        with head_left:
            section_header("🏆", "Candidate Ranking", "Ordered by final score, highest first.")

        with head_right:
            st.download_button(
                label="📥 Download Ranking Report",
                data=csv,
                file_name="candidate_ranking.csv",
                mime="text/csv",
            )

        # Custom styled ranking table (built from the same ranking_data used for CSV export).
        row_html_parts = []
        for candidate, row in zip(results, ranking_data):
            color, bg = decision_style(row["Decision"])
            name = str(row["Candidate"])
            initials = html.escape("".join(w[0] for w in name.split()[:2]).upper() or "?")
            bar_color = score_style(candidate["final_score"])
            bar_pct = max(0, min(candidate["final_score"], 100))
            row_html_parts.append(
                "<tr>"
                f"<td class='rank-cell'>{row['Rank']}</td>"
                f"<td><div class='cand-cell'><span class='avatar'>{initials}</span>{html.escape(name)}</div></td>"
                f"<td><div class='score-cell'><span class='score-num'>{row['Final Score']}</span>"
                f"<div class='mini-track'><div class='mini-fill' style='width:{bar_pct}%; background:{bar_color};'></div></div></div></td>"
                f"<td><span class=\"decision-badge\" style=\"color:{color}; background:{bg};\">{row['Decision']}</span></td>"
                "</tr>"
            )
        table_rows = "".join(row_html_parts)

        table_html = (
            "<div class='table-wrap'><table class=\"ranking-table\">"
            "<thead><tr><th>Rank</th><th>Candidate</th><th>Final Score</th><th>Decision</th></tr></thead>"
            f"<tbody>{table_rows}</tbody>"
            "</table></div>"
        )

        st.markdown(table_html, unsafe_allow_html=True)

    with st.container(border=True):
        section_header("📋", "Candidate Details", "Open a candidate to see the full breakdown.")

        for candidate in results:

            rank = candidate["rank"]

            if rank == 1:
                icon = "🥇"
            elif rank == 2:
                icon = "🥈"
            elif rank == 3:
                icon = "🥉"
            else:
                icon = "👤"

            with st.expander(
                f"{icon} Rank #{rank} - {candidate['candidate_name']}",
                expanded=False,
            ):

                tab_overview, tab_preferred, tab_experience, tab_scores = st.tabs(
                    [
                        "Overview",
                        "Preferred & Alternatives",
                        "Experience & Education",
                        "Score Breakdown",
                    ]
                )

                # ---------------- Overview ----------------
                with tab_overview:

                    # AI-generated candidate summary
                    with st.container(border=True):
                        mini_title("🤖", "AI Candidate Summary")

                        summary = candidate.get("candidate_summary")

                        if not summary:
                            st.caption("No summary generated yet.")
                            if st.button(
                                "Generate AI Summary",
                                key=f"generate_summary_{rank}_{candidate['candidate_name']}",
                            ):
                                resume_text = st.session_state.analysis_resume_texts.get(
                                    candidate["candidate_name"],
                                )

                                if resume_text is None:
                                    st.error("Original resume text is unavailable.")
                                else:
                                    try:
                                        with st.spinner("Generating candidate summary..."):
                                            candidate["candidate_summary"] = (
                                                generate_candidate_summary(
                                                    resume_text=resume_text,
                                                    job_description=(
                                                        st.session_state.analysis_job_description
                                                    ),
                                                    required_skills=candidate.get(
                                                        "required_skills",
                                                        [],
                                                    ),
                                                    matched_skills=candidate.get(
                                                        "matched_skills",
                                                        [],
                                                    ),
                                                    missing_skills=candidate.get(
                                                        "missing_skills",
                                                        [],
                                                    ),
                                                )
                                            )
                                    except Exception as exc:
                                        print(
                                            f"Summary generation failed for "
                                            f"{candidate['candidate_name']}: {exc}"
                                        )
                                        candidate["candidate_summary"] = (
                                            "Candidate summary is temporarily unavailable."
                                        )

                                    st.session_state.analysis_results = results
                                    st.rerun()

                        if summary:
                            st.write(summary)

                    ring_col, bars_col = st.columns([1, 2.2], gap="large")

                    with ring_col:
                        render_score_ring(
                            candidate["final_score"],
                            decision_for(candidate["final_score"]),
                        )

                    with bars_col:
                        render_score_bar("JD Similarity", candidate["jd_similarity_score"])
                        render_score_bar("Skills Match", candidate["skills_match_score"])

                        overview_experience_score = candidate.get("experience_match_score")
                        if overview_experience_score is not None:
                            render_score_bar("Experience Match", overview_experience_score)
                        else:
                            st.caption("Experience was not included in the score.")

                    left, right = st.columns(2)

                    with left:
                        mini_title("✅", "Matched Skills")
                        render_skill_pills(candidate["matched_skills"], matched=True)

                    with right:
                        mini_title("❌", "Missing Skills")
                        render_skill_pills(candidate["missing_skills"], matched=False)

                # ---------------- Preferred & Alternatives ----------------
                with tab_preferred:

                    required_matched_groups = candidate.get("matched_required_groups", [])
                    required_missing_groups = candidate.get("missing_required_groups", [])

                    if required_matched_groups or required_missing_groups:
                        mini_title("🔀", "Alternative Requirements")

                        for group_result in required_matched_groups:
                            alternatives = group_result["alternatives"]
                            matched_alternatives = group_result[
                                "matched_alternatives"
                            ]

                            st.success(
                                f"✓ Satisfied: {' OR '.join(alternatives)} "
                                f"(matched: {', '.join(matched_alternatives)})"
                            )

                        for group_result in required_missing_groups:
                            alternatives = group_result["alternatives"]

                            st.error(
                                f"✗ Not satisfied: {' OR '.join(alternatives)}"
                            )

                    candidate_preferred_skills = candidate.get("preferred_skills", [])
                    matched_preferred_skills = candidate.get(
                        "matched_preferred_skills",
                        [],
                    )
                    missing_preferred_skills = candidate.get(
                        "missing_preferred_skills",
                        [],
                    )

                    matched_groups = candidate.get("matched_preferred_groups", [])
                    missing_groups = candidate.get("missing_preferred_groups", [])

                    # Count each individual skill and each alternative group once.
                    total_preferred = (
                        len(candidate_preferred_skills)
                        + len(matched_groups)
                        + len(missing_groups)
                    )
                    matched_preferred = (
                        len(matched_preferred_skills)
                        + len(matched_groups)
                    )

                    mini_title(
                        "⭐",
                        f"Preferred Requirements "
                        f"({matched_preferred}/{total_preferred} matched)",
                    )

                    if total_preferred == 0:
                        st.caption("No preferred requirements were identified.")
                    else:
                        if candidate_preferred_skills:
                            preferred_left, preferred_right = st.columns(2)

                            with preferred_left:
                                mini_title("✅", "Matched Preferred Skills")
                                render_skill_pills(
                                    matched_preferred_skills,
                                    matched=True,
                                )

                            with preferred_right:
                                mini_title("❌", "Missing Preferred Skills")
                                render_skill_pills(
                                    missing_preferred_skills,
                                    matched=False,
                                )

                        if matched_groups or missing_groups:
                            mini_title("🔀", "Preferred Alternatives")

                            for group in matched_groups:
                                alternatives = group["alternatives"]
                                matched_alternatives = group[
                                    "matched_alternatives"
                                ]

                                st.success(
                                    f"✓ Satisfied: {' OR '.join(alternatives)} "
                                    f"(matched: {', '.join(matched_alternatives)})"
                                )

                            for group in missing_groups:
                                alternatives = group["alternatives"]

                                st.error(
                                    f"✗ Not satisfied: {' OR '.join(alternatives)}"
                                )

                # ---------------- Experience & Education ----------------
                with tab_experience:

                    mini_title("💼", "Experience Analysis")

                    experience_years = candidate.get("candidate_experience_years")
                    experience_score = candidate.get("experience_match_score")

                    if experience_years is not None:
                        st.write(f"**Candidate experience:** {experience_years} years")
                    else:
                        st.info("Candidate experience could not be determined.")

                    if experience_score is not None:
                        render_tiles([("Experience Match", f"{experience_score:.1f}%")])
                    else:
                        st.caption("Experience was not included in the score.")

                    mini_title("🎓", "Education")

                    education = candidate.get("candidate_education")
                    education_in_progress = candidate.get(
                        "education_in_progress",
                        [],
                    )

                    if education:
                        st.write(f"**Completed education:** {education}")
                    else:
                        st.write("Completed education: Not identified")

                    if education_in_progress:
                        st.write(
                            "**Education in progress:** "
                            + ", ".join(education_in_progress)
                        )

                # ---------------- Score Breakdown ----------------
                with tab_scores:

                    mini_title("📊", "Score Breakdown")

                    breakdown_experience_score = candidate.get("experience_match_score")

                    render_tiles(
                        [
                            ("Semantic Similarity", f"{candidate['jd_similarity_score']:.1f}%"),
                            ("Skills Match", f"{candidate['skills_match_score']:.1f}%"),
                            (
                                "Experience Match",
                                f"{breakdown_experience_score:.1f}%"
                                if breakdown_experience_score is not None
                                else "N/A",
                            ),
                        ]
                    )

                    mini_title("🧩", "Skill Score Breakdown")

                    required_score = candidate.get("required_skills_score")
                    preferred_score = candidate.get("preferred_skills_score")

                    render_tiles(
                        [
                            (
                                "Required Skills",
                                f"{required_score:.1f}%"
                                if required_score is not None
                                else "N/A",
                            ),
                            (
                                "Preferred Skills",
                                f"{preferred_score:.1f}%"
                                if preferred_score is not None
                                else "N/A",
                            ),
                            ("Overall Skills Match", f"{candidate['skills_match_score']:.1f}%"),
                        ]
                    )

                    if required_score is not None and preferred_score is not None:
                        st.caption(
                            "Overall skills score = 80% required skills + "
                            "20% preferred skills."
                        )
                    elif required_score is not None:
                        st.caption("Only required skills contribute to the skills score.")
                    elif preferred_score is not None:
                        st.caption("Only preferred skills contribute to the skills score.")

else:
    render_empty_state()

html_block(
    """
    <div class="site-footer">
        Built with ❤️ by <b>Ashish Kumar Pal</b>
        <div class="note">Scores are decision-support signals. Final hiring decisions stay with people.</div>
    </div>
    """
)