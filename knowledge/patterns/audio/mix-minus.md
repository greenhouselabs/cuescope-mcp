# Mix Minus

Mix-minus means a participant hears the production mix minus their own voice.

Typical pattern:

- Master `M`: host, guests, music, playback, graphics audio.
- Guest return bus `A`: host, music, playback, but not the guest's own input.
- Host monitor bus `B`: guest and program elements as needed, but not delayed program audio if it distracts talent.

Diagnostic checks:

- Does each caller have a dedicated return bus or routing rule?
- Is the caller's own source excluded from their return?
- Are music and playback intentionally included or excluded?
- Are comms excluded from `M`?

Common failure:

- A remote guest hears echo because their input is routed to the same bus being sent back to them.
