# CueScope Skills

Skills are compact guidance packages that help assistants reason about vMix workflows without loading the whole project. The current direction is Review Mode first: inspect state, explain what is present, generate reviewable artifacts, and treat live-control tools as Control Mode only.

## Default Review Tools

Use these before any operator workflow:

| Tool | Purpose |
|------|---------|
| `vmix_show_review` | Natural-language show review that coordinates live state, audio diagnosis, output readiness, preflight, checklist guidance, and optional saved-preset audio/audit context |
| `vmix_analyze_preset` | Understand the current preset, production roles, output readiness, preflight status, and likely risks |
| `vmix_generate_show_checklist` | Create a reviewable rehearsal, go-live, recovery, or end-show operator handoff |
| `vmix_find_input` | Locate inputs by number, name, key, type, or fuzzy match |
| `vmix_inspect_input` | Live-first input inspection for questions like "what is Input 8"; asks first for a server-host `.vmix` path only for saved-only evidence, with raw XML as a fallback |
| `vmix_explain_input` | Explain one input in context |
| `vmix_diagnose_audio` | Review audio routing, mute/solo state, buses, and mix-minus risk |
| `vmix_diagnose_outputs` | Review recording, streaming, external output, video/audio path, and destination blind spots |
| `vmix_generate_script` | Generate a preflight-aware reviewable VB.NET script artifact without executing it |
| `vmix_validate_script` | Validate VB.NET script text before human review or operator use |
| `vmix_generate_api_sequence` | Generate a preflight-aware reviewable API command plan without calling vMix |
| `vmix_compare_xml_snapshots` | Explain meaningful differences between vMix XML snapshots |
| `vmix_read_preset_file` | Read-only, redacted inventory of a saved `.vmix` preset file: compact summary by default, full scripts/triggers with `detailMode="full"` (as last saved) |
| `vmix_explain_preset_scripts` | Read-only review and risk flags for VB.NET scripts stored in a saved `.vmix` preset, validated against live state; never executes scripts |
| `vmix_audit_preset_file` | Read-only cross-reference of a saved `.vmix` preset against live vMix state: missing scripts, absent trigger targets, saved-vs-live drift, and target-input trigger/script references |
| `vmix_preflight` | Go-live readiness report with a prioritized `ready`/`caution`/`not-ready` verdict; optionally cross-references a saved `.vmix` preset (read-only) |
| `vmix_connection_test` | Test connectivity to vMix and diagnose connection problems |

## Available Skills

| Skill | Review-First Purpose | Control Knowledge Preserved |
|-------|---------------------|------------------------------|
| `vmix-basics` | Explain switching state and generate safe transition plans | Cut, fade, preview, stingers, FTB |
| `vmix-audio` | Diagnose buses, mutes, calls, ducking, and mix-minus issues | Volume, mute, and bus assignment tools |
| `vmix-graphics` | Inspect title fields and plan graphics updates | Title text, image, countdown, and animation tools |
| `vmix-overlays` | Explain overlay usage and plan overlay timing | Overlay in, out, preview, and PIP tools |
| `vmix-scripting` | Generate and validate reviewable VB.NET scripts | Script run, stop, save, and templates in Control Mode |
| `vmix-replay` | Review replay workflows and scriptable replay patterns | Replay marking and playback controls |
| `vmix-show-building` | Analyze and plan show setup from requirements | Show-building and participant tools |
| `vmix-streaming` | Review recording, streaming, output, and go-live risk | Recording, streaming, external output, and snapshot tools |
| `vmix-troubleshooting` | Interpret pasted errors, logs, device issues, and hardware/software mismatches | Operator-confirmed maintenance and rehearsal-only fixes |

## Mode Boundary

Review Mode is the default and should be assumed unless the active server status says otherwise. In Review Mode, skills should prefer:

1. Read `vmix://server/status`.
2. Read current state resources such as `vmix://state/summary`, `vmix://state/relationships`, `vmix://inputs`, and `vmix://audio`.
3. Use live-state Review tools first for current show/input questions.
4. Ask for an explicit saved `.vmix` path on the CueScope server host only when the user needs saved scripts, triggers, title countdown/data-source setup, or saved-vs-live drift. Raw XML content is a fallback when the path is unavailable; chat-uploaded attachments may not be readable by the MCP server.
5. For one-input saved-preset questions, use compact/targeted summaries before broad script reviews: `vmix_read_preset_file` summary for title metadata/data-source bindings, and `vmix_audit_preset_file` with `targetInput` for trigger/script references.
6. Use `detailMode="full"` or `vmix_explain_preset_scripts` when the user asks for exact script bodies, validation, or rewrite guidance.
7. Return reviewable artifacts, assumptions, risk notes, and test steps.

Control tools should be referenced only when `VMIX_CONTROL_MODE=true` is active or when explaining what an operator could do manually after review. High-impact control tools for scripts, batch commands, recording, streaming, snapshots, presets, destructive input management, output routing, show-building, and replay recording also require `VMIX_HIGH_IMPACT=true`.

Do not offer or echo raw vMix HTTP URLs, curl/Invoke-WebRequest commands, shell-bang commands, or shortcut-function strings as Review Mode workarounds for mutating actions, even as negative examples. If a requested action is gated, refuse to execute it through the MCP, offer read-only checks or reviewable artifacts, and explain the required opt-in flags/restart boundary.

## Common Skill Chains

| User Request | Skills Needed |
|--------------|---------------|
| "What is Input 8?" | Use `vmix_inspect_input` first |
| "Explain my preset before the show" | `vmix-basics` + `vmix-graphics` + `vmix-audio` |
| "Check my show before we go live" | Use `vmix_show_review`, then load focused skills only for deeper follow-up |
| "Are my stream/recording outputs ready?" | Use `vmix_diagnose_outputs`, then `vmix_diagnose_audio` if the destination audio path needs deeper review |
| "Diagnose my guest audio" | `vmix-audio` + `vmix-streaming` |
| "Generate a camera rotation script" | `vmix-scripting` + `vmix-basics` |
| "Plan a lower third sequence" | `vmix-graphics` + `vmix-overlays` + `vmix-scripting` |
| "Review my go-live setup" | `vmix-streaming` + `vmix-audio` + `vmix-basics` |
| "Compare XML before and after a routing change" | `vmix-audio` + `vmix-basics` |
| "Explain this Blackmagic/vMix error" | `vmix-troubleshooting` + `vmix-audio` or `vmix-streaming` as needed |

## Skill Authoring Rules

1. State inspection comes before action planning.
2. Generated scripts and API sequences are reviewable artifacts, not execution requests.
3. Input names are case-sensitive; prefer stable keys or validated exact names.
4. Current input questions use live state first; saved `.vmix` files are explicit user-provided evidence for saved-only details, including GT/title countdown and data-source metadata.
5. VB.NET loops must include `Sleep()`.
6. Streaming, recording, batch commands, preset changes, output routing, show-building, and script execution are high-impact control workflows.

## Bring Your Own Skills

Skills are discovered from disk, so you can add your own without modifying or rebuilding the package:

1. Create a directory of skill folders, each containing a `SKILL.md` (e.g. `my-skills/my-workflow/SKILL.md`).
2. Set `VMIX_USER_SKILLS_PATH` to that directory in your MCP client config.

Your skills are merged into the `vmix://skills` resource alongside the bundled ones. Follow the authoring rules above so Review-first behavior and mode boundaries stay consistent.

---

Skills system inspired by [agentic-obs](https://github.com/ironystock/agentic-obs), adapted for professional vMix workflows.
