# vMix Troubleshooting Skill

> Review-first troubleshooting for vMix, MCP startup, logs, capture devices, audio devices, network sources, and production hardware errors.

Use this skill when the user pastes an error, asks what a log means, reports a hardware/software mismatch, or wants help with vMix/Blackmagic/NDI/audio/device troubleshooting.

## Current Review Tools

| Tool | Use |
|------|-----|
| `vmix_diagnose_logs` | Diagnose pasted log/error text or one explicit log file path with redaction, confidence, and safe next checks |
| `vmix_connection_test` | Check MCP-to-vMix HTTP/TCP reachability before deeper connection diagnosis |
| `vmix_preflight` | Review show readiness and current production risks |
| `vmix_analyze_preset` | Understand current live state and likely production shape |
| `vmix_diagnose_audio` | Investigate audio routing, buses, mutes, calls, and mix-minus risk |
| `vmix_diagnose_outputs` | Investigate recording, streaming, external output, destination binding, and output-audio readiness |
| `vmix_read_preset_file` | Review an explicitly supplied saved `.vmix` preset path or content, with redaction |
| `vmix_validate_script` | Diagnose VB.NET script validation errors |

Use `vmix_diagnose_logs` first when the user provides pasted log text or one explicit log file path. It is intentionally bounded: it does not scan folders, does not execute fixes, and redacts sensitive details before returning excerpts.

## Safety Boundary

Troubleshooting is read-first. Do not mutate vMix, change drivers, edit registry/settings, run shell commands, install software, or provide raw mutating vMix HTTP commands as a shortcut around MCP mode gates.

Treat logs as sensitive. Before repeating details, redact or summarize:

- vMix Call links and passwords.
- Stream URLs, stream keys, tokens, API keys, and credentials.
- Private IPs and hostnames unless the user needs them for local diagnosis.
- Local usernames and private file paths.
- Client, show, or venue names that are not needed to solve the issue.

## Diagnostic Flow

1. Identify the surface: MCP startup, vMix connectivity, capture device, audio device, NDI/network, media/codec, script, preset, or output/streaming.
2. Capture the exact error text, timestamp, and what changed immediately before it started.
3. Use `vmix_diagnose_logs` for explicit log/error text, then read `vmix://server/status` and use `vmix_connection_test` when the problem may involve MCP or vMix reachability.
4. Use `vmix_preflight`, `vmix_analyze_preset`, `vmix_diagnose_audio`, or `vmix_diagnose_outputs` when current vMix state can confirm or challenge the theory.
5. Translate the error into likely causes with confidence and evidence.
6. Give safe next checks first; label show-disruptive changes as rehearsal-only or operator-confirmed.

## State-Aware Escalation Contract

Keep separate evidence lanes:

- Log evidence: exact sanitized error lines, timestamp, source hint, and `vmix_diagnose_logs` confidence.
- Server evidence: `vmix://server/status` and `vmix_connection_test` for MCP/vMix reachability.
- Live state evidence: `vmix_analyze_preset`, `vmix_preflight`, `vmix://state/summary`, `vmix_diagnose_audio`, or `vmix_diagnose_outputs` for current vMix facts.
- Saved preset evidence: `vmix_read_preset_file`, `vmix_explain_preset_scripts`, or `vmix_audit_preset_file` only when the user supplies an explicit saved preset path or content.

Use state-aware escalation when it can change the diagnosis:

- MCP/Web Controller errors: pair logs with `vmix_connection_test`.
- Capture errors: check whether the expected input exists/runs in vMix, but do not claim camera/switcher format from vMix state alone.
- NDI errors: check whether vMix sees NDI inputs, but do not claim firewall/VLAN/group settings are correct from vMix state alone.
- Audio errors: pair logs with `vmix_diagnose_audio` for buses, mutes, calls, and mix-minus; keep driver/sample-rate conclusions confidence-labeled.
- Script/API errors: use `vmix_validate_script`, `vmix_find_input`, `vmix://inputs/fields`, or `vmix_generate_api_sequence` for reviewable fixes.

Stay log-only when the MCP server cannot start, the user only wants the error translated, no explicit file/preset path was supplied, or the next check is outside vMix state such as cabling, camera output, Desktop Video, NDI Access Manager, firewall policy, or Windows audio settings.

## Troubleshooting Handoff Report

Use this shape when you combine logs with live state or saved preset facts:

```text
Symptom:
- ...

Log evidence:
- ...

State evidence:
- ...

Likely causes:
- High/medium/low confidence: ...

Safe next checks:
1. ...
2. ...
3. ...

Rehearsal-only or operator-confirmed actions:
- ...

What would confirm or rule out the theory:
- ...

Still unknown:
- ...
```

## Response Template

Use this shape for pasted errors:

```text
What it probably means:
- ...

Evidence:
- ...

Most likely causes:
- High/medium/low confidence: ...

Safe next checks:
1. ...
2. ...
3. ...

What would confirm it:
- ...

Still unknown:
- ...
```

## Blackmagic / DeckLink / UltraStudio Patterns

Blackmagic errors often look obscure but usually map to one of these:

- Source format mismatch: 1080p vs 1080i, 29.97 vs 30, 59.94 vs 60, UHD/HD mismatch.
- SDI transport mismatch: 3G-SDI Level A vs Level B, wrong connector, bad cable path, converter mismatch.
- Device ownership conflict: another app already has the capture device open.
- Desktop Video mismatch: driver/firmware too old, input connector not selected, device not visible in Desktop Video.
- vMix input stale or misconfigured: wrong device, wrong format, wrong audio source, old input created under different settings.
- Reference/genlock instability: intermittent signal, flicker, or dropouts with otherwise correct settings.

Safe Blackmagic checks:

1. Confirm the source output format on the camera/switcher/converter.
2. Confirm Desktop Video sees the device and expected input connector.
3. Match the vMix input format exactly to the source.
4. Test a known-good source/cable.
5. Close other video apps before testing capture ownership.
6. Treat driver/firmware updates as planned maintenance, not an in-show quick fix.

## Audio Device Patterns

Common causes:

- 48 kHz vs 44.1 kHz sample-rate mismatch.
- ASIO/WDM mismatch or wrong channel pair.
- Windows exclusive-mode conflict.
- Embedded SDI/HDMI audio exists but vMix input selected a different audio source.
- External clock source mismatch.

## NDI / Network Patterns

Common causes:

- Firewall or Windows network profile blocks discovery.
- Source and receiver are on different VLANs/subnets without discovery support.
- NDI Access Manager group/discovery-server mismatch.
- Bandwidth saturation or unstable Wi-Fi.
- Sender is producing a format/bitrate the receiver machine cannot sustain.

## What Not To Claim

- Do not declare hardware dead from one generic error.
- Do not claim a format is correct unless the source output and vMix input settings are both confirmed.
- Do not treat a private bus, return feed, or output destination as known unless vMix state or the user confirms it.
- Do not hide uncertainty; use confidence labels.
