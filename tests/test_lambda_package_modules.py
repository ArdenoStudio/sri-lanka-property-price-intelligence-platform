"""Guard: Lambda zip keep-list must include scraper modules used by the API."""
import ast
from pathlib import Path

API_MAIN = Path(__file__).resolve().parents[1] / "api" / "main.py"
WORKFLOW = Path(__file__).resolve().parents[1] / ".github" / "workflows" / "aws-lambda-deploy.yml"

# Modules that must remain in the Lambda package (Playwright scrapers are stripped).
REQUIRED_SCRAPER_MODULES = {
    "privacy",
    "pipeline_metrics",
    "quality",
    "flags",
}


def _scraper_imports_any_depth() -> set[str]:
    """Collect scraper.<module> imports anywhere in api.main (incl. lazy imports)."""
    tree = ast.parse(API_MAIN.read_text(encoding="utf-8"))
    mods: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("scraper"):
            parts = node.module.split(".")
            if len(parts) >= 2:
                mods.add(parts[1])
    return mods


def _top_level_scraper_imports() -> set[str]:
    tree = ast.parse(API_MAIN.read_text(encoding="utf-8"))
    mods: set[str] = set()
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("scraper"):
            parts = node.module.split(".")
            if len(parts) >= 2:
                mods.add(parts[1])
    return mods


def test_top_level_scraper_imports_are_privacy_only():
    """Cold-start must not import metrics/quality — keeps /health up if zip drifts."""
    assert _top_level_scraper_imports() == {"privacy"}


def test_public_pipeline_modules_covered_by_keep_list():
    """Admin-only cleaner/geocoder/enricher stay stripped; pipeline modules must ship."""
    imported = _scraper_imports_any_depth()
    required_for_public = {"privacy", "pipeline_metrics", "quality"}
    assert required_for_public <= imported
    assert required_for_public <= REQUIRED_SCRAPER_MODULES



def test_deploy_workflow_keeps_required_scraper_modules():
    source = WORKFLOW.read_text(encoding="utf-8")
    for name in REQUIRED_SCRAPER_MODULES:
        assert f"! -name '{name}.py'" in source or f'! -name "{name}.py"' in source
    assert "scripts/check_lambda_scraper_modules.py" in source
    assert "scripts/lambda_smoke_newest.py" in source
    assert "propertylk-one.vercel.app" in source
