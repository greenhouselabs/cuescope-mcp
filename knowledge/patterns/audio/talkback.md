# Talkback

Talkback lets a producer or operator speak to talent or guests without going to program.

Safe pattern:

- Talkback input routed to monitor/IFB buses.
- Talkback input excluded from `M`.
- Optional momentary mute/unmute controlled manually or by reviewed script.

Risks:

- Talkback accidentally routed to master.
- Talkback left unmuted.
- Talkback included in a recording split unintentionally.

Review Mode diagnostics:

- Flag talkback-like inputs routed to `M`.
- Identify buses that contain comms-style sources.
- Recommend explicit review before generating mute/routing automation.
