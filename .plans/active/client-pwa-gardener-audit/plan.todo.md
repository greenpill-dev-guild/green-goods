# Client PWA Gardener Audit Plan

**Feature Slug**: `client-pwa-gardener-audit`
**Status**: `ACTIVE — qa_pass_1 PASSED, qa_pass_2 READY`
**Created**: `2026-04-30`
**Last Updated**: `2026-05-03`

## Current State

- [x] Read-only audit captured in `audit.md`.
- [x] Implementation summary and follow-up fixes captured in `fixes.md`.
- [x] Manual browser pass complete — see `handoffs/claude-qa-pass-1.md` (browser-verified shell boundary, `/home/:id` non-operator header gating, `/profile` collapsed disclosure; `/login` and assessment route remain code-only).

## Remaining QA

`qa_pass_1` (claude) — **DONE 2026-05-03**, see handoff. `qa_pass_2` (codex) is now `ready`. Suggested final closeout for codex:

- Re-confirm `/login` passkey-first via `Login.test.tsx` red/green or a fresh incognito profile (claude could not exercise without destroying the active session).
- Re-confirm `/home/:id/assessments/:assessmentId` gardener rendering via `Assessment.test.tsx` (no assessment data exists in the live dev dataset).
- Confirm en/es/pt parity once more on the `app.profile.accountDetailsTitle` / `app.profile.accountDetailsHint` keys before archive.

If the pass finds a real divergence, write a focused follow-up with RED/GREEN proof before changing code.
