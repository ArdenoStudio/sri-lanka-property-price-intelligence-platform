.PHONY: probe site preview smoke

probe:
	python3 scripts/probe.py

site:
	python3 scripts/build_site.py

preview: site
	python3 -m http.server 8765 --directory site

smoke:
	cd python && pip install -e . -q && python smoke.py
