# Public Endowment Withdrawal Recovery Plan

**Feature Slug**: `public-endowment-withdrawal-recovery`
**Stage**: `active`
**Status**: `ACTIVE — ui/state_api READY, qa BLOCKED`
**Created**: `2026-05-09T21:35:46.781Z`
**Last Updated**: `2026-05-10T23:13:14.000Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Wallet Endow remains visible while public withdrawal management is built. | Avoid breaking the wallet path while fixing the missing return/withdraw UX. |
| 2 | `/fund` gets a connected-account "My Endowments" panel. | Funders should manage positions from the same public funding website where they endowed. |
| 3 | Card Donate can recover before Card Endow. | Donate is one-way support; Endow creates withdrawable ownership and needs stronger proof. |
| 4 | Card Endow stays gated until email-wallet ownership and `/fund` withdrawal are proven. | Prevent hidden custody or stranded vault shares. |
| 5 | No contracts or indexer schema changes are planned. | Existing owner-scoped vault deposit reads and withdrawal hooks should be enough for v1. |
| 6 | Endow management deeplink is `/fund?manage=endowments`. | Receipts and success states need one public return target that does not encode private data. |
| 7 | Public withdraw preview must use the same 1% max-loss default as the withdraw mutation. | Prevent a Max button that later fails or implies unsafe withdrawal terms. |
| 8 | The `/fund` funding lane matrix is explicit. | Wallet Donate/Endow, Manage Endowments, Card Donate, and Card Endow have different proof and visibility rules. |
| 9 | Card Donate proof must validate Cookie Jar semantics. | A provider success event or generic token transfer can bypass the app's support path and is not enough. |
| 10 | Provider proof is exact-tuple only. | One Garden/token/chain/method/intent proof must never unlock another funding lane. |

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
| Card Donate has real checkout/webhook proof. | `state_api` | Wire checkout dependency and current webhook parser behind provider proof gating. | ⏳ |
| Card Donate proves the intended Cookie Jar funding effect. | `state_api` | Verify checkout target/call, webhook tuple, transaction hash, and Cookie Jar postcondition before funded status. | ⏳ |
| Card Endow cannot launch without recoverable owner account. | `state_api`, `ui` | Require `receiverAddress` ownership in intent contracts and keep Card Endow hidden until email-wallet ownership, share verification, and withdrawal proof are complete. | ⏳ |
| Provider proof cannot over-unlock card lanes. | `state_api` | Key provider availability by exact intent, Garden destination, token, chain, and method. | ⏳ |
| Receipt and management URLs preserve privacy. | `ui`, `state_api` | Keep receipt tokens fragment/session-only and keep `/fund?manage=endowments` free of address, email, and provider identifiers. | ⏳ |
| Product docs stop claiming PWA-only withdrawal. | `ui` | Update funder docs and browser design truth. | ⏳ |
| Current public funding tests stop asserting support-only withdrawal. | `ui` | Replace the "no withdraw controls" assertion with account-gated withdrawal and no-admin-control tests. | ⏳ |
| No Solidity or indexer schema work. | `contracts` | Keep contracts lane `n/a`. | ✅ |

## Implementation Slices

1. **Public data first**: add/export the shared public endowment-position hook and safe withdrawable
   limit. This is the only state/API prerequisite for `/fund` UI.
2. **Public `/fund` management**: add `/fund?manage=endowments`, connected empty/active states,
   withdrawal controls, explicit funding lane availability, receipt return path, privacy-safe
   deeplinks, i18n, and docs/design truth cleanup.
3. **Card Donate recovery**: wire real Thirdweb checkout, current webhook parsing/signature
   verification, exact provider proof registry entries, strict tuple tests, and Cookie Jar
   postcondition proof.
4. **Card Endow gate**: add/verify receiver-address ownership types, but keep Card Endow unavailable
   until a recovered email wallet owns share-verified vault shares that are visible and withdrawable
   from `/fund`.

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
- [ ] Make the `/fund` funding lane matrix explicit in UI state: Wallet Donate, Wallet Endow, Manage Endowments, Card Donate gated, Card Endow hidden
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
- [ ] Wire real Thirdweb checkout dependency for Card Donate before enabling card methods
- [ ] Require exact provider-proof availability keys by intent, Garden destination, token, chain, and method
- [ ] For Card Donate, prove the checkout target/call and webhook/onchain postcondition match the Garden Cookie Jar support path
- [ ] Refresh Thirdweb webhook signature/payload handling against current provider docs, including timestamped signatures and nested payload fields
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
- [ ] Verify funding lane availability is understandable and card rails do not appear without exact proof
- [ ] Verify Card Endow remains hidden until ownership/withdrawal proof exists
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/public-endowment-withdrawal-recovery`)

- [ ] Review regression risk around funding, Treasury withdrawal reuse, provider proof gates, and docs truth
- [ ] Verify Card Donate proves Cookie Jar semantics and Card Endow proves share ownership, not only provider success
- [ ] Run targeted validation commands from `eval.md`
- [ ] Confirm `status.json` lane state matches recorded proof before closeout
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] Targeted shared hook tests for public endowment-position data
- [ ] Targeted shared tests for safe max-loss preview parity with the withdraw mutation
- [ ] Targeted client `/fund` tests for connected empty, active position, `/fund?manage=endowments`, Max, confirm, failure, success refresh, receipt CTA, and no admin controls
- [ ] Targeted client tests for card-lane visibility: Card Donate hidden until exact proof, Card Endow hidden until ownership/share/withdraw proof
- [ ] Targeted agent tests for Thirdweb checkout startup wiring, exact provider proof gating, webhook parsing, strict tuple verification, Card Donate Cookie Jar postconditions, and Card Endow rejection without `receiverAddress`
- [ ] `bun run lint:vocab`
- [ ] `bun run check:design-generated`
- [ ] `bun run check:design-tokens`
- [ ] `node scripts/dev/ci-local.js --quick`
