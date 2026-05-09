# Public Endowment Withdrawal Recovery Plan

**Feature Slug**: `public-endowment-withdrawal-recovery`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-05-09T21:35:46.781Z`
**Last Updated**: `2026-05-09T21:35:46.781Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Wallet Endow remains visible while public withdrawal management is built. | Avoid breaking the wallet path while fixing the missing return/withdraw UX. |
| 2 | `/fund` gets a connected-account "My Endowments" panel. | Funders should manage positions from the same public funding website where they endowed. |
| 3 | Card Donate can recover before Card Endow. | Donate is one-way support; Endow creates withdrawable ownership and needs stronger proof. |
| 4 | Card Endow stays gated until email-wallet ownership and `/fund` withdrawal are proven. | Prevent hidden custody or stranded vault shares. |
| 5 | No contracts or indexer schema changes are planned. | Existing owner-scoped vault deposit reads and withdrawal hooks should be enough for v1. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Public funders can see owned endowments on `/fund`. | `state_api`, `ui` | Build shared public endowment-position data and render the account panel. | ⏳ |
| Public funders can withdraw from `/fund`. | `ui`, `state_api` | Reuse shared withdraw mutation with amount, Max, confirmation, lifecycle, and refresh. | ⏳ |
| Endow receipts return users to management. | `ui` | Update success and receipt CTAs to point back to `/fund` management. | ⏳ |
| Card Donate has real checkout/webhook proof. | `state_api` | Wire checkout dependency and current webhook parser behind provider proof gating. | ⏳ |
| Card Endow cannot launch without recoverable owner account. | `state_api`, `ui` | Keep Card Endow hidden until email-wallet ownership and withdrawal proof are complete. | ⏳ |
| Product docs stop claiming PWA-only withdrawal. | `ui` | Update funder docs and browser design truth. | ⏳ |
| No Solidity or indexer schema work. | `contracts` | Keep contracts lane `n/a`. | ✅ |

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
- [ ] Add receipt/success wayfinding back to `/fund` management
- [ ] Keep position visibility connection-gated; do not add public address lookup
- [ ] Add i18n for new user-facing strings in `en`, `es`, and `pt`
- [ ] Update funder docs and public-browser design notes
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/public-endowment-withdrawal-recovery`)

- [ ] Add shared public endowment-position hook/type using existing owner deposit, vault catalog, and public garden data
- [ ] Reuse the existing shared vault withdrawal path for public withdraws
- [ ] Wire real Thirdweb checkout dependency for Card Donate before enabling card methods
- [ ] Refresh Thirdweb webhook signature/payload handling against current provider docs
- [ ] Preserve strict onchain tuple verification before marking provider intents funded
- [ ] Keep Card Endow gated unless email-wallet ownership and `/fund` withdrawal proof are recorded
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/public-endowment-withdrawal-recovery`)

- [x] No contract work planned
- [x] No deployment work planned
- [x] No indexer schema work planned

### QA Pass 1 (`claude/qa-pass-1/public-endowment-withdrawal-recovery`)

- [ ] Review wallet-connected `/fund` management UX on desktop and mobile
- [ ] Verify account-gated visibility, withdraw flow clarity, receipt return path, and i18n
- [ ] Verify Card Endow remains hidden until ownership/withdrawal proof exists
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/public-endowment-withdrawal-recovery`)

- [ ] Review regression risk around funding, Treasury withdrawal reuse, provider proof gates, and docs truth
- [ ] Run targeted validation commands from `eval.md`
- [ ] Confirm `status.json` lane state matches recorded proof before closeout
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] Targeted shared hook tests for public endowment-position data
- [ ] Targeted client `/fund` tests for connected empty, active position, Max, confirm, failure, success refresh, and no admin controls
- [ ] Targeted agent tests for Thirdweb checkout dependency, provider proof gating, webhook parsing, and strict tuple verification
- [ ] `bun run lint:vocab`
- [ ] `bun run check:design-generated`
- [ ] `bun run check:design-tokens`
- [ ] `node scripts/dev/ci-local.js --quick`
