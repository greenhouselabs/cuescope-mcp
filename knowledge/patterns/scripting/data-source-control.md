# Data Source Control

Data-source scripts and API sequences should be explicit about the row action.

Common actions:

```vb
API.Function("DataSourceNextRow", Value:="Scores")
API.Function("DataSourcePreviousRow", Value:="Scores")
API.Function("DataSourceSelectRow", Value:="Scores,3")
```

Guidance:

- Confirm the data source name and row index format in the target setup.
- Prefer API-sequence plans before scripts for simple row changes.
- Add test steps for preview graphics and live overlays.
- Avoid assuming a title is data-bound unless current context indicates it.
