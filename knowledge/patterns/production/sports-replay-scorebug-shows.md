# Sports Replay Scorebug Shows

Sports productions often combine live cameras, a scorebug, replay playback, and one or more alternate mixes or clean feeds.

## Common Structure

- Main and wide cameras feed the primary Program/Preview workflow.
- A scorebug title or GT input carries home score, away score, clock, period, quarter, or possession fields.
- Replay outputs may appear as replay inputs, replay roll-ins, highlight clips, or dedicated replay channels.
- A clean-feed Mix input may be used for venue screens, replay output, ISO recording, or downstream production.
- Parsed mix active/preview paths can show whether replay or cameras are staged on a secondary mix, but not which destination that mix feeds.
- Overlays keep the scorebug on air while cameras and replay switch underneath.

## Review Mode Detection

Treat this as likely when:

- A title/GT input has score and clock/period fields.
- A replay-like input exists, or multiple camera inputs appear with sports-style graphics.
- The scorebug is assigned to an overlay channel.
- A Mix or clean-feed input is visible.
- Parsed mix state shows replay, cameras, or clean-feed paths on a secondary mix.

Do not assume replay is configured correctly unless vMix exposes enough replay state or the operator confirms it.

## Correct Severity

Use warning-level language for stale-score and replay-context uncertainty:

- A visible scorebug may still contain stale values.
- A replay input may be paused intentionally.
- A clean feed may not match the main Program output.
- Replay audio may be absent or intentionally excluded.

Critical severity is appropriate when Program is black, Master audio is muted, a required scorebug is missing during a live show, or the requested action would take replay to the wrong output immediately.

## Preflight Checks

1. Confirm the scorebug overlay is on the intended channel.
2. Confirm score, clock, period/quarter, and team labels are current.
3. Confirm the scorebug data source or manual update workflow.
4. Confirm replay output target: Program, Preview, Mix, or external feed.
5. Confirm replay audio routing.
6. Confirm clean-feed Mix usage and whether plans need a `Mix` parameter.
7. Confirm recording/streaming/external output states before show start.

## Automation Guidance

- Review Mode should generate reviewable plans, not execute replay actions.
- Replay commands should include operator confirmation points.
- Do not assume a replay event exists unless state or the operator confirms it.
- Avoid taking replay to Program without explicit target/mix confirmation.
- For scorebug updates, use exact field names and stable input keys.

## Useful MCP Surfaces

- `vmix_analyze_preset`: show-pattern detection, scorebug inventory, replay-like inputs, mix paths, and overlay use.
- `vmix_find_input`: resolve scorebug, replay, camera, and clean-feed inputs.
- `vmix_explain_input`: inspect scorebug fields or replay input state.
- `vmix_generate_api_sequence`: reviewable overlay/score/replay plans.
- `vmix_validate_script`: validate any generated score or replay automation.
- `vmix://docs/production-patterns`: scorebug, replay, overlay, and multi-mix guidance.
