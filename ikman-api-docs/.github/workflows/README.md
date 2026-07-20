# Workflows for a standalone repo

When you extract `ikman-api-docs/` into its own GitHub repository, move
`probe.yml` to that repo’s `.github/workflows/probe.yml` and drop the
`working-directory: ikman-api-docs` / path prefixes.

In this monorepo, prefer
[`.github/workflows/ikman-api-docs-probe.yml`](../../.github/workflows/ikman-api-docs-probe.yml)
(added at the platform root).
