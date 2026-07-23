"""Contract tests for pipeline status / metrics surfaces."""
import ast
from pathlib import Path

from scraper.pipeline_metrics import JOB_DEFS, KNOWN_SOURCES, SOURCE_LABELS, _pct, _status_for
from datetime import datetime, timedelta, timezone


API_MAIN = Path(__file__).resolve().parents[1] / "api" / "main.py"


def _source() -> str:
    return API_MAIN.read_text(encoding="utf-8")


def test_pipeline_routes_registered():
    source = _source()
    assert '@app.get("/pipeline/status")' in source
    assert '@app.get("/pipeline/metrics")' in source
    assert '@app.get("/pipeline/quality")' in source
    assert '@app.get("/public/pipeline")' in source
    assert "build_pipeline_status" in source
    assert "compute_pipeline_metrics" in source
    assert "run_quality_checks" in source


def test_pipeline_status_and_public_share_builder():
    tree = ast.parse(_source())
    names = {
        node.name
        for node in ast.walk(tree)
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
    }
    assert "pipeline_status" in names
    assert "public_pipeline" in names
    assert "pipeline_metrics" in names


def test_known_sources_cover_major_portals():
    assert set(KNOWN_SOURCES) >= {"ikman", "lpw", "onlineproperty", "lamudi"}
    for src in KNOWN_SOURCES:
        assert src in SOURCE_LABELS


def test_job_defs_include_four_scrape_sources_and_downstream():
    scrape_sources = {j["source"] for j in JOB_DEFS if j["kind"] == "scrape"}
    assert scrape_sources == {"ikman", "lpw", "onlineproperty", "lamudi"}
    job_names = {j["name"] for j in JOB_DEFS if j["kind"] == "job"}
    assert job_names == {"clean_listings", "geocode_listings", "compute_aggregates"}


def test_pct_and_status_helpers():
    assert _pct(25, 100) == 25.0
    assert _pct(0, 0) is None

    now = datetime(2026, 7, 23, tzinfo=timezone.utc)
    assert _status_for(now, now - timedelta(hours=1), None, 24) == "ok"
    assert _status_for(now, now - timedelta(days=10), None, 24) == "delayed"
    assert _status_for(now, None, now - timedelta(minutes=5), 24) == "running"
