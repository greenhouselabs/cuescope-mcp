---
source_type: example
example_type: troubleshooting-corpus
source_basis: public vendor documentation plus sanitized synthetic fixtures
last_reviewed: 2026-06-16
---

# Troubleshooting Corpus

This corpus provides sanitized, source-grounded troubleshooting fixtures for
Review Mode diagnosis. The excerpts are intentionally synthetic. They are not
private production logs, copied vendor logs, or claims about one user's preset.

Use these examples to evaluate whether an assistant can translate unclear vMix,
MCP, capture-device, audio-device, NDI, and script errors into safe next checks.

## Source Anchors

- vMix Developer API: https://www.vmix.com/help28/DeveloperAPI.html
- vMix Web Controller: https://www.vmix.com/help28/WebController.html
- vMix Audio: https://www.vmix.com/help28/Audio.html
- vMix Audio Settings: https://www.vmix.com/help28/AudioSettings.html
- vMix Scripting: https://www.vmix.com/help28/Scripting.html
- Blackmagic Capture and Playback support: https://www.blackmagicdesign.com/support/family/capture-and-playback
- Blackmagic DeckLink technical specifications: https://www.blackmagicdesign.com/products/decklink/techspecs
- NDI Access Manager: https://docs.ndi.video/all/using-ndi/ndi-tools/ndi-tools-for-windows/access-manager
- NDI Discovery: https://docs.ndi.video/all/using-ndi/ndi-tools/ndi-tools-for-windows/discovery
- NDI Discovery Server notes: https://docs.ndi.video/all/using-ndi/ndi-tools/ndi-tools-for-windows/discovery/discovery-server-additional-information
- Node.js system errors and child process events: https://nodejs.org/api/errors.html and https://nodejs.org/api/child_process.html

## Fixture Rules

Every fixture should include:

- A raw-looking sanitized excerpt.
- Expected plain-English summary.
- Likely causes with confidence.
- Safe next checks.
- What would confirm or rule out the theory.
- Things the assistant must not claim.
- Redaction expectations.

Do not add real stream keys, vMix Call URLs, passwords, private IP addresses,
private hostnames, local usernames, local file paths, venue names, or client
names. Use bracketed placeholders instead.

## TR-001 Blackmagic Capture Format Mismatch

Surface: `blackmagic`

Source grounding: Blackmagic capture devices expose supported formats and
driver/software paths through their product specs and support center. vMix
capture inputs depend on the actual source format matching the selected input
settings.

Sanitized excerpt:

```text
[Capture] Device: DeckLink Mini Recorder HD
[Capture] Input: SDI
[Capture] Requested format: 1080p60
[Capture] Signal status: no frames received
[Operator note] Camera menu says: 1080i59.94
```

Expected summary:

The capture card is probably present, but the source format does not match the
format vMix is trying to receive.

Likely causes:

- High confidence: vMix input is set for progressive 60 while the source reports
  interlaced 59.94.
- Medium confidence: upstream converter or switcher is changing the signal.
- Low confidence: hardware failure. Nothing in this excerpt proves the card is
  bad.

Safe next checks:

1. Confirm the camera, switcher, or converter output format on the device.
2. Confirm the same format in Blackmagic Desktop Video or a vendor utility when
   vMix is not using the device.
3. Match the vMix input standard to the confirmed source format.
4. Test a known-good source and cable during rehearsal.

Must not claim:

- Do not declare the DeckLink card defective.
- Do not recommend driver or firmware changes as the first in-show step.
- Do not assume `1080p60` and `1080i59.94` are interchangeable.

Redaction expectations:

- Preserve device model and video standards.
- Redact venue, client, hostname, and operator names if present.

## TR-002 Blackmagic Device Ownership Conflict

Surface: `blackmagic`

Sanitized excerpt:

```text
[Capture] Open device failed
[Capture] Device: DeckLink Duo 2 / Channel 1
[Capture] Error: access denied; device already in use
[Recent apps] Media Express, OBS, video meeting app
```

Expected summary:

The device may already be open in another application, so vMix cannot claim the
capture channel.

Likely causes:

- High confidence: another app is using the capture device.
- Medium confidence: a stale process or previous crash left the device locked.
- Low confidence: driver installation problem.

Safe next checks:

1. Close capture or meeting apps that may use the same device.
2. Confirm no preview utility is holding the DeckLink input.
3. Reopen only vMix and test the same input.
4. Reboot only during a maintenance window if the device remains locked.

Must not claim:

- Do not tell the user to uninstall drivers from one access-denied log.
- Do not assume the conflicting app is malicious or broken.

Redaction expectations:

- Redact usernames, process paths, and meeting names.
- Keep generic app categories if enough for diagnosis.

## TR-003 SDI Connector Or Transport Mismatch

Surface: `blackmagic`

Sanitized excerpt:

```text
[Capture] Device: DeckLink Duo 2
[Capture] Connector: SDI 3
[Capture] Standard: 1080p59.94
[Capture] Signal: none
[Operator note] Source works on monitor; converter set to 3G-SDI
```

Expected summary:

The source may be valid, but the wrong connector, SDI transport mode, cable
path, or converter setting may be feeding the capture card.

Likely causes:

- Medium confidence: connector mapping or cable path mismatch.
- Medium confidence: 3G-SDI Level A/B or converter setting mismatch.
- Low confidence: card failure.

Safe next checks:

1. Verify the physical connector map for the exact DeckLink model.
2. Trace source to converter to capture card one hop at a time.
3. Check 3G-SDI Level A/B and single-link/dual-link expectations.
4. Test the same source on a known-good card channel during rehearsal.

Must not claim:

- Do not say the upstream source is dead when it works on a monitor.
- Do not assume every DeckLink channel has the same connector direction.

Redaction expectations:

- Preserve connector labels and video standards.
- Redact venue cable labels if they reveal private layouts.

## TR-004 Audio Sample Rate Or Clock Drift

Surface: `audio`

Source grounding: vMix audio docs describe audio clock drift and input channel
format/routing controls.

Sanitized excerpt:

```text
[Audio] Intermittent clicks and short dropouts on USB interface
[Audio] Windows device format: 44.1 kHz, 24-bit
[Audio] vMix show audio: 48 kHz expected by production
[Operator note] Embedded SDI audio remains stable
```

Expected summary:

This looks like an audio format or clock mismatch isolated to the USB interface,
not a global vMix audio failure.

Likely causes:

- High confidence: sample-rate mismatch between Windows/interface and show
  expectations.
- Medium confidence: USB interface clock source or driver mode mismatch.
- Low confidence: vMix audio mixer bug.

Safe next checks:

1. Confirm the interface, Windows sound device, and vMix input are all set for
   the intended sample rate.
2. Check ASIO/WDM mode and channel-pair mapping.
3. Disable exclusive-use behavior only during a controlled test.
4. Compare with embedded SDI/HDMI audio to isolate the failing path.

Must not claim:

- Do not blame all vMix audio if only one device path is affected.
- Do not recommend changing every show device mid-production.

Redaction expectations:

- Redact device serial numbers.
- Preserve sample rates, channel counts, and driver mode.

## TR-005 NDI Discovery, Group, Or Network Boundary

Surface: `ndi`

Source grounding: NDI Access Manager controls source visibility through send
and receive groups, and NDI Discovery can show registered senders/receivers and
server connection settings.

Sanitized excerpt:

```text
[NDI] Sender visible in Studio Monitor on source machine
[NDI] Receiver: vMix machine cannot see source
[NDI] Access Manager sender group: Stage
[NDI] Access Manager receiver group: Public
[Network] Sender VLAN: [PRIVATE_VLAN_A]; receiver VLAN: [PRIVATE_VLAN_B]
```

Expected summary:

The NDI source may be healthy, but discovery or visibility is blocked by group
settings or network boundaries.

Likely causes:

- High confidence: Access Manager send/receive group mismatch.
- Medium confidence: sender and receiver are on different subnets or VLANs
  without a discovery plan.
- Medium confidence: firewall or network profile blocks discovery or transport.

Safe next checks:

1. Match the relevant send and receive groups intentionally.
2. Confirm both machines use the expected Discovery Server or local discovery
   approach.
3. Check firewall/network profile with IT or the network owner.
4. Verify whether vMix can see a known-good local NDI test source.

Must not claim:

- Do not assume the NDI sender is offline just because vMix cannot discover it.
- Do not tell the user to disable firewalls broadly on a production network.

Redaction expectations:

- Redact VLAN IDs, private IPs, hostnames, and site names.
- Preserve group names only when they are generic or user-approved.

## TR-006 vMix Web Controller Or Host/Port Failure

Surface: `mcp`

Source grounding: vMix API uses the same address as the Web Interface and the
Web Controller is configured in vMix settings. The API returns XML state when
called without function parameters.

Sanitized excerpt:

```text
[MCP] vmix_connection_test failed
[HTTP] connect ECONNREFUSED [PRIVATE_HOST]:8088
[Config] VMIX_HOST=[PRIVATE_HOST]
[Config] VMIX_HTTP_PORT=8088
```

Expected summary:

The MCP server cannot reach the vMix HTTP/Web Controller endpoint at the
configured host and port.

Likely causes:

- High confidence: vMix is not running, Web Controller is disabled, or the port
  is wrong.
- Medium confidence: firewall or host mismatch between MCP machine and vMix
  machine.
- Low confidence: MCP code bug.

Safe next checks:

1. Confirm vMix is open on the target machine.
2. Confirm Web Controller is enabled and note its configured address/port.
3. Confirm `VMIX_HOST` and `VMIX_HTTP_PORT` match that target.
4. If remote, confirm firewall rules on the trusted production network.

Must not claim:

- Do not provide mutating raw API calls as a workaround.
- Do not print the user's private host/IP back unless needed.

Redaction expectations:

- Redact private hostnames, private IPs, and local path fragments.
- Preserve port numbers and environment variable names.

## TR-007 MCP Client Cannot Spawn npx

Surface: `mcp`

Source grounding: Node child processes emit an error when a process cannot be
spawned, and `ENOENT` indicates a missing path component.

Sanitized excerpt:

```text
[Client] Failed to start MCP server
[Node] Error: spawn npx ENOENT
[Config] command=npx
[OS] Windows
```

Expected summary:

The MCP client process cannot find `npx` in the PATH it uses to launch servers.
This is a client launch environment issue, not a vMix preset problem.

Likely causes:

- High confidence: `npx` is not on the MCP client's PATH.
- Medium confidence: Windows client needs to launch through `cmd /c npx`.
- Medium confidence: Node.js is installed for the user shell but not visible to
  the GUI client.

Safe next checks:

1. Confirm Node.js and npm are installed in a normal terminal.
2. Use the documented Windows MCP config shape that launches through `cmd`.
3. Fully restart the MCP client after changing config.
4. If needed, use an absolute Node path to the built server entry point.

Must not claim:

- Do not diagnose this as a vMix Web Controller failure.
- Do not ask the user to reinstall vMix.
- Do not leak local usernames from client log paths.

Redaction expectations:

- Redact local user directories and client profile paths.
- Preserve `spawn npx ENOENT` and command fields.

## TR-008 VB.NET Script Syntax Error

Surface: `script`

Source grounding: vMix exposes custom programming scripts in 4K and Pro
editions; the MCP's scripting knowledge and validator enforce VB.NET-oriented
rules before operator use.

Sanitized excerpt:

```text
[vMix Script] Compile failed
[Line 14] If activeInput == targetInput Then
[Error] BC30201: Expression expected
```

Expected summary:

The script appears to use non-VB.NET comparison syntax. vMix scripting expects
VB.NET-style expressions.

Likely causes:

- High confidence: `==` should be `=` in a VB.NET comparison.
- Medium confidence: other JavaScript-style syntax may exist nearby.
- Low confidence: missing input or title field; this excerpt is syntax-level.

Safe next checks:

1. Replace JavaScript-style comparison with VB.NET syntax.
2. Review nearby concatenation, declarations, and loop sleeps.
3. Run `vmix_validate_script` before pasting into vMix.
4. If the script references inputs, validate exact names or stable keys.

Must not claim:

- Do not say the script is safe to run just because this syntax issue is fixed.
- Do not execute or suggest live execution in Review Mode.

Redaction expectations:

- Preserve sanitized line numbers and syntax snippets.
- Redact private input titles if they identify a client or show.

## TR-009 vMix API 500 From Ambiguous Input Reference

Surface: `vmix-api`

Source grounding: vMix API calls return HTTP 500 on errors. Input references can
be by number, case-sensitive full name, or GUID/key.

Sanitized excerpt:

```text
[MCP Plan Review] API response: HTTP 500
[Function] SetText
[Input] LowerThird
[SelectedName] Headline.Text
[State note] Matching saved inputs: LowerThird, lowerthird, LowerThird - Replay
```

Expected summary:

The function may be valid, but the input reference is ambiguous or case
sensitive and may not resolve to the intended title input.

Likely causes:

- High confidence: ambiguous input name.
- Medium confidence: wrong `SelectedName` for the actual title template.
- Low confidence: vMix API unavailable, because the response came from vMix.

Safe next checks:

1. Resolve the target input by stable key or exact validated full title.
2. Confirm the title field name from `vmix://inputs/fields`.
3. Generate a reviewable corrected API plan rather than retrying blindly.
4. If the input is from a saved preset, compare saved-vs-live drift.

Must not claim:

- Do not assume the first fuzzy match is the intended title.
- Do not expose raw mutating API URLs in Review Mode.

Redaction expectations:

- Redact private title text values.
- Preserve function name, field name, and sanitized input titles.

## Coverage Gaps

This first corpus is intentionally narrow. It does not yet cover GPU driver
crashes, replay storage bandwidth, stream-provider authentication errors,
camera-control/PTZ failures, plugin/VST errors, Windows audio driver stack
traces, or hardware vendor logs with proprietary error codes.

Add new fixtures when a public source or safely sanitized user report teaches a
repeatable diagnostic pattern that is not already covered.
