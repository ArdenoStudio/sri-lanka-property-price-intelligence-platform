#!/usr/bin/env bash
# Polite curl cheat sheet for api.ikman.lk public reads.
set -euo pipefail

H=(-H 'Accept: application/json' -H 'Application: web')
BASE=https://api.ikman.lk

echo "== categories (property root 409) =="
curl -sS "${BASE}/v1/categories" "${H[@]}" | jq '.categories[] | select(.id==409) | {id,name,slug}'

echo "== locations (first 3 districts) =="
curl -sS "${BASE}/v1/locations" "${H[@]}" | jq '.locations[:3] | .[] | {id,name,slug,geo_region}'

echo "== serp property page 1 =="
curl -sS "${BASE}/v1/serp?category=409&page=1" "${H[@]}" \
  | jq '{page: .pagination.page, total: .pagination.total, first: .serp.results[0].id}'

echo "== tip: capture next_page_token for page 2 =="
TOKEN=$(curl -sS "${BASE}/v1/serp?category=409&page=1" "${H[@]}" | jq -r '.pagination.next_page_token')
curl -sS "${BASE}/v1/serp?category=409&page=2&next_page_token=${TOKEN}" "${H[@]}" \
  | jq '{page: .pagination.page, n: (.serp.results|length)}'

AD=$(curl -sS "${BASE}/v1/serp?category=415&page=1" "${H[@]}" | jq -r '.serp.results[0].id')
echo "== ad detail ${AD} =="
curl -sS "${BASE}/v1/ads/${AD}" "${H[@]}" | jq '{title: .ad.title, props: .ad.properties, views: .ad.statistics.views}'
