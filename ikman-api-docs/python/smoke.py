#!/usr/bin/env python3
from ikman_lk import categories, serp

cats = categories()
root = next(c for c in cats["categories"] if c.get("id") == 409)
print("property root:", root.get("name"), root.get("slug"))
page = serp(category=415, page=1)
print("houses sale total:", page["pagination"]["total"], "page results:", len(page["serp"]["results"]))
