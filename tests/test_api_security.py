import ast
from pathlib import Path


API_MAIN = Path(__file__).resolve().parents[1] / "api" / "main.py"


def _source() -> str:
    return API_MAIN.read_text(encoding="utf-8")


def _function_node(name: str) -> ast.FunctionDef | ast.AsyncFunctionDef:
    tree = ast.parse(_source())
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return node
    raise AssertionError(f"Function {name} not found")


def _calls_function(node: ast.AST, function_name: str) -> bool:
    return any(
        isinstance(child, ast.Call)
        and isinstance(child.func, ast.Name)
        and child.func.id == function_name
        for child in ast.walk(node)
    )


def test_cors_is_configured_from_allowlist_not_wildcard():
    source = _source()

    assert "CORS_ALLOW_ORIGINS" in source
    assert 'allow_origins=["*"]' not in source
    assert "allow_origins=_configured_cors_origins()" in source


def test_unhandled_exceptions_return_json_with_cors_headers():
    """Regression: plain-text Lambda 500s omit CORS and break the Vercel UI."""
    source = _source()
    assert "@app.exception_handler(Exception)" in source
    assert "_unhandled_exception_handler" in source
    assert "_cors_headers_for_request" in source
    assert "Access-Control-Allow-Origin" in source
    assert "JSONResponse" in source


def test_stats_and_prices_degrade_instead_of_opaque_500():
    stats = _function_node("get_stats")
    prices = _function_node("get_prices")
    stats_src = ast.get_source_segment(_source(), stats) or ""
    prices_src = ast.get_source_segment(_source(), prices) or ""

    assert "HTTPException" in stats_src
    assert "SELECT COUNT(*) FROM listings" in stats_src
    assert "MAX(finished_at)" in stats_src
    assert "listing_type" in prices_src
    assert "HTTPException" in prices_src


def test_process_trigger_requires_admin():
    trigger_process = _function_node("trigger_process")

    assert _calls_function(trigger_process, "_require_admin")


def test_synthetic_backfill_requires_admin_and_explicit_opt_in():
    trigger_backfill = _function_node("trigger_backfill")
    source = ast.get_source_segment(_source(), trigger_backfill) or ""

    assert _calls_function(trigger_backfill, "_require_admin")
    assert "synthetic_demo_data" in source
    assert "Synthetic backfill is disabled" in source
