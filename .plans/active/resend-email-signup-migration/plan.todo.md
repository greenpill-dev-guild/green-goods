# Resend Email Signup Migration Plan

**Linear Issue**: PRD-598
**Linear Project**: Green Goods Public Website & Docs Polish
**Linear Source**: source:plans
**Feature Slug**: `resend-email-signup-migration`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-06-15T19:04:43.563Z`
**Last Updated**: `2026-06-15T19:12:00Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Use Resend as the replacement provider | It matches the existing Greenpill ecosystem and is a simpler fit for subscriber capture than Luma calendar import. |
| 2 | Keep `POST /public/subscribe` as the public API boundary | The client form and tests already depend on this route; swapping the backend provider should not change the user flow. |
| 3 | Rename public errors to provider-neutral language | `luma_import_failed` will become inaccurate after migration and would make future provider changes more expensive. |
| 4 | Treat historical subscriber import as out of scope | Export/import needs real Luma data and operator review; mixing it into the adapter PR raises risk. |
| 5 | No contracts/indexer/admin lane | The migration is provider/API/client-copy work only. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Resend captures public subscribers through existing route | `state_api` | Steps 1-3 | Not started |
| Existing validation/CORS/rate-limit behavior remains intact | `state_api` | Steps 2-3 | Not started |
| Provider errors are neutral and translated | `state_api`, `ui` | Steps 3-4 | Not started |
| Client form keeps same behavior and copy intent | `ui` | Step 4 | Not started |
| Root env/config/docs identify Resend requirements | `state_api` | Step 5 | Not started |
| No contract/indexer/admin work included | `contracts` | Step 0 boundary | N/A |

## TDD / Proof Order

- [x] Identify the behavior boundary for each implementation lane before editing code
- [ ] Write or select the minimal failing test/proof first
- [ ] Run the RED command and record evidence in the lane handoff
- [ ] Implement the smallest change that can satisfy the proof
- [ ] Run the GREEN command and record evidence in the lane handoff
- [ ] Record machine-readable proof with `node scripts/harness/plan-hub.mjs record-tdd`
- [ ] If TDD cannot honestly apply, record `not_applicable` or `proof_limit` with a concrete note in `status.json`

## Lane Checklists

### UI (`claude/ui/resend-email-signup-migration`)

- [ ] Update `PublicGetInTouch` comments/tests only where they mention Luma-specific behavior.
- [ ] Preserve the current email field, consent microcopy, source payload, success reset, and
  schedule-a-call fallback behavior.
- [ ] Add or rename i18n keys in `en`, `es`, and `pt` for provider-neutral failure copy.
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/resend-email-signup-migration`)

- [ ] Step 1: add a Resend subscription client in `packages/agent` with focused adapter tests.
- [ ] Step 2: change Agent config/bootstrap/server deps from Luma-specific names to a
  provider-neutral subscription client.
- [ ] Step 3: preserve public subscribe validation while routing success/failure through Resend.
- [ ] Step 4: update shared public error contracts and all three locale files.
- [ ] Step 5: update docs/config references for required root env variables, segment/topic IDs, and
  Luma shutdown notes.
- [ ] Record RED/GREEN proof or a proof-limit note before marking the lane complete
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/resend-email-signup-migration`)

- [x] Mark lane `n/a`; no Solidity, deployment, or indexer schema change is planned.

### QA Pass 1 (`claude/qa-pass-1/resend-email-signup-migration`)

- [ ] Review UI behavior and public user flow.
- [ ] Verify acceptance criteria from `eval.md`
- [ ] Use authenticated Brave QA for the public homepage subscribe path if Resend test/staging
  credentials are configured; otherwise record QA as blocked by missing provider credentials.
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/resend-email-signup-migration`)

- [ ] Review regressions and implementation edges
- [ ] Run targeted validation commands
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] Focused Agent tests after provider rename, for example
  `bun run --filter @green-goods/agent test -- resend public-api`
- [ ] Focused Client test:
  `bun run --filter @green-goods/client test -- PublicGetInTouch`
- [ ] Vocabulary/i18n guard if strings change: `bun run lint:vocab`
- [ ] Quick repo verification before PR: `node scripts/dev/ci-local.js --quick`
