# Capability reads and action-edit recovery

PRD-1399: the five route hooks now use one capability-query owner, and plain-wallet action edits on budgeted chains use the existing durable batch journal one field at a time. The atomic enablement list is unchanged.

## Behavior

`useBatchCapability` keeps the existing account/chain/connector query key, shares in-flight reads, and refuses to query without the caller's listing gate, an account, and a sender capability reader. Send-time capability checks stay fresh and independent of the cached presentation read.

An action edit prepares its ordered fields in sequential journal groups for a plain wallet. Every group runs the existing ownership and budget checks, simulates its exact field against current registry state, and proves that field by reading it back. The controller persists proven fields before the next wallet prompt. Proven progress marks the actions query stale without refetching into the active editor; a metadata refresh cannot reset the remaining draft while the same scoped save attempt owns it. Initial restore and a changed account, chain, or action still initialize their own editor. Decline retains the remaining draft; an uncertain send holds the edit across reload and blocks new submissions until reconciliation or the existing explicit Move On. A later sequential limit failure stops rather than falling back to unjournaled writes.

Atomic availability and journal recovery are separate hook properties: journal recovery does not advertise one signature or enable an unproven atomic rail. The new sequential path follows `actionEditBudget`, currently Arbitrum; this change does not invent ceilings on other chains.

The Octant lane requested two compatible additions to `useDepositPlan`: optional `chainId` (defaults to `useCurrentChain`) and the `atomic` result. Its chain-1 caller can reuse the existing hold UI and capability owner. Octant owns the deposit module changes.

The final integration review found that a listed wallet's unknown or failed capability read could leave the form unpaused after loading finished. `useDepositPlan.isPaused` now includes that unresolved capability state; `atomic` remains false and `signatures` remains null until a known result arrives. This prevents checkout from choosing its sequential route solely because the capability read failed. The atomic enablement list and legacy sequential send behavior are unchanged.

## Evidence

Working-tree evidence only. Task files are uncommitted, so no commit-attributed validation receipt is claimed.

- RED: `bun run --cwd packages/shared test src/__tests__/modules/action-edit-batch.test.ts`; 2026-11-07 20:28:51 UTC start, 28.36 s; 4 new regression cases failed, 15 existing cases passed. Log: `/tmp/capability-recovery-red.log`.
- Initial GREEN: action module, action hook, and capability hook; 29 tests passed in 3 files. Log: `/tmp/capability-recovery-green.log`.
- Expanded run: 95 passed, 3 failed in 8 files. One new controller test expected the original title after correctly restoring the edited draft; corrected. Two existing IndexedDB `waitFor` assertions timed out under concurrent load. No timeout or assertion was weakened.
- Expanded rerun with `--maxWorkers=2`: 97 passed, 1 existing garden-settings `waitFor` timed out in a different case; `/tmp/capability-recovery-focused-final.log`. That complete garden-settings file then passed 10/10 unchanged in isolation; `/tmp/capability-garden-focused.log`.
- Additional RED: metadata refresh reset the remaining draft (`/tmp/capability-recovery-draft-red.log`); a proven prefix did not mark the action query stale (`/tmp/capability-recovery-partial-red-corrected.log`). The first attempt at the latter used a passkey quote for a wallet fixture and was corrected before the meaningful RED.
- Final GREEN: `bun run --cwd packages/shared test src/__tests__/modules/action-edit-batch.test.ts src/__tests__/hooks/action/useActionEditBatch.test.ts src/__tests__/hooks/admin-ui/useActionEditorController.test.tsx src/__tests__/hooks/blockchain/useBatchCapability.test.tsx --maxWorkers=2`; 2026-11-07 20:47:48 UTC start, 10.09 s; 4 files / 50 tests passed. Log: `/tmp/capability-recovery-final.log`.
- Task-owned TypeScript formatted with installed Biome. Final task-owned focused Oxlint passed with `--deny-warnings`, and `git diff --check` passed. Root owns integrated typechecks, selected repository checks, and browser proof.
- Final integration follow-up RED: `bun run --cwd packages/shared test src/__tests__/hooks/vault/useVaultDepositBatch.test.ts -t 'pauses without a count'`; 2026-11-07 21:00:54 UTC start, 11.79 s; both unknown/error regressions failed because the settled form was unpaused. Log: `/tmp/capability-unread-red.log`.
- Follow-up GREEN: `bun run --cwd packages/shared test src/__tests__/hooks/vault/useVaultDepositBatch.test.ts`; 2026-11-07 21:01:21 UTC start, 20.09 s; all 24 tests passed. Log: `/tmp/capability-unread-green.log`. Both affected files passed Biome formatting and focused Oxlint. Additional owned test path: `packages/shared/src/__tests__/hooks/vault/useVaultDepositBatch.test.ts`.

The regressions cover sequential ordering and per-field preflight, decline before the first send, confirmed progress followed by a pending/declined prompt, read-only recovery of a stored reference, refusal of an overlapping retry, account/chain change before the next send, and controller draft restoration that sends only the remaining fields. Capability tests cover shared in-flight reads, disabled/missing prerequisites, and cache separation by account, chain, and connector.

## Task record

Task: PRD-1399 capability/recovery lane | Type: fix | Outcome: code and focused proof complete; integrated verification pending
Agent/model: Codex / unknown | Coverage: this delegated lane only

| Phase | Start → end (UTC) | Evidence |
|---|---|---|
| investigate | unknown → unknown | Existing action editor, journal, deposit route, and five capability consumers inspected |
| implement | unknown → 2026-11-07T20:47:44Z | Changes described above; mutation design approved by coordinator |
| verify | 2026-11-07T20:28:51Z → 2026-11-07T20:48:39Z | RED/GREEN and expanded logs above |
| verify | 2026-11-07T21:00:54Z → 2026-11-07T21:01:42Z | Unresolved wallet capability pause: 2 RED cases, complete 24-test GREEN |

Human corrections: 0 observed in this lane; attention: unknown.
