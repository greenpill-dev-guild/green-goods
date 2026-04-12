# Embedded Wallet Sponsorship Follow-Ups Plan

**Feature Slug**: `embedded-wallet-sponsorship-followups`
**Stage**: `backlog`
**Status**: `BACKLOG`
**Created**: `2026-04-12`
**Last Updated**: `2026-04-12`
**Replaces**: `web2-auth-and-gas-sponsorship` (archived broad plan)

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Treat this as a follow-up, not a greenfield auth rewrite | Embedded auth, restore logic, and progressive disclosure already exist in code |
| 2 | Keep passkey untouched unless a regression is found | Passkey is the stable sponsored path today |
| 3 | Sponsorship capability must be truthful in code and UI | Silent fallback creates the wrong mental model |
| 4 | Offline embedded work uses deferred-signing semantics | Current embedded flow cannot be represented as fully offline signing |
| 5 | Address continuity remains explicit, not “solved” | No backend identity-linking work is in scope |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Truthful sender sponsorship behavior | `state_api` | Steps 1-3 | ⏳ |
| Deferred-signing and offline policy | `state_api` | Step 4 | ⏳ |
| Address continuity and login copy cleanup | `ui` | Step 5 | ⏳ |
| Sender/auth/login regression coverage | `ui`, `state_api` | Step 6 | ⏳ |

## Lane Checklists

### UI (`claude/ui/embedded-wallet-sponsorship-followups`)

- [ ] Tighten login and auth continuity messaging
- [ ] Keep progressive disclosure intact
- [ ] Add i18n for any new user-facing strings
- [ ] Write `handoffs/claude-ui.md`

### State / API (`codex/state-api/embedded-wallet-sponsorship-followups`)

- [ ] Audit sender capability flags and fallback behavior
- [ ] Add sponsored execution path only where support exists
- [ ] Make deferred-signing semantics explicit in auth/workflow code
- [ ] Write `handoffs/codex-state-api.md`

### Contracts (`codex/contracts/embedded-wallet-sponsorship-followups`)

- [x] `n/a`
- [ ] Write `handoffs/codex-contracts.md`

### QA Pass 1 (`claude/qa-pass-1/embedded-wallet-sponsorship-followups`)

- [ ] Review UI behavior and user flow
- [ ] Verify acceptance criteria from `eval.md`
- [ ] Write `handoffs/claude-qa-pass-1.md`

### QA Pass 2 (`codex/qa-pass-2/embedded-wallet-sponsorship-followups`)

- [ ] Review regressions and implementation edges
- [ ] Run targeted validation commands
- [ ] Write `handoffs/codex-qa-pass-2.md`

## Validation

- [ ] `bun format && bun lint`
- [ ] `bun run test`
- [ ] `VITE_CHAIN_ID=11155111 bun run build`

## Implementation Steps

### Step 1: Capability matrix audit
**Files**: `packages/shared/src/modules/transactions/types.ts`, `factory.ts`, `embedded-sender.ts`, `wallet-sender.ts`, `hooks/blockchain/useTransactionSender.ts`
**Change**: Make sender capability reporting explicit and consistent for passkey, embedded, and wallet modes. Document when sponsorship is attempted, when it is unavailable, and what fallback is used.

### Step 2: Embedded sponsorship follow-up
**Files**: `packages/shared/src/modules/transactions/embedded-sender.ts`, related sender tests
**Change**: Add the sponsored execution path behind feature or capability detection, using the configured proxy or wallet capability only when available. Preserve the existing unsponsored fallback and log the fallback reason.

### Step 3: Wallet sponsorship follow-up
**Files**: `packages/shared/src/modules/transactions/wallet-sender.ts`, related sender tests
**Change**: Attempt sponsored execution only for compatible wallet paths, then fall back cleanly to direct `writeContractAsync` without breaking current wallet behavior or Safe-style hash handling.

### Step 4: Deferred-signing and offline policy
**Files**: `packages/shared/src/workflows/authMachine.ts`, `modules/auth/session.ts`, affected work-submission paths
**Change**: Make embedded offline behavior explicit. Preserve drafts or queued intent while offline, but defer actual signing/submission until reconnect. Reflect that rule in sender/auth state rather than hiding it in comments.

### Step 5: Login and auth continuity UX
**Files**: `packages/client/src/views/Login/index.tsx`, auth-required copy surfaces if needed
**Change**: Tighten login labels, continuity notice, and supporting copy so users understand that passkey, embedded, and wallet methods map to separate on-chain identities and may have different sponsorship behavior.

### Step 6: Validation and regression coverage
**Files**: existing sender/auth/login tests
**Change**: Add or update tests for sender selection, sponsored capability flags, embedded restore, deferred-signing semantics, and continuity messaging. Keep passkey and wallet fallback regressions covered.
