# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Project filter in the sidebar; the chart area is scoped to the selected
  project, so runs from other projects are not plotted while filtering.
- Collapsible project groups, with the collapsed set persisted per browser.
- A "Select visible runs" action in the empty selection state.

### Changed

- Opening the Metrics panel no longer selects runs automatically. Selections
  are explicit, and the header shows how many visible runs are selected.
- The sidebar keeps the chosen project and folded groups across panel switches
  and page reloads via `localStorage`.

## [1.0.0] — 2026-10-21

### Added

- Sidebar **Metrics** panel in the DSH Web GUI: project-grouped run list,
  multi-run overlay charts, EMA smoothing, log Y, metric filter, latest-values
  table, run deletion, and a Python SDK panel.
- Live polling every 3 seconds; charts always span the whole run.
- Agent tools: `metrics_log`, `metrics_list`, `metrics_get`, `metrics_import`.
- Incremental CSV/TSV/JSONL/JSON import with a per-run ingest cursor.
- `follow: true` log tailing in the Host, with idle auto-finish.
- Zero-dependency Python logger `python/dsh_metrics.py`, downloadable from the
  dashboard at `/dsh-metrics/sdk/dsh_metrics.py`.
- Local HTTP API under `/dsh-metrics/api` for non-Python producers.
- English and Simplified Chinese README, locale resources, MIT license,
  simulated training example, and CI checks.
