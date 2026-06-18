---
source_type: internal-pattern
source_basis: production troubleshooting patterns for vMix, capture devices, MCP logs, and common hardware/software mismatch failures
last_reviewed: 2026-06-16
---

# Troubleshooting Logs And Hardware Errors

Production troubleshooting should translate unclear errors into safe, testable
checks. Treat log messages as evidence, not proof. Prefer "likely cause" and
"next test" language unless the log directly identifies a failing component.

## Safe Diagnostic Posture

- Start with observed facts: current vMix state, server status, exact error text,
  device names, timestamps, and what changed before the failure.
- Ask for pasted error text or an explicitly supplied file path. Do not scan
  directories or search the host machine for logs.
- Redact or summarize secrets, stream URLs, vMix Call links, private IPs, local
  usernames, and private file paths before repeating log details.
- Separate software configuration, hardware signal, driver, operating-system,
  and production-workflow causes.
- Give reversible checks first. Do not recommend driver installs, firmware
  updates, registry changes, or show-critical reconfiguration as a first step
  without explaining risk and rehearsal requirements.

## Response Shape

For an error or log excerpt, produce:

1. Plain-English summary.
2. Evidence found in the log or state.
3. Most likely causes, each with confidence.
4. Safe next checks in operator-friendly order.
5. What would confirm or rule out each cause.
6. Remaining unknowns.

## State-Aware Troubleshooting Contract

Use log text to form hypotheses, then use CueScope state only when it can
confirm or challenge those hypotheses. Do not let live state overwrite the log:
separate "the log says" from "vMix state currently shows."

Evidence lanes:

- Log evidence: `vmix_diagnose_logs` output, original timestamp, source hint,
  sanitized excerpt, confidence, and redaction summary.
- Server reachability: `vmix://server/status` and `vmix_connection_test` when
  the issue may involve MCP startup, Web Controller, HTTP, TCP tally, host, or
  port configuration.
- Live production state: `vmix://state/summary`, `vmix_analyze_preset`, and
  `vmix_preflight` when the issue depends on current inputs, program/preview,
  overlays, input states, missing sources, or show readiness.
- Audio state: `vmix_diagnose_audio` when logs mention dropouts, mutes, buses,
  calls, sample-rate symptoms, talkback, monitoring, or mix-minus risk.
- Saved preset facts: `vmix_read_preset_file`, `vmix_explain_preset_scripts`,
  and `vmix_audit_preset_file` only when the user supplies an explicit saved
  preset path or content.

Tool selection rules:

- MCP/Web Controller errors: start with `vmix_diagnose_logs`, then use
  `vmix://server/status` and `vmix_connection_test`. Do not provide raw API
  URLs or mutating function calls as workarounds.
- Capture-device errors: use live state to see whether vMix currently has the
  expected capture input and whether it is running/offline, but do not claim the
  source format is correct unless the source device or operator confirms it.
- NDI/network errors: use live state to see whether vMix currently lists NDI
  sources or stale/offline inputs. Do not claim discovery, firewall, VLAN, or
  Access Manager settings are correct from vMix state alone.
- Audio errors: pair the log with `vmix_diagnose_audio`; distinguish live bus
  routing/mutes/call patterns from device-driver, clock, or Windows audio
  settings that vMix state cannot prove.
- Script/API errors: pair the log with `vmix_validate_script`,
  `vmix_find_input`, `vmix://inputs/fields`, or `vmix_generate_api_sequence`.
  Prefer stable keys and reviewable plans; do not expose raw mutating API URLs.
- Preset drift: use saved-preset tools only for explicit paths/content, and
  label saved-file facts as "as last saved" instead of live truth.

Do not fetch more state when:

- The MCP server cannot start or cannot connect to vMix; explain the startup or
  connection blocker first.
- The user only asked for a plain-English explanation of a pasted error and no
  state would change the answer.
- A file path or preset path was not explicitly supplied.
- The next likely check is outside vMix state, such as camera output format,
  Desktop Video settings, NDI Access Manager, firewall policy, Windows sound
  format, or hardware cabling.

## Troubleshooting Handoff Report

When a diagnosis uses logs plus state, present a concise handoff:

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

Always include the boundary: this is a read-only diagnosis, and show-disruptive
fixes need operator confirmation or rehearsal time.

## Blackmagic And Capture Device Patterns

Blackmagic, DeckLink, UltraStudio, and other capture errors often come from a
format or ownership mismatch rather than a broken card.

Common checks:

- Camera/output format vs vMix input format: resolution, frame rate, interlaced
  vs progressive, and fractional rates such as 59.94 vs 60.
- SDI transport details: Level A vs Level B for 3G-SDI, single-link vs dual-link,
  connector mapping, cable path, converter settings, and embedded audio.
- Blackmagic Desktop Video setup: device visible, driver/firmware current enough
  for the card, input connector selected, and no other application holding the
  device.
- vMix input settings: exact capture device selected, matching video standard,
  audio source selection, deinterlace expectations, and whether a stale input
  needs to be removed and re-added during a rehearsal.
- Reference/genlock: mismatched reference can cause intermittent or unstable
  signal behavior even when the format looks correct.

Safe next tests:

- Confirm the camera or upstream device output format on the device itself.
- Confirm Blackmagic Desktop Video sees the same format.
- Match the vMix input format to the actual device output.
- Test a known-good cable/source on the same input.
- Test the same source in Blackmagic Media Express or a vendor utility when it
  is safe and vMix is not using the device.

## Audio Device Patterns

Audio errors often come from clock, sample-rate, channel-map, or exclusive-use
conflicts.

Common checks:

- 48 kHz vs 44.1 kHz mismatch between vMix, Windows, interface driver, and
  embedded SDI/HDMI audio.
- ASIO/WDM device choice and channel-pair mapping.
- Windows exclusive mode or another app holding the device.
- Embedded audio present on the capture feed but not selected as the vMix audio
  source.
- Audio clock source mismatch on interfaces that support external clocking.

## Network And NDI Patterns

For NDI, SRT, browser, and remote-source errors, distinguish discovery,
transport, bandwidth, and endpoint health.

Common checks:

- Windows network profile and firewall rules.
- Same subnet/VLAN or intentional routing between subnets.
- NDI Access Manager groups and discovery server settings.
- Sender resolution/frame rate/bitrate vs network capacity.
- Multicast/unicast behavior and managed switch features.

## MCP And vMix Connectivity Patterns

Use `vmix_connection_test` for MCP-to-vMix connectivity before deeper diagnosis.

Common checks:

- vMix is running and Web Controller is enabled.
- `VMIX_HOST` and `VMIX_HTTP_PORT` match the reachable vMix machine.
- TCP tally is optional; HTTP working with TCP failing is degraded, not fatal.
- MCP client startup failures often involve PATH differences, especially
  `npx` on Windows clients.

## Confidence Rules

- High confidence: the log explicitly states the missing device, unsupported
  format, denied access, or failed host/port.
- Medium confidence: several symptoms point to one mismatch, but device settings
  have not been confirmed.
- Low confidence: the log is generic, truncated, or missing timestamps/context.

When confidence is low, ask for the exact error text, recent changes, device
model, source format, vMix version, driver version, and whether the failure is
constant or intermittent.
