"""Assert /listings?sort=newest is ordered by first_seen_at descending."""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path


def main() -> int:
    path = Path(sys.argv[1] if len(sys.argv) > 1 else "/tmp/newest.json")
    data = json.loads(path.read_text(encoding="utf-8"))
    rows = data.get("listings") or []
    assert rows, "no listings returned"
    firsts = [r.get("first_seen_at") for r in rows if r.get("first_seen_at")]
    parsed = [datetime.fromisoformat(x.replace("Z", "+00:00")) for x in firsts]
    assert parsed == sorted(parsed, reverse=True), f"newest not by first_seen_at: {firsts}"
    days = [r.get("days_on_market") for r in rows]
    print(
        "newest_ok",
        {"days_on_market": days, "first_seen": firsts[:4], "total": data.get("total")},
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
