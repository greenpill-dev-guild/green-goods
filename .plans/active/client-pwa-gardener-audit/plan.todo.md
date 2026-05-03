# Client PWA Gardener Audit Plan

**Feature Slug**: `client-pwa-gardener-audit`
**Status**: `ACTIVE — QA REMAINS`
**Created**: `2026-04-30`
**Last Updated**: `2026-05-03`

## Current State

- [x] Read-only audit captured in `audit.md`.
- [x] Implementation summary and follow-up fixes captured in `fixes.md`.
- [ ] Manual browser pass still owed before archive.

## Remaining QA

Run the browser walkthrough listed in `fixes.md`:

- `/login` new-user passkey-first path.
- `/home/:id` non-operator header gating.
- `/profile` account details collapsed by default.
- `/home/:id/assessments/:assessmentId` non-operator assessment rendering.

If the pass finds a real divergence, write a focused follow-up with RED/GREEN proof before changing code.
