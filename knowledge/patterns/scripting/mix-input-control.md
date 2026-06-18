# Mix Input Control

Multi-mix productions may need functions that target a specific mix.

Guidance:

- Confirm whether the request affects main program or an alternate mix.
- Include the `Mix` parameter when the target mix is known and the function supports it.
- Avoid assuming overlays, previews, or transitions apply globally.
- Surface assumptions when XML does not expose enough mix context.

Example:

```vb
API.Function("Fade", Input:="{camera-key}", Mix:=1)
```

Review steps:

- Confirm vMix edition supports the requested mix behavior.
- Test in rehearsal because multi-mix routing can be preset-specific.
