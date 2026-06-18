# Security Policy

## Supported Versions

Security fixes are prioritized for the latest `1.x` release line.

| Version | Supported |
|---------|-----------|
| 1.x | Yes |
| <1.0 | No |

## Reporting A Vulnerability

Please report suspected vulnerabilities privately through GitHub Security Advisories for this repository when available. GitHub Security Advisories remain the primary channel for reaching the maintainers about security issues. If private vulnerability reporting is not available, open a minimal public issue that does not include exploit details, secrets, vMix Call links, passwords, private network information, or production-specific credentials.

We aim to acknowledge new vulnerability reports within 7 days.

Include:

- A short description of the issue.
- Affected version or commit.
- Reproduction steps that avoid exposing a real production system.
- Whether the issue affects Review Mode, Control Mode, or High-Impact Control.

## Operational Security Notes

CueScope talks to the vMix Web Controller API, normally at `http://localhost:8088/api/`. Keep that API on trusted machines and trusted networks. Do not expose the vMix Web Controller directly to the public internet.

Review Mode is read-first by default. Control Mode and High-Impact Control are explicit opt-ins because they can affect a live production. Treat vMix Call URLs and passwords as sensitive; the server should not return generated call links unless a caller explicitly requests them.

## Preset File Trust Boundary

The `vmix_read_preset_file`, `vmix_explain_preset_scripts`, and `vmix_audit_preset_file` tools introduce a filesystem trust boundary: they read a local `.vmix` file on the server host.

- **Explicit path or content only.** These tools require a caller-supplied absolute path or raw XML content. They do not scan directories or auto-discover preset files.
- **Extension and size guards.** Only `.vmix` files are accepted. Files larger than 25 MB are rejected.
- **Secret redaction before output.** Before any preset-derived data leaves the server, secrets are masked. Redacted values include Google API keys, stream keys, vMix Call passwords, passphrases, tokens, and other sensitive configuration fields found in element text or assignment-form attributes. The input/instance GUID (`<Key>`) is never treated as a secret and is not redacted.
- **Read-only.** These tools never write to, overwrite, or save `.vmix` files.
