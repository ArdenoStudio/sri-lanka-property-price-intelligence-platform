# Examples

## curl — property SERP page 1

```bash
curl -sS 'https://api.ikman.lk/v1/serp?category=409&page=1' \
  -H 'Accept: application/json' \
  -H 'Application: web' | jq '.pagination, .serp.results[0].title'
```

## curl — page 2 with token

```bash
TOKEN='…from pagination.next_page_token…'
curl -sS "https://api.ikman.lk/v1/serp?category=409&page=2&next_page_token=${TOKEN}" \
  -H 'Accept: application/json' \
  -H 'Application: web' | jq '.pagination.page, (.serp.results|length)'
```

## curl — ad detail

```bash
AD_ID='…24-char hex from serp.results[].id…'
curl -sS "https://api.ikman.lk/v1/ads/${AD_ID}" \
  -H 'Accept: application/json' \
  -H 'Application: web' | jq '.ad.properties, .ad.statistics'
```

## curl — categories / locations

```bash
curl -sS 'https://api.ikman.lk/v1/categories' \
  -H 'Accept: application/json' -H 'Application: web' \
  | jq '.categories[] | select(.id==409) | {id,name,slug}'

curl -sS 'https://api.ikman.lk/v1/locations' \
  -H 'Accept: application/json' -H 'Application: web' \
  | jq '.locations[:3] | .[] | {id,name,slug,geo_region}'
```

## Python helper

```bash
cd python && pip install -e .
python -c "from ikman_lk import serp, categories; print(serp(category=415)['pagination'])"
```

See also [`examples/curl/cheat_sheet.sh`](../examples/curl/cheat_sheet.sh) and
[`examples/python/serp.py`](../examples/python/serp.py).
