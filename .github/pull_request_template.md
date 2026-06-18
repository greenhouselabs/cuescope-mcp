## Summary

CueScope is source-available, not open source. Pull requests should be used
only for Greenhouse-authorized changes.

- 

## Verification

- [ ] `npm run build`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm audit --audit-level=moderate`
- [ ] `node scripts/validate-api-calls.mjs`

## Safety Checklist

- [ ] Review Mode remains read-first by default.
- [ ] Any live-control behavior remains gated behind Control Mode.
- [ ] Any high-impact behavior remains gated behind High-Impact Control.
- [ ] No vMix Call URLs, passwords, tokens, or local secrets are logged or returned unintentionally.
- [ ] Docs and skill guidance were updated for user-visible behavior changes.
