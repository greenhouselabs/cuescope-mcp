# Try CueScope (tester guide)

This is a hands-on tester guide for trying CueScope from a packaged build.

Connect vMix to Claude and ask it about your production — read-only.
It looks at your live vMix setup, explains it, spots problems, and writes
reviewable scripts/checklists. **It never changes your vMix.**

Takes about 5 minutes.

---

## Before you begin

You'll need three things:

- ✅ **vMix open**, with the Web Controller on
  *(vMix → Settings → Web Controller → tick Enabled)*. A free vMix trial works.
- ✅ **Node.js 20 or newer** — check by running `node --version`
- ✅ **Claude** — either the **Claude desktop app** or **Claude Code** (CLI)

> The setup below assumes vMix and Claude are on the **same PC** — no IP address
> needed. (Different machines? See the note at the bottom.)

---

## Step 1 — Install it

Save the `.tgz` you were provided (or build one yourself from a repo checkout with `npm install`, then `npm pack`), then in a terminal run:

```powershell
npm install -g .\greenhouselabs-cuescope-mcp-<version>.tgz
```

Replace `<version>` with the version in the filename.

That's it — nothing to configure here.

---

## Step 2 — Connect it to Claude

**If you use the Claude desktop app:**

1. Open `%APPDATA%\Claude\claude_desktop_config.json`
   *(create it if it doesn't exist)*
2. Paste this in and save:

   ```json
   {
     "mcpServers": {
       "cuescope": { "command": "cuescope-mcp" }
     }
   }
   ```
3. **Fully quit and reopen** the Claude app.

**If you use Claude Code (CLI):** just run

```powershell
claude mcp add cuescope -- cuescope-mcp
```

---

## Step 3 — Test it

Start a new chat in Claude and paste this:

> **Use CueScope. Read `vmix://server/status` and `vmix://state/summary`, then explain my current vMix setup in plain English. Don't change anything in vMix.**

If it's working, Claude will say it's in **Review Mode** and describe your *actual*
inputs and preset.

Then try the fun one:

> **Diagnose the audio routing in my current vMix preset and generate a go-live checklist. Don't change anything in vMix.**

---

## If something's off

- **Claude doesn't see "cuescope"** → make sure you fully restarted Claude after Step 2.
- **It can't read vMix** → confirm the Web Controller is on, then open
  `http://localhost:8088/api/` in a browser; you should see XML.
- **"command not found"** → confirm Node 20+ with `node --version`, then re-run Step 1.

---

## vMix on a different PC?

If Claude runs on a different computer than vMix, tell it the vMix PC's IP address.

- **Desktop app:** add an `env` block —
  `"cuescope": { "command": "cuescope-mcp", "env": { "VMIX_HOST": "192.168.1.50" } }`
- **Claude Code:** `claude mcp add cuescope -e VMIX_HOST=192.168.1.50 -- cuescope-mcp`

*(Keep the vMix Web Controller on a trusted local network — don't expose it to the internet.)*

---

## Removing it

When you're done testing, remove it cleanly:

1. Disconnect it from Claude:
   - **Claude Code:** `claude mcp remove cuescope`
   - **Claude desktop app:** delete the `"vmix"` entry from `claude_desktop_config.json`, then fully quit and reopen the app.
2. Uninstall the package:

   ```powershell
   npm uninstall -g @greenhouselabs/cuescope-mcp
   ```
