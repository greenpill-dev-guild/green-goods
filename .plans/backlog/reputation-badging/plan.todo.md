# Reputation & Badging Plan

**Feature Slug**: `reputation-badging`
**Epic**: [#466](https://github.com/greenpill-dev-guild/green-goods/issues/466)
**Outcome Milestone**: [Outcome: Badges live across 3+ pilot gardens](https://github.com/greenpill-dev-guild/green-goods/milestone/16) (#16)
**Spec**: [spec.md](./spec.md)
**Groundwork Issue**: [#457 — feat(greenwill): async badge issuer service](https://github.com/greenpill-dev-guild/green-goods/issues/457)
**Status**: `BACKLOG`
**Created**: `2026-04-17`
**Last Updated**: `2026-04-27`
**Hard Deadline**: Lock + schema deploy **2026-04-25**; pilot rollout **2026-06-30**
**Branch Strategy**: `feature/reputation-badging` with phase commits for independent rollback

> **For agentic workers:** Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement task-by-task. Steps use checkbox (`- [ ]`) syntax.

> 2026-04-25 cleanup note: GreenWill Phase 0 badge lock/schema deployment, the contracts confidence gate, and portable badge rendering remain owned here. Do not chase deleted admin UI planning paths for this work.

> 2026-04-27 scope update: moved to backlog. The April 28 presentation/release scope is only the existing three initial GreenWill badges (`genesis`, `first-work`, `first-support`). This hub is the later six-badge portable reputation expansion and should not block the current closeout.

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Role C — reputation + access gating + portable cross-project identity | Single badge type serves GG display, sibling-project gating (Coop/WEFA), and universal EAS discoverability; avoids forking per-role primitives. |
| 2 | Backlog all 6 expansion badges after initial 3-badge closeout | The current repo already has the initial GreenWill badge surface. The six-badge taxonomy is a later portable reputation expansion, not the April 28 scope. |
| 3 | Dual anchor: Unlock Protocol lock per badge + EAS attestation per badge | Unlock key = revocable access credential (ERC-721, gate-compatible); EAS = permanent history. Neither alone covers both concerns. |
| 4 | Greenwill = background issuer (not user-initiated) | Auto-issuance removes UX friction and prevents claim-hoarding; matches #457 groundwork design. |
| 5 | Envio GraphQL subscriptions for `on-event` cadence + daily cron for `daily` cadence | Subscriptions give low-latency issuance; cron is backstop for missed events and re-eval of rolling windows / role expiry. |
| 6 | Soulbound (non-transferable) Unlock locks | Reputation must be non-tradeable; configured at lock creation (Unlock supports `transferrable=false`). |
| 7 | Green Goods trusted attester address writes EAS attestations | Single canonical attester simplifies sibling-project trust model; key held by Greenwill service, rotatable via deployment artifact. |
| 8 | Portability = ship issuance side only | EAS is universal by design; Unlock keys are ERC-721. Sibling-project recognition is demo-level in Q2; may slip to Q3 (risk #3 in spec). |
| 9 | 6 lock addresses + 1 shared `GreenGoodsBadge` schema UID recorded in `deployments/{chainId}-latest.json` | Canonical source for sibling projects; matches repo convention. |
| 10 | Indexer stays out of EAS/Unlock — admin queries EAS directly via `useBadges` | Respects CLAUDE.md indexer boundary; EAS has public GraphQL API. |
| 11 | `BadgeDefinition` registry at `packages/agent/src/badges/_registry.ts` | Underscore prefix = internal; evaluators imported and registered explicitly (no dynamic glob). |

## Requirements Coverage

| Spec Requirement | Planned Phase · Task | Status |
|---|---|---|
| Deploy 6 soulbound Unlock locks on Arbitrum | 0.2 | ⬜ |
| Register 1 shared EAS schema (`GreenGoodsBadge` shape; badge-specific meaning lives in `badgeType`) | 0.3 | ⬜ |
| `BadgeDefinition` interface + `_registry.ts` | 1.1 | ⬜ |
| `greenwillIssuer.ts` main loop (builds on #457) | 1.2 | ⬜ |
| Envio GraphQL subscription wiring | 1.3 | ⬜ |
| `verified-gardener` evaluator (on-event) | 2.1 | ⬜ |
| `impact-verified` evaluator (on-event) | 2.2 | ⬜ |
| `garden-operator` evaluator (on-event for grant + daily for revoke) | 2.3 | ⬜ |
| `active-contributor` evaluator (daily, 1yr expiry) | 3.1 | ⬜ |
| `stewardship` evaluator (daily, lifetime) | 3.2 | ⬜ |
| `community-builder` evaluator (daily, lifetime) | 3.3 | ⬜ |
| Daily cron handler (`evaluate-badges`) | 3.4 | ⬜ |
| `unlockClient.ts` (grant + revoke keys) | 4.1 | ⬜ |
| `easBadgeWriter.ts` (attestation creation) | 4.2 | ⬜ |
| IPFS evidence uploader | 4.3 | ⬜ |
| Idempotency via `BadgeIssued` log + retry queue | 4.4 | ⬜ |
| `useBadges(address)` shared hook | 5.1 | ⬜ |
| `modules/badges.ts` display metadata | 5.2 | ⬜ |
| Admin `BadgeShelf` + `BadgeDetail` | 6.1 | ⬜ |
| Client `BadgeShelf` (reuses shared visual) | 6.2 | ⬜ |
| Pilot garden rollout (3+ gardens) | 7.1 | ⬜ |
| Sibling-project recognition demo (Coop or WEFA) | 7.2 | ⬜ |
| Observability: issuance counts, failed queue, heartbeat | 7.3 | ⬜ |

## CLAUDE.md Compliance

- ✅ All React hooks in `@green-goods/shared` (`useBadges`)
- ✅ Barrel imports only (`import { useBadges, BadgeMetadata } from "@green-goods/shared"`)
- ✅ Contract/lock/schema addresses read from `deployments/{chainId}-latest.json`
- ✅ Error handling via `parseContractError()` + `USER_FRIENDLY_ERRORS`; mutations via `createMutationErrorHandler()`
- ✅ Logger from shared (no `console.log` in Greenwill service, evaluators, or UI)
- ✅ Query keys via `queryKeys.*` helpers (add `queryKeys.badges(address)`)
- ✅ Indexer boundary respected — no EAS / Unlock re-indexing; shared hook queries EAS directly
- ✅ `bun run test` (never `bun test`) for agent, shared, admin, client
- ✅ `bun build` respects dependency order (contracts → shared → agent → admin/client)
- ✅ Intent Priorities: #2 Security — trusted attester key managed via deployment artifact + rotation runbook; #3 UX — auto-issuance removes friction

## Phase 0 — Locks, Schemas, Scaffolding (2026-04-17 → 2026-04-25)

### 0.1 Branch + directory

- [ ] Create branch `feature/reputation-badging` from `develop`
- [ ] Create `packages/agent/src/badges/` with `.gitkeep`
- [ ] Create `packages/agent/src/services/` (verify exists) and reserve `greenwillIssuer.ts`, `unlockClient.ts`, `easBadgeWriter.ts` slots
- [ ] Commit scaffolding: `feat(agent): scaffold reputation-badging module dirs`

### 0.1a Contract confidence gate

**Files:**
- Modify: `packages/contracts/test/unit/GreenWill.t.sol`
- Create: `packages/contracts/test/integration/GreenWillWorkflow.t.sol`
- Create: `packages/contracts/test/fork/ArbitrumGreenWillSupport.t.sol`

- [ ] Add upgrade-preservation coverage for `GreenWill`
- [ ] Add one workflow test covering genesis claim, first-work claim, and first-support issuance in a single contracts path
- [ ] Add one Arbitrum fork test that routes live WETH support through an Octant vault and asserts `FIRST_SUPPORT` issuance
- [ ] Broadcast is blocked until these pass:
  - `cd packages/contracts && bun run test:match 'test/unit/GreenWill*.t.sol'`
  - `cd packages/contracts && bun run test:match 'test/integration/GreenWillWorkflow.t.sol'`
  - `cd packages/contracts && FOUNDRY_PROFILE=fork bun run test:match 'test/fork/ArbitrumGreenWillSupport.t.sol'`
- [ ] Commit: `test(contracts): add GreenWill deployment confidence coverage`

### 0.2 Deploy 6 Unlock locks on Arbitrum

**Files:**
- Create: `packages/contracts/script/deploy-badge-locks.ts`

- [ ] Enumerate 6 badges (verified-gardener, active-contributor, stewardship, garden-operator, community-builder, impact-verified)
- [ ] For each: call Unlock factory `createLock(expirationDuration, tokenAddress=0, keyPrice=0, maxKeys=UINT_MAX, name, salt)` with `transferrable=false`
- [ ] Expirations: `active-contributor`=1y, `garden-operator`=0 (manager-revoked), others=0 (lifetime)
- [ ] Set Greenwill issuer address as lock manager + key granter
- [ ] Dry-run first; broadcast second
- [ ] Record 6 lock addresses under `unlock.locks.<camelCaseKey>` in `packages/contracts/deployments/42161-latest.json`, where `<camelCaseKey>` is one of `verifiedGardener`, `activeContributor`, `stewardship`, `gardenOperator`, `communityBuilder`, `impactVerified`. Each entry holds `{ badgeId, address, name, expirationDuration, transferrable }`.
- [ ] Commit: `feat(contracts): deploy 6 soulbound Unlock locks for reputation badges`

### 0.3 Register shared EAS schema

**Files:**
- Create: `packages/contracts/script/register-badge-schemas.ts`

- [ ] Define schema string: `string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier`
- [ ] Register 1 shared `GreenGoodsBadge` schema via EAS SchemaRegistry (resolver=0, revocable=true)
- [ ] Distinguish badges by `badgeType` inside the attestation payload rather than per-badge schema UIDs
- [ ] Record the shared schema UID in `packages/contracts/deployments/42161-latest.json` under `schemas.greenGoodsBadgeSchemaUID` with sibling `schemas.greenGoodsBadgeSchema`, `schemas.greenGoodsBadgeName`, and `schemas.greenGoodsBadgeDescription`
- [ ] Commit: `feat(contracts): register EAS schema for reputation badges`

### 0.4 Dependency check

- [ ] Verify `@unlock-protocol/contracts` or viem-based Unlock ABI available in `packages/agent`; add if missing
- [ ] Verify `@ethereum-attestation-service/eas-sdk` available; add to agent + shared if missing
- [ ] Verify IPFS pinning service available (reuse existing `pinata` client if present; else add)
- [ ] Commit: `chore(agent): add unlock + eas + ipfs client deps`

## Phase 1 — Registry + Greenwill Skeleton (2026-04-25 → 2026-05-05)

> Builds on #457 — the async badge issuer service skeleton already establishes Greenwill daemon + cron harness. This phase wires the `BadgeDefinition` surface into it.

### 1.1 `BadgeDefinition` interface + `_registry.ts`

**Files:**
- Create: `packages/agent/src/badges/_registry.ts`
- Create: `packages/agent/src/badges/types.ts`

- [ ] Define `BadgeDefinition`, `BadgeEvalResult`, `EvalContext` per spec
- [ ] Export `badgeRegistry: Record<BadgeId, BadgeDefinition>` (initially empty)
- [ ] Add `registerBadge(def)` helper so evaluator files self-register on import
- [ ] Load lock addresses + schema UIDs from deployment artifact
- [ ] Unit test: registry throws on duplicate id, returns empty cleanly
- [ ] Run: `cd packages/agent && bun run test`
- [ ] Commit: `feat(agent): add BadgeDefinition registry for reputation badges`

### 1.2 `greenwillIssuer.ts` main loop

**Files:**
- Create: `packages/agent/src/services/greenwillIssuer.ts`
- Modify: `packages/agent/src/index.ts` (barrel)

- [ ] Main loop: iterate `badgeRegistry`, route `on-event` → subscription handler, `daily` → cron handler
- [ ] Accept injected `unlockClient`, `easBadgeWriter`, `ipfsUploader` (DI for testability)
- [ ] Idempotency check via EAS query (does attestation already exist for `recipient × badgeType`?) before issuance
- [ ] Emit structured log `BadgeIssued { badgeId, user, evidenceUri, txHash }` via shared `logger`
- [ ] Unit test with mocked clients
- [ ] Commit: `feat(agent): greenwill issuer main loop atop badge registry`

### 1.3 Envio subscription wiring

**Files:**
- Create: `packages/agent/src/services/envioSubscriber.ts`

- [ ] Wire GraphQL subscription to Envio endpoint for `WorkApproved`, `HypercertMinted`, `HatMinted`, `HatRenounced` events
- [ ] Reconnect + backoff on drop; logs a `SubscriptionLagged` metric
- [ ] Hand each event to `greenwillIssuer.handleEvent(event)`
- [ ] Unit test: mock Envio server, assert reconnect + dispatch
- [ ] Commit: `feat(agent): Envio subscription wiring for event-driven badges`

## Phase 2 — Event-Driven Evaluators (2026-05-05 → 2026-05-15)

### 2.1 `verified-gardener` evaluator

**Files:**
- Create: `packages/agent/src/badges/verified-gardener.ts`
- Create: `packages/agent/src/badges/__tests__/verified-gardener.test.ts`

- [ ] Trigger: `WorkApproved` event
- [ ] Criterion: user's first approved submission ever (count approved submissions == 1)
- [ ] Evidence: `[submissionId]`
- [ ] Register via `registerBadge`; cadence=`on-event`; tier=undefined
- [ ] Unit tests: first approval earns; second approval is no-op
- [ ] Commit: `feat(agent): verified-gardener badge evaluator`

### 2.2 `impact-verified` evaluator

**Files:**
- Create: `packages/agent/src/badges/impact-verified.ts`
- Create: `packages/agent/src/badges/__tests__/impact-verified.test.ts`

- [ ] Trigger: `HypercertMinted` event (queried via minimal hypercert linkage already indexed)
- [ ] Criterion: user has ≥1 Hypercert derived from their approved work
- [ ] Evidence: `[hypercertId, ...submissionIds]`
- [ ] cadence=`on-event`; lifetime
- [ ] Unit tests: mint earns; duplicate mint no-op
- [ ] Commit: `feat(agent): impact-verified badge evaluator`

### 2.3 `garden-operator` evaluator (grant path)

**Files:**
- Create: `packages/agent/src/badges/garden-operator.ts`
- Create: `packages/agent/src/badges/__tests__/garden-operator.test.ts`

- [ ] Trigger: `HatMinted` event with `hatId` matching any garden operator hat
- [ ] Criterion: user holds operator Hat on ≥1 garden (Envio indexes Hats role membership)
- [ ] Evidence: `[hatId, gardenAddress]`
- [ ] cadence=`on-event` for grant; the matching daily revoke path is in Phase 3
- [ ] Unit tests: hat mint earns; non-operator hat no-op
- [ ] Commit: `feat(agent): garden-operator badge grant evaluator`

## Phase 3 — Daily-Cron Evaluators (2026-05-15 → 2026-05-25)

### 3.1 `active-contributor` evaluator

**Files:**
- Create: `packages/agent/src/badges/active-contributor.ts`
- Create: `packages/agent/src/badges/__tests__/active-contributor.test.ts`

- [ ] Criterion: 10 approved submissions in rolling 90-day window
- [ ] Key expiry: 1 year (Unlock lock handles expiration); daily cron re-evaluates to renew
- [ ] Evidence: 10 most recent submission IDs in window
- [ ] Unit tests: threshold met; below threshold; renewal path (key expired + still qualifying)
- [ ] Commit: `feat(agent): active-contributor badge evaluator with rolling quarter`

### 3.2 `stewardship` evaluator

**Files:**
- Create: `packages/agent/src/badges/stewardship.ts`
- Create: `packages/agent/src/badges/__tests__/stewardship.test.ts`

- [ ] Criterion: ≥30 approved submissions AND first approval ≥90 days ago
- [ ] Lifetime expiry
- [ ] Evidence: 30 earliest approved submission IDs
- [ ] Unit tests: both conditions; only count met; only duration met
- [ ] Commit: `feat(agent): stewardship badge evaluator`

### 3.3 `community-builder` evaluator

**Files:**
- Create: `packages/agent/src/badges/community-builder.ts`
- Create: `packages/agent/src/badges/__tests__/community-builder.test.ts`

- [ ] Criterion: user has invited/onboarded ≥5 gardeners to a garden (trace via `MemberAdded` events where inviter == user)
- [ ] Lifetime expiry
- [ ] Evidence: list of onboarded member addresses (max 10 for evidence payload bounds)
- [ ] Unit tests: threshold, below threshold, dedupe (same invitee counted once)
- [ ] Commit: `feat(agent): community-builder badge evaluator`

### 3.4 Daily cron handler

**Files:**
- Create: `packages/agent/src/handlers/evaluateBadges.cron.ts`
- Modify: `packages/agent/src/index.ts` (register cron)

- [ ] Schedule: `0 0 * * *` (00:00 UTC)
- [ ] Iterate all known users from Envio (paginated)
- [ ] For each user × each `cadence='daily'` badge: `evaluate()` → issue if earned + not-yet-issued
- [ ] Also revoke `garden-operator` keys for users whose operator hat was renounced (handled in same cron)
- [ ] Heartbeat log on start + end; alert if failure queue >10
- [ ] Unit test: stubbed user list + mocked evaluators hit all 4 daily badges
- [ ] Commit: `feat(agent): daily badge evaluation cron`

## Phase 4 — Issuance Clients (2026-05-20 → 2026-05-29)

### 4.1 `unlockClient.ts`

**Files:**
- Create: `packages/agent/src/services/unlockClient.ts`
- Create: `packages/agent/src/services/__tests__/unlockClient.test.ts`

- [ ] `grantKey(lockAddress, recipient, expirationTs?)` — calls Unlock `grantKeys`
- [ ] `revokeKey(lockAddress, recipient)` — calls Unlock `expireAndRefundFor` with 0 refund
- [ ] `hasKey(lockAddress, recipient)` — view call for idempotency
- [ ] Errors: `parseContractError()` + `USER_FRIENDLY_ERRORS`; wrap in `createMutationErrorHandler()` pattern
- [ ] Unit tests against viem test client
- [ ] Commit: `feat(agent): unlock client for key grant/revoke`

### 4.2 `easBadgeWriter.ts`

**Files:**
- Create: `packages/agent/src/services/easBadgeWriter.ts`
- Create: `packages/agent/src/services/__tests__/easBadgeWriter.test.ts`

- [ ] `attest(schemaUid, { badgeType, recipient, earnedAt, evidenceUri, tier })` via EAS SDK
- [ ] Uses Green Goods trusted attester signer (from Greenwill wallet)
- [ ] `findExisting(recipient, badgeType)` for idempotency
- [ ] Unit tests with mocked EAS SDK
- [ ] Commit: `feat(agent): EAS attestation writer for badges`

### 4.3 IPFS evidence uploader

**Files:**
- Create: `packages/agent/src/services/ipfsEvidenceUploader.ts`
- Create: `packages/agent/src/services/__tests__/ipfsEvidenceUploader.test.ts`

- [ ] `upload(evidence: BadgeEvidence)` → returns CID
- [ ] Evidence shape: `{ badgeId, recipient, earnedAt, submissionIds?, hypercertIds?, hatIds?, onboardedMembers? }`
- [ ] Content-address dedupes; idempotent
- [ ] Unit test with mocked pinning client
- [ ] Commit: `feat(agent): IPFS evidence uploader for badge attestations`

### 4.4 Issuance orchestration + retry queue

**Files:**
- Modify: `packages/agent/src/services/greenwillIssuer.ts`
- Create: `packages/agent/src/services/issuanceRetryQueue.ts`

- [ ] Wire `greenwillIssuer.issueBadge(badge, user, result)`:
  1. Check idempotency via `easBadgeWriter.findExisting` + `unlockClient.hasKey`
  2. `ipfsEvidenceUploader.upload(evidence)` → CID
  3. `unlockClient.grantKey(lock, user, expiry)`
  4. `easBadgeWriter.attest(schemaUid, ...)`
  5. Emit `BadgeIssued` log
- [ ] Failure partway through → push to `issuanceRetryQueue` (bounded, persisted)
- [ ] Retry with exponential backoff; drop to dead-letter log after 10 attempts
- [ ] Unit tests: happy path, partial-failure recovery, idempotent re-run
- [ ] Commit: `feat(agent): badge issuance orchestration with retry queue`

## Phase 5 — Shared Hook + Metadata (2026-05-29 → 2026-06-05)

### 5.1 `useBadges(address)` hook

**Files:**
- Create: `packages/shared/src/hooks/useBadges.ts`
- Create: `packages/shared/src/hooks/__tests__/useBadges.test.ts`
- Modify: `packages/shared/src/index.ts` (barrel)
- Modify: `packages/shared/src/query/queryKeys.ts` (add `badges(address)`)

- [ ] TanStack Query hook: queries EAS GraphQL for attestations where recipient==address AND schema==GreenGoodsBadge
- [ ] Merges with Unlock `balanceOf(user, lock)` per badge for "key active?" signal
- [ ] Returns `{ earned: BadgeRecord[], locked: BadgeRecord[] }` (locked = all unearned badges for display)
- [ ] Uses `queryKeys.badges(address)`; 5-min staleTime
- [ ] Unit tests: earned + unearned + expired-key mix
- [ ] Commit: `feat(shared): useBadges hook queries EAS + Unlock`

### 5.2 `modules/badges.ts` metadata

**Files:**
- Create: `packages/shared/src/modules/badges.ts`
- Modify: `packages/shared/src/index.ts` (barrel)

- [ ] Export `BADGE_METADATA: Record<BadgeId, { displayName, description, icon, criterionCopy, tierFormat? }>`
- [ ] i18n keys under `app.shared.badges.<badgeId>.*` — register in `shared/i18n/en.json` per `.claude/skills/ui/i18n.md`
- [ ] Unit test: every badge in registry has metadata
- [ ] Commit: `feat(shared): badge display metadata module`

## Phase 6 — Admin + Client UI (2026-06-05 → 2026-06-15)

### 6.1 Admin `BadgeShelf` + `BadgeDetail`

**Files:**
- Create: `packages/admin/src/components/Profile/BadgeShelf.tsx`
- Create: `packages/admin/src/components/Profile/BadgeDetail.tsx`
- Modify: `packages/admin/src/views/Community/index.tsx` (embed shelf in member row detail)
- Modify: `packages/admin/src/views/Profile/` (create profile view if absent — spec says "views/Profile get a Badge Shelf")

- [ ] `BadgeShelf` — grid of earned (color) + locked (grayscale) via `useBadges`
- [ ] `BadgeDetail` — `AdminDialog` (strict M3 — see `project_dialog_architecture.md`): criteria, earned date, evidence timeline, EAS + Unlock links
- [ ] Storybook stories: earned / locked / mixed
- [ ] Unit tests via `bun run test` (admin)
- [ ] Commit: `feat(admin): BadgeShelf + BadgeDetail on Community + Profile`

### 6.2 Client `BadgeShelf`

**Files:**
- Create: `packages/client/src/components/Profile/BadgeShelf.tsx`
- Modify: `packages/client/src/views/Profile/` (embed shelf)

- [ ] Reuses same `useBadges` + `BADGE_METADATA` from shared
- [ ] Client-appropriate visual (mobile-first, no admin M3 dialog — use `DialogShell` default)
- [ ] Read-only (no admin affordances)
- [ ] Unit tests via `bun run test` (client)
- [ ] Commit: `feat(client): BadgeShelf on Profile view`

## Phase 7 — Rollout + Portability Demo (2026-06-15 → 2026-06-30)

### 7.1 Pilot garden rollout

- [ ] Start Greenwill service against Arbitrum production; confirm subscription healthy
- [ ] Backfill daily cron runs once on startup → catches retroactively-qualifying Season One gardeners
- [ ] Select 3+ pilot gardens from Season One (coordinate with operators — see `project_season_one_pilot.md`)
- [ ] Monitor issuance counts per badge daily for first week
- [ ] Close milestone #16 when ≥3 gardens have ≥1 earned badge each
- [ ] Commit (ops): `feat(agent): enable reputation-badging on Arbitrum pilot`

### 7.2 Sibling-project recognition demo

> **Risk:** sibling-project teams (Coop, WEFA) may not prioritize in Q2 — per spec Risk #3, may slip to Q3.

- [ ] Publish canonical schema UIDs + lock addresses to sibling repos (README reference)
- [ ] Coop path: add minimal `useBadges` port in browser extension profile panel — show badge shelf on GG wallet
- [ ] WEFA path (fallback): gate a premium game feature via Unlock `balanceOf` check on any GG badge lock
- [ ] Demo video or screenshot recorded for outcome evidence
- [ ] If neither sibling ships in time: downgrade outcome to "design-for-portability verified via EAS universal attestation query from a standalone web demo"
- [ ] Commit (docs): `docs(agent): sibling-project recognition cookbook`

### 7.3 Observability dashboard

**Files:**
- Modify: `packages/agent/src/metrics/` (or add)

- [ ] Per-badge issuance count (daily)
- [ ] Per-user badge count distribution
- [ ] Failed-issuance queue depth (alert threshold 10)
- [ ] Greenwill cron heartbeat ingested by existing monitoring
- [ ] Admin panel: simple "Badge Issuance" card in operator/ops view (reuses shared logger metrics)
- [ ] Commit: `feat(agent): badge issuance observability`

## Dependencies / Blockers

- Unlock Protocol Arbitrum factory — confirmed stable (low risk per spec)
- EAS Arbitrum deployment — confirmed stable; schema registrar writable
- Envio GraphQL subscription stability on Arbitrum — daily cron is backstop if subscriptions lag
- Greenwill trusted attester wallet — needs funding for gas + schema registration fees
- Sibling-project team availability for 7.2 demo — coordinate early; fallback path documented

## Risks (carry from spec)

1. **Envio subscription reliability** — fallback to daily cron catches misses (built into Phase 3.4).
2. **Unlock Arbitrum availability** — stable deployment; low risk.
3. **Sibling-project recognition slip to Q3** — 7.2 has downgrade fallback.
4. **Soulbound transferability** — must be set at lock creation in Phase 0.2 (checklist enforces `transferrable=false`).
5. **Trusted attester key compromise** — mitigated by deployment-artifact-rotation runbook; attestations revocable via EAS.
