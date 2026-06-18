---
source_type: official-distilled
source_basis: vMix Developer API help and local MCP HTTP client behavior
last_reviewed: 2026-06-06
---

# Developer API

vMix exposes the main HTTP API at `http://{host}:{port}/api/`, normally port `8088`.

Core patterns:

- `GET /api/` returns the current vMix XML state.
- Mutating shortcut-function execution uses the HTTP API's `Function` query parameter. In Review Mode, describe this as a reviewable plan instead of printing ready-to-run mutating URLs.
- Function parameters include values such as `Input`, `Value`, `Duration`, `SelectedName`, `SelectedIndex`, and `Mix`.
- A successful command normally returns HTTP 200. Function errors can still depend on the active preset and current input state.

State XML contains:

- Version and edition.
- Active/program and preview input numbers.
- Input list with number, key, title, type, state, position, duration, loop, mute, audio buses, layers, and title fields when present.
- Overlay channel state.
- Recording, streaming, external output, and fade-to-black state.
- Audio master and input-level metadata when available.

MCP guidance:

- Prefer read-only state inspection in Review Mode.
- Treat HTTP function calls as Control Mode behavior.
- Use state XML to resolve keys, title fields, audio buses, and overlay occupancy before producing a command plan.
- Do not assume vMix has Web Controller enabled; connection resources should report that clearly.
