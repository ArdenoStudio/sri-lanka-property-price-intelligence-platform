"""Guard: Lambda zip keep-list must include every scraper module imported by api.main."""
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


def _top_level_scraper_imports() -> set[str]:
    tree = ast.parse(API_MAIN.read_text(encoding="utf-8"))
    mods: set[str] = set()
    for node in tree.body:  # top-level only — admin triggers lazy-import heavy scrapers
        if isinstance(node, ast.ImportFrom) and node.module and node.module.startswith("scraper"):
            parts = node.module.split(".")
            if len(parts) >= 2:
                mods.add(parts[1])
            else:
                mods.add("__init__")
    return mods


def test_lambda_keep_list_covers_api_scraper_imports():
    imported = _top_level_scraper_imports()
    assert imported <= REQUIRED_SCRAPER_MODULES | {"__init__"}, (
        f"api.main top-level scraper imports {imported} exceed Lambda keep-list "
        f"{REQUIRED_SCRAPER_MODULES}. Update aws-lambda-deploy.yml keep-list."
    )


def test_deploy_workflow_keeps_required_scraper_modules():
    source = WORKFLOW.read_text(encoding="utf-8")
    for name in REQUIRED_SCRAPER_MODULES:
        assert f"! -name '{name}.py'" in source or f'! -name "{name}.py"' in source
    assert "lambda_scraper_modules_ok" in source
    assert "access-control-allow-origin: https://propertylk-one.vercel.app" in source
