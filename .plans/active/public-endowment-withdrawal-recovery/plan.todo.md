# Public Endowment Withdrawal Recovery Plan

**Feature Slug**: `public-endowment-withdrawal-recovery`
**Stage**: `active`
**Status**: `ACTIVE — scope locked to vault/endow; ui/state_api IN_PROGRESS, qa BLOCKED`
**Created**: `2026-05-09T21:35:46.781Z`
**Last Updated**: `2026-05-31T05:08:01Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Wallet Endow remains visible while public withdrawal management is built. | Avoid breaking the wallet path while fixing the missing return/withdraw UX. |
| 2 | `/fund` gets a connected-account "My Endowments" panel. | Funders should manage positions from the same public funding website where they endowed. |
| 3 | Public Donate and Card Donate are deferred out of the NYC sprint. | June 1 scope is purely vault/endow; Donate needs separate future non-Cookie-Jar scope. |
| 4 | Card Endow stays gated until email-wallet ownership and `/fund` withdrawal are proven. | Prevent hidden custody or stranded vault shares. |
| 5 | No contracts or indexer schema changes are planned. | Existing owner-scoped vault deposit reads and withdrawal hooks should be enough for v1. |
| 6 | Endow management deeplink is `/fund?manage=endowments`. | Receipts and success states need one public return target that does not encode private data. |
| 7 | Public withdraw preview must use the same 1% max-loss default as the withdraw mutation. | Prevent a Max button that later fails or implies unsafe withdrawal terms. |
| 8 | The `/fund` funding lane matrix is explicit. | Wallet Endow, Manage Endowments, hidden-gated Card Endow, and deferred Donate have different visibility rules. |
| 9 | Existing low-level Cookie Jar code is preserved but hidden from this sprint surface. | Avoid destructive removal while preventing Donate from drifting back into the NYC vault/endow demo. |
| 10 | Provider proof is exact-tuple only. | One Garden/token/chain/method/intent proof must never unlock another funding lane. |
| 11 | Reusable skill work is tracked from this crowdfunding UI hub. | Green Goods is the demo fixture, but the long-term goal is a portable vault crowdfunding UI skill for Octant and other public-goods communities. |
| 12 | Skill tracking is not a new active automation lane in this pass. | The plan-hub validator syncs only standard lanes; skill issue IDs belong in related tracking metadata until implementation starts. |
| 13 | Card providers are adapter slots for the skill v1 tracking scope. | Wallet-first vault funding stays the default; Stripe, Coinbase, and Thirdweb require future server-backed implementation before live use. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands
- [x] Promoted to active and verified Linear parent/lane mirror has no sync warnings

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Public funders can see owned endowments on `/fund`. | `state_api`, `ui` | Build shared public endowment-position data and render the account panel. | ⏳ |
| Public funders can withdraw from `/fund`. | `ui`, `state_api` | Reuse shared withdraw mutation with amount, Max, confirmation, lifecycle, and refresh. | ⏳ |
| Endow receipts return users to management. | `ui` | Update success and receipt CTAs to point back to `/fund` management. | ⏳ |
| Public Donate is hidden on `/fund` during this sprint. | `ui` | Remove Donate CTAs and public Donate explanatory copy while preserving lower-level Cookie Jar code. | ✅ code updated; validation pending |
| Card Donate is deferred. | `state_api`, `ui` | Do not route PRD-439 into NYC sprint acceptance; future Donate must be separate non-Cookie-Jar scope. | ✅ deferred |
| Card Endow cannot launch without recoverable owner account. | `state_api`, `ui` | Require `receiverAddress` ownership in intent contracts and keep Card Endow hidden until email-wallet ownership, share verification, public visibility, and withdrawal proof are complete. | ◐ receiver guard added; share/withdraw proof pending |
| Provider proof cannot over-unlock card lanes. | `state_api` | Key provider availability by exact intent, Garden destination, token, chain, and method. | ✅ exact-key separation test added; validation pending |
| Receipt and management URLs preserve privacy. | `ui`, `state_api` | Keep receipt tokens fragment/session-only and keep `/fund?manage=endowments` free of address, email, and provider identifiers. | ⏳ |
| Product docs stop claiming PWA-only withdrawal. | `ui` | Update funder docs and browser design truth. | ⏳ |
| Current public funding tests stop asserting support-only withdrawal. | `ui` | Replace the "no withdraw controls" assertion with account-gated withdrawal and no-admin-control tests. | ⏳ |
| No Solidity or indexer schema work. | `contracts` | Keep contracts lane `n/a`. | ✅ |
| Reusable skill work is coherently tracked. | `system` | Add skill input/output boundaries to this plan and create Linear parent/child tracking issues under NYC Vault Crowdfunding. | ✅ local plan + Linear tracking recorded |

## Implementation Slices

1. **Public data first**: add/export the shared public endowment-position hook and safe withdrawable
   limit. This is the only state/API prerequisite for `/fund` UI.
2. **Public `/fund` management**: add `/fund?manage=endowments`, connected empty/active states,
   withdrawal controls, endow-only public sprint copy, receipt return path, privacy-safe deeplinks,
   i18n, and docs/design truth cleanup.
3. **Card Endow gate**: add/verify receiver-address ownership types, but keep Card Endow unavailable
   until a recovered email wallet owns share-verified vault shares that are visible and withdrawable
   from `/fund`.
4. **Donate deferral**: keep low-level Cookie Jar hooks/contracts intact, hide Donate from `/fund`,
   and move future Donate work to separate non-Cookie-Jar Linear scope.
5. **Reusable skill tracking**: record the future vault crowdfunding UI skill as local plan metadata
   and Linear parent/child issues. Do not create a new active lane or build the skill/template in this
   pass.

## Reusable Skill Tracking Checklist

- [x] Record DesignMD-required input, campaign context, existing-vault manifest, runtime module, and
  Vercel deployment assumptions in `spec.md`
- [x] Keep Green Goods / NYC vaults framed as the fixture, not the skill boundary
- [x] Keep wallet-first vault funding as v1 runtime assumption
- [x] Track Stripe, Coinbase, and Thirdweb as provider adapter slots only
- [x] Track optional create-vault support as operator setup scaffolding only
- [x] Create Linear parent issue for reusable vault crowdfunding UI skill work: PRD-569
- [x] Create Linear child issue for skill input schema and validation contract: PRD-570
- [x] Create Linear child issue for DesignMD campaign template and Green Goods fixture: PRD-571
- [x] Create Linear child issue for wallet-first vault manifest/runtime semantics: PRD-572
- [x] Create Linear child issue for card-provider adapter and create-vault module boundaries: PRD-573
- [x] Comment on PRD-435 and PRD-487 with the skill issue links
- [x] Record created Linear issue IDs in `status.json` under non-lane tracking metadata

## TDD / Proof Order

- [ ] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first
- [ ] Run the RED command and record evidence in the lane handoff
- [ ] Implement the smallest change that can satisfy the proof
- [ ] Run the GREEN command and record evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

### UI (`claude/ui/public-endowment-withdrawal-recovery`)

- [ ] Add `/fund` "My Endowments" account panel, connected empty state, active positions, and withdraw controls
- [ ] Hide/remove Donate choices and Donate CTAs from the public `/fund` sprint surface
- [ ] Make the `/fund` funding lane matrix explicit in UI state: Wallet Endow, Manage Endowments, Card Endow hidden, Donate deferred
- [ ] Add `/fund?manage=endowments` focus/scroll behavior and receipt/success wayfinding back to that panel
- [ ] Keep `/fund?manage=endowments` privacy-safe; do not encode receipt tokens, wallet addresses, emails, or provider IDs in the URL
- [ ] Keep position visibility connection-gated; do not add public address lookup
- [ ] Add i18n for new user-facing strings in `en`, `es`, and `pt`
- [ ] Replace current public funding tests that assert "support-only / no withdraw"
- [ ] Update `packages/client/DESIGN.browser.md` plus funder docs that currently say `/fund` has no public withdrawals
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/public-endowment-withdrawal-recovery`)

- [ ] Add shared public endowment-position hook/type using existing owner deposit, vault catalog, and public garden data
- [ ] Ensure available/Max withdrawal uses the same safe max-loss basis points as `useVaultWithdraw`
- [ ] Reuse the existing shared vault withdrawal path for public withdraws
- [ ] Extend public receipt/intent contracts for public management CTA and Card Endow receiver ownership
- [ ] Reject Card Endow sessions without recovered-wallet `receiverAddress`
- [ ] Deposit Card Endow vault shares to the recovered owner and verify shares before funded/share-verified state
- [ ] Require exact provider-proof availability keys by intent, Garden destination, token, chain, and method
- [ ] Preserve strict onchain tuple verification before marking provider intents funded
- [ ] For Card Endow, verify recovered email/social wallet ownership, vault-share receipt, `share_verification`, and `/fund` withdrawal proof before exposure
- [ ] Keep agent/client logs and telemetry redacted; do not log receipt tokens, emails, or provider PII
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/public-endowment-withdrawal-recovery`)

- [x] No contract work planned
- [x] No deployment work planned
- [x] No indexer schema work planned

### QA Pass 1 (`claude/qa-pass-1/public-endowment-withdrawal-recovery`)

- [ ] Review wallet-connected `/fund` management UX on desktop and mobile
- [ ] Verify account-gated visibility, withdraw flow clarity, receipt return path, and i18n
- [ ] Verify funding lane availability is understandable, Donate is absent from `/fund`, and card rails do not appear without exact proof
- [ ] Verify Card Endow remains hidden until ownership/withdrawal proof exists
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/public-endowment-withdrawal-recovery`)

- [ ] Review regression risk around funding, Treasury withdrawal reuse, provider proof gates, and docs truth
- [ ] Verify Card Endow proves share ownership and public withdrawal, not only provider success
- [ ] Run targeted validation commands from `eval.md`
- [ ] Confirm `status.json` lane state matches recorded proof before closeout
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] Targeted shared hook tests for public endowment-position data
- [ ] Targeted shared tests for safe max-loss preview parity with the withdraw mutation
- [ ] Targeted client `/fund` tests for connected empty, active position, `/fund?manage=endowments`, Max, confirm, failure, success refresh, receipt CTA, and no admin controls
- [ ] Targeted client tests for sprint visibility: Endow and Manage Endowments visible, Donate absent, Card Endow hidden until ownership/share/withdraw proof, and Card Donate proof never reveals Card Endow
- [ ] Targeted shared tests for Card Endow proof-key separation and required receiver semantics
- [ ] Targeted agent tests for exact provider proof gating, strict tuple verification, redacted logs, recovered-owner share verification, and Card Endow rejection without `receiverAddress`
- [ ] `bun run lint:vocab`
- [ ] `bun run check:design-generated`
- [ ] `bun run check:design-tokens`
- [ ] `node scripts/dev/ci-local.js --quick`
- [x] Status JSON parses after skill tracking metadata update
- [x] `node scripts/harness/plan-hub.mjs linear-sync --feature public-endowment-withdrawal-recovery --json` reports no warnings
- [ ] `node scripts/harness/plan-hub.mjs validate` (blocked by unrelated `sentry-stack-observability` hub schema drift)
- [x] Linear read-back confirms the skill parent/children exist and are linked to this plan
