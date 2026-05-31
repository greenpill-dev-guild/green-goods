# Monolith Decomposition — plan

Sequence: **1.2 → 1.1** (both active), **1.3 parked**. Each is structure-only; keep tests green.

## 1.2 — `agent/services/db.ts` → domain repositories (PRD-566) — do first
- [ ] Extract the `sessions` domain into a repository module (good first slice; proves the pattern).
- [ ] Extract the remaining domains (`users`, `pendingWork`, `idempotency`, `chatMessages`, `fundingIntents`).
- [ ] Keep the facade `export const` wrappers byte-identical (no caller moves).
- [ ] `bun run build:agent` + `bun run test:agent` green.

## 1.1 — `agent/api/server.ts` → middleware/funding/routes (PRD-574)
- [ ] Extract `middleware/` (auth, rate-limit, body-limits, CORS).
- [ ] Extract `funding/` (request validation, records, webhook normalization).
- [ ] Extract `routes/` (health, ready, uploadSign, funding).
- [ ] Keep `createServer()` as the composition root; route paths unchanged.
- [ ] `bun run build:agent` + `bun run test:agent` green.

## 1.3 — `CampaignCookieJarPanel.tsx` (PRD-565) — PARKED
- [ ] BLOCKED: decide the Seasons reframe (§2.3) + campaign-cookie-jar roadmap first.
- [ ] When unparked: mechanical extraction of sub-components into `views/Cookies/components/CampaignCookieJar/` (no behavior change).

## Hub hygiene
- [ ] Formalize `status.json` via `node scripts/harness/plan-hub.mjs scaffold` in a deps-enabled checkout.
