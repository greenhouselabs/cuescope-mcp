# Remote Guest Mix-Minus Shows

Remote guest shows use vMix Call, browser, NDI, or capture sources for guests who need to hear the production without hearing their own delayed voice.

## Common Structure

- Host mic or host camera audio goes to Master and one or more guest return buses.
- Remote guest inputs go to Master when they should be heard by the audience.
- Each guest usually has a return path that should exclude that guest's own input.
- Lower thirds, scorebugs, timers, and composite/multiview inputs may be used for the visual layout.
- Music, stingers, and playback may or may not be included in guest returns.

## Review Mode Detection

Treat this as likely when:

- One or more inputs are vMix Call inputs or have guest/caller/remote naming.
- Remote inputs are routed to Master and one or more aux buses.
- Program is a layered/composite input that includes host and guest sources.
- Audio routing shows likely caller return candidates.

Do not claim the mix-minus is correct from input bus assignment alone. vMix Call return selection, headphone routing, hardware output routing, and external mixers may not be visible in the XML.

## Correct Severity

Use warnings, not certainty, for mix-minus risks unless the XML directly proves a blocker.

Warning examples:

- A remote guest has no visible aux return candidate.
- Multiple remote guests share the same aux bus.
- A likely return bus contains caller audio and may need operator verification.

Critical examples:

- Master is muted or at zero while the show is live.
- A Program guest/call input is muted or unrouted and should be heard.
- The requested action would start a stream/recording while known audio blockers remain.

## Preflight Checks

1. Confirm each guest hears the correct return feed.
2. Confirm each guest return excludes that guest's own audio.
3. Confirm host audio reaches each guest return.
4. Confirm music/playback is included or excluded intentionally.
5. Confirm comms/talkback are not routed to Master unless intended.
6. Confirm lower thirds and guest labels target exact fields/inputs.
7. Confirm recording/streaming status and Master audio before go-live.

## Useful MCP Surfaces

- `vmix_analyze_preset`: show-pattern detection and production map.
- `vmix_diagnose_audio`: mix-minus, return-bus, and feedback-loop review.
- `vmix_explain_input`: focused review of one guest/call input.
- `vmix://state/relationships`: Program/Preview, layers, overlays, audio buses, and title-field relationships.
- `vmix://docs/audio-routing`: mix-minus and remote-guest routing concepts.
- `vmix://docs/examples`: podcast and virtual-set examples.
