---
source_type: official-distilled
source_basis: vMix Shortcut Function Reference and local validator allowlist
last_reviewed: 2026-06-06
---

# Shortcut Functions

Shortcut functions are the function names passed to `API.Function()` in scripts or `Function=` in the HTTP API.

Common function groups:

- Switching: `Cut`, `Fade`, `PreviewInput`, `Stinger1`, `FadeToBlack`.
- Overlays: `OverlayInput1In` through `OverlayInput4In`, and matching `Out` or `Off` variants.
- Titles: `SetText`, `SetImage`, `SetTextColour`, `TitleBeginAnimation`.
- Audio: `SetVolume`, `AudioOn`, `AudioOff`, `AudioBusOn`, `AudioBusOff`.
- Recording/streaming: `StartRecording`, `StopRecording`, `StartStreaming`, `StopStreaming`.
- Scripting: `ScriptStart`, `ScriptStartDynamic`, `ScriptStop`, `ScriptStopAll`.
- Input management: `AddInput`, `RemoveInput`, `SetInputName`, `MoveInput`.

Safety classification:

- Low risk: read-only XML inspection and generated plans.
- Medium risk: preview changes, title updates, overlay changes, input playback.
- High risk: program switching, recording/streaming, preset open/save, input removal, batch execution, and script execution.

Validation guidance:

- Check function names against the local allowlist before producing scripts.
- Validate overlay channels are 1 through 4.
- Validate bus letters are `M` or `A` through `G`.
- Treat show-critical functions as human-review only in Review Mode.
