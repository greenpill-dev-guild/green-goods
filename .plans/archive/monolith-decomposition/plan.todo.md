# Monolith Decomposition — plan

> **Archived record:** implementation is closed. Operational handoffs, reports, artifacts, and lane files were removed; any such references below describe historical execution, not live work.

Completed in July 2026: **1.2 -> 1.1 -> 1.3**. Each slice was structure-only and preserved its existing caller or route contract. The archived hub is the compact execution record; this reconciliation does not create Linear activity.

## 1.2 — `agent/services/db.ts` → domain repositories (PRD-566) — completed
- [x] Extract the `sessions` domain into a repository module (good first slice; proves the pattern).
- [x] Extract the remaining domains (`users`, `pendingWork`, `idempotency`, `chatMessages`, `fundingIntents`).
- [x] Keep the facade `export const` wrappers byte-identical (no caller moves).
- [x] `bun run build:agent` + `bun run test:agent` green (20 files / 230 tests).

## 1.1 — `agent/api/server.ts` → HTTP/funding/routes (PRD-574) — completed
- [x] Extract HTTP middleware (auth, body limits, public protection, responses, route context).
- [x] Extract `funding/` (request validation, records, Thirdweb transport, funding routes).
- [x] Extract `routes/` (health, messages, subscribe, upload sign).
- [x] Keep `createServer()` as the composition root; route paths unchanged.
- [x] `bun run build:agent` + `bun run test:agent` green (20 files / 230 tests).

## 1.3 — `CampaignCookieJarPanel.tsx` (PRD-565) — completed
- [x] The accepted Seasons roadmap specification authorized the structure-only extraction; no campaign-to-Seasons rename was included.
- [x] Mechanically extract sub-components into `views/Cookies/components/CampaignCookieJar/` while preserving `CampaignCookieJarPanel` and `CampaignCookieJarCreateWorkspace` exports through the existing import path.
- [x] Admin build, targeted Cookie Jar model test (13/13), Storybook coverage (196/196), and story-quality (168 files) pass.

## Hub hygiene
- [x] Formalize `status.json` for backlog tracking.
- [x] Reconcile completed July code and validation evidence without creating or updating Linear records.
