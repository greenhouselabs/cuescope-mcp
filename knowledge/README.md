# vMix Knowledge Base

This directory contains concise, curated context for MCP resources under `vmix://docs/*`.

Source types:

- `official-distilled`: summaries derived from vMix official help topics and local implementation knowledge.
- `internal-pattern`: production patterns distilled from the MCP implementation and existing local skills/docs.
- `curated-forum-summary`: clean summaries of recurring community patterns and edge cases. These are not raw scraped posts.

Top-level areas:

- `mcp/`: project-specific knowledge about what the MCP can know, how it uses live state and curated docs, confidence rules, blind spots, and professional-readiness priorities.
- `official/`: distilled vMix help topics and stable API/scripting concepts.
- `patterns/`: internal production, scripting, audio, and troubleshooting patterns.
- `forum-digests/`: curated recurring community gotchas and edge cases.
- `examples/`: review-first examples for presets, XML snapshots, routing diagrams, and scripts.

The knowledge base is intentionally compact. It should help an LLM diagnose a live vMix setup, interpret pasted errors or log excerpts, generate reviewable scripts, and explain production patterns without flooding context.

Real-world script examples must be sanitized before they are committed. Do not store vMix Call links, passwords, stream keys, private network details, local file paths, client names, or other sensitive production details in `knowledge/`.
