---
source_type: official-distilled
source_basis: vMix data source behavior and local shortcut-function usage
last_reviewed: 2026-06-06
---

# Data Sources

vMix data sources connect external rows of data to titles, tickers, and production graphics.

Common controls:

- `DataSourceNextRow`
- `DataSourcePreviousRow`
- `DataSourceSelectRow`

Guidance:

- Data-source commands usually operate on a named data source or selected table context through `Value`.
- Title fields may be bound to data sources instead of manually set with `SetText`.
- Before generating automation, determine whether the request should update title fields directly or advance/select data rows.
- Treat row selection as production-affecting: it can change graphics currently on air.

Review checklist:

- Confirm the data source name and row target.
- Confirm whether the title is already bound to the data source.
- Confirm whether advancing a row affects only preview/rehearsal graphics or live overlays.
- Prefer a reviewable API sequence before Control Mode execution.
