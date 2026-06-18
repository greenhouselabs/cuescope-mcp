# Multi-Mix Shows

Multi-mix shows use alternate program/preview paths for screens, records, clean feeds, or isolated outputs.

Common uses:

- Main program for stream.
- Clean feed for screens.
- Isolated guest or interpreter feed.
- Secondary recording layout.

What the MCP can see:

- Parsed `<mixes>` active and preview input numbers when vMix exposes them.
- Resolved active/preview input titles, keys, types, and inferred roles for each parsed mix.
- Mix or clean-feed inputs that appear in the input list.
- Overlay, audio, and title-field context that may explain what a mix is built from.

What still needs operator verification:

- Which mix feeds each stream, recording, external output, fullscreen output, or hardware destination.
- Whether overlays follow the intended mix or only the main Program path.
- Whether a Mix input is being used as a source inside another output path.

Diagnostics:

- Read `vmix://state/live` or `vmix://state/relationships` to inspect parsed mix active/preview paths.
- Use `vmix_analyze_preset` output readiness to see whether recording, streaming, or external output is active while mix destination binding remains unknown.
- Check whether inputs or API plans need a `Mix` parameter.
- Watch for assumptions that Program/Preview means every mix.
- Explain when XML cannot reveal the complete output routing.

Safety:

- Multi-mix changes can affect external outputs that are not visible in the main program monitor.
- Do not assume a clean feed is safe just because main Program looks correct.
- Prefer advisory plans and explicit operator confirmation.
