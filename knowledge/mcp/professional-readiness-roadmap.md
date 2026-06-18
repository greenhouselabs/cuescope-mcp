# Professional Readiness Roadmap

This note defines what "professional-grade" should mean for CueScope and where the project should improve next.

## Target Standard

Professionals should trust CueScope to:

- Understand the current preset well enough to explain what is on air, what is next, what is routed where, and what is risky.
- Distinguish observed facts from likely patterns.
- Generate reviewable scripts and API plans that use stable references and pass validation.
- Protect live shows through clear Review, Control, and High-Impact Control boundaries.
- Support common production workflows without requiring the user to teach basic vMix concepts every time.

## Readiness Levels

Level 1: Connected
- vMix is reachable.
- State summary and inputs are readable.
- The server reports its mode and safety boundary.

Level 2: Explainable
- Program, Preview, overlays, inputs, title fields, and basic audio routing are explained clearly.
- Inputs are referenced by number/key/title without ambiguity.
- Duplicate titles are flagged.

Level 3: Diagnostic
- Audio, graphics, playback, overlays, and recording/streaming state are reviewed with confidence notes.
- Output readiness separates observed active-output state from unproven stream/record/external destination binding.
- Pasted errors and explicit log excerpts are translated into likely causes, safe next checks, and remaining unknowns.
- Known blind spots are called out.
- Paired or patterned setups are recognized when state supports them.

Level 4: Reviewable Automation
- VB.NET scripts and API plans are generated without execution.
- Scripts use stable references where possible.
- Validation flags unsafe loops, fragile references, title-field errors, and show-critical functions.

Level 5: Professional Copilot
- The assistant understands common show types and can produce repeatable preflight, rehearsal, go-live, and recovery workflows.
- It can compare before/after state, explain the impact, and suggest safe next steps.
- It has enough curated examples and parser depth to handle podcasts, sports/replay, music/video shows, hybrid events, vMix Call productions, and graphics-heavy shows with fewer false positives.

## Highest-Value Engineering Gaps

1. Raw XML deep parsing
   - Improve parsing for triggers, shortcuts, lists/playlists, data sources, replay state, output routing, stream/recording settings, PTZ, color correction, and virtual sets.

2. Audio truth model
   - Parse or expose more bus output state when possible.
   - Distinguish input-to-bus assignment from final stream/record audibility.
   - Add explicit confidence fields for audio conclusions.

3. Visual state and screenshots
   - Add optional mechanisms for visual inspection or thumbnails if a client/environment can provide them.
   - Keep visual capture opt-in and privacy-aware.

4. Show-type playbooks
   - Add curated workflows for podcast, sports/replay, concert/video playback, conference, classroom, worship, and hybrid remote-guest productions.

5. Real-world fixture corpus
   - Add sanitized XML snapshots from real presets.
   - Include before/after snapshots for common operations.
   - Use fixtures to tune severity, confidence, and false positives.

6. Professional handoff artifacts
   - Generate structured preflight reports, rehearsal checklists, go-live checklists, rollback plans, and script review packets.
   - Current foundation: `vmix_analyze_preset` includes a structured preflight report with go/caution/blocked status.
   - Current handoff tool: `vmix_generate_show_checklist` produces reviewable rehearsal, go-live, recovery, and end-show checklists.
   - Current automation guardrail: generated API/script artifacts include preflight status, execution recommendations, and operator confirmations.

7. Natural-language workflow orchestration
   - Let users ask ordinary production questions such as "check my audio before show" without knowing tool parameters.
   - Reuse explicit preset paths already supplied in the conversation when safe, and ask one plain follow-up when saved preset context would improve confidence.
   - Add higher-level show-review workflows that sequence connection, live-state review, saved-preset context, audio diagnosis, preflight, and checklist generation.
   - Keep the no-blind-scanning trust boundary: use explicit paths/content, not automatic private directory discovery.

8. Control Mode maturity
   - Keep Review Mode excellent first.
   - For Control Mode, require clear intent, show-critical warnings, dry-run summaries, and explicit user confirmation for high-impact actions.

9. Troubleshooting and log diagnostics
   - Build a sanitized corpus of common vMix, MCP, capture-device, audio-device, and network-source errors.
   - Add a bounded Review Mode log diagnosis tool only after redaction, file-boundary, and no-directory-scanning behavior is tested.
   - Keep fixes as reviewable next checks unless the user intentionally enters the appropriate operator or maintenance workflow.

## Knowledge Sources To Add

Add these in priority order:

1. Sanitized real show XML snapshots
   - Podcast with vMix Call guests.
   - Sports/replay preset.
   - Music/video playback show.
   - Graphics-heavy lower-third or scorebug show.
   - Multi-output/NDI/SRT production.

2. Official vMix help distillations
   - Triggers.
   - Shortcuts and activators.
   - Lists/playlists.
   - Data sources.
   - Replay.
   - Outputs, NDI, SRT, external/fullscreen.
   - Recording and streaming settings.

3. Production checklists
   - Audio preflight.
   - Guest-call preflight.
   - Replay preflight.
   - Graphics preflight.
   - Go-live and end-show workflows.
   - Emergency recovery patterns.

4. Community gotchas
   - Curated summaries only.
   - Focus on repeated, actionable patterns rather than one-off opinions.

5. Sanitized troubleshooting examples
   - Blackmagic and capture-device format or ownership mismatch errors.
   - Audio sample-rate, channel-map, and exclusive-use conflicts.
   - NDI discovery, firewall, and bandwidth symptoms.
   - MCP startup, PATH, Web Controller, and host/port connection failures.

## "100%" Definition

There is no literal 100% for live production software because vMix presets, plugins, workflows, and operator intent vary heavily. The practical goal is:

- High confidence on facts directly exposed by vMix state.
- Clear confidence labels for derived conclusions.
- Low false positives on common professional setups.
- Safe, reviewable artifacts for automation.
- Strong refusal behavior around gated live control.
- A growing fixture and knowledge corpus that makes every release smarter.
