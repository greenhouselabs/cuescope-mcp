# Remote Guests

Remote guests usually arrive through vMix Call, browser, NDI, or capture inputs.

Audio goals:

- Guest audio goes to master when the guest is live.
- Guest return excludes their own audio.
- Host, playback, and producer cues are routed intentionally.
- Off-air guests may need green room routing.

Diagnostics:

- Look for input titles containing guest, call, remote, browser, or platform names.
- Check whether each guest is muted.
- Check bus assignments for self-return risks.
- Flag missing bus routing when an input has audio but no buses.

Generation guidance:

- Prefer advisory routing plans in Review Mode.
- Use exact bus letters and stable input keys in Control Mode command plans.
