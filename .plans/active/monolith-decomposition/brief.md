# Monolith Decomposition — brief

Structure-only decomposition of three oversized files. **No behavior change.** Reuses the Hub `views/<View>/components/` pattern (Hub went 1376 → 605 LOC). Part of the June maturation push ([PRD-563](https://linear.app/greenpill-dev-guild/issue/PRD-563)).

> No decomposition code was written when this hub was created — capture/tracking only. Execution happens later through the `develop → PR → main` flow.

## Targets, sequencing, risk

| # | File | LOC | Approach | Risk | Linear |
|---|---|---|---|---|---|
| 1.2 | `packages/agent/src/services/db.ts` | ~1235 | `DB` class → domain repositories (`users`, `sessions`, `pendingWork`, `idempotency`, `chatMessages`, `fundingIntents`); facade `export const` wrappers unchanged | **low — do first** | PRD-566 |
| 1.1 | `packages/agent/src/api/server.ts` | ~1497 | `middleware/` + `funding/` + `routes/`; `createServer()` stays the composition root | medium (sensitive — live public API) | PRD-574 |
| 1.3 | `packages/admin/src/views/Cookies/components/CampaignCookieJarPanel.tsx` | ~2115 | mechanical extraction of the ~9 already-separated sub-components | **PARKED** | PRD-565 |

**1.3 is parked** pending the Seasons reframe (§2.3) + a campaign-cookie-jar roadmap call: the underlying `cookie-jar` protocol/repo is dormant and the campaign concept is being reframed as a Seasons primitive, so decomposing now risks churning components that get reworked. (It is green-goods *admin UI* — not the separate, dormant `cookie-jar` sibling repo.)

## Acceptance (each, when executed)
- No behavior change; public exports / route paths unchanged.
- No decomposed file > ~600 LOC.
- `bun run build` + package tests green (agent: `bun run build:agent` + `bun run test:agent`).
- Lands via the flow: branch from `develop` → PR → CI Gate → promote `develop → main`.

## Notes
- This hub is execution truth; Linear PRD-574 / PRD-566 / PRD-565 mirror it for visibility (`source:plans`).
- The machine-tracking `status.json` for this hub should be formalized via `node scripts/harness/plan-hub.mjs scaffold` in a deps-enabled checkout — the plan-hub CLI is env-gated in fresh worktrees, so it was not generated here.
