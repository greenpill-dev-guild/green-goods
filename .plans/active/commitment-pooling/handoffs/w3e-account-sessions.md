# Pooling Rehearsal Follow-ups — W3-E Sessions: one account at a time

## Lane

- Execution sub-lane: `w3e_account_sessions` (machine lane `state_api`)
- Branch: `fix/account-switch-state-reset`, from a fresh `origin/develop` after W3-D merges
- Depends on: `w3d_unlisted_gardens_reachable`
- Merge: `--merge` on green CI and resolved bot threads
- Class: critical (the shared Auth provider)
- Linear child: `status.json` → `execution_sub_lanes.w3e_account_sessions.linear.issue`
- Decision: § 1 row 44

## Scope

N36. The sign-out half of N35 joins only if the solo reproduction (§ 4c, accepted queue) confirms
that a wallet disconnect during a tap ends the session.

## What the code does today

- Home's garden filters (`scope`, `sort`, `domains`) live in
  `packages/shared/src/stores/useUIStore.ts`, persisted under `green-goods:debug-mode` with no
  account in the key (`useUIStore.ts:169-178`); only Home's own Reset button calls
  `resetGardenFilters`.
- `useGardenStateStore` (`green-goods:garden-state`) persists each garden's tab, filter, search,
  scroll and open sheet the same way.
- `providers/Auth.tsx:540-553` sign-out removes the queue and offline work projections and clears
  the mutation cache, keeps cached reads on purpose, and touches no store.
- Already scoped by account: the commitment composer and proof drafts (keyed by viewer), the admin's
  last garden (`chainId:address`), and pending joins (address-checked).

## Steps

1. **An identity-change reset.** A hook in `hooks/auth` (mounted by the auth provider) watches the
   primary address. When it changes from one account to another, including through a sign-out in
   between, it resets the garden filters, closes the sheet flags and the work dashboard's return
   state, clears the garden workspace state, and removes account-scoped queries (the query key
   families that carry the previous address). Offline read models and drafts keep their own rules.
2. **Device preferences stay.** Language, debug mode, install and shell flags, and the media policy
   are untouched; write the list down beside the hook.
3. **The rule.** `packages/shared/AGENTS.md` (stores) states that a persisted store either keys by
   `chainId:address` or registers with the identity reset, and names the hook.
4. **The wallet sign-out (only if reproduced).** If the solo reproduction shows a WalletConnect
   session dropping during a tap, hold the `wallet` state through `restoring.wallet` for the
   reconnect window and log the transition; otherwise leave the restore path alone and record the
   reproduction's result here.

## Tests (RED first)

- A provider or hook test: address A then B resets filters and garden state; A then a reload of A
  keeps them; sign-out then B resets them.
- `useUIStore` test: the reset returns the defaults while `debugMode` survives.
- `useGardenStateStore` test for `clearAll` through the reset.

## Rendered proof

Mock-auth localhost: filter a Home list as one mock role, switch to another, and capture Home
opening with defaults. Label the captures. No authenticated proof is needed unless step 4 lands,
which then needs the phone walk recorded as pending.

## Validation

```bash
bun run --filter @green-goods/shared test -- src/__tests__/providers src/__tests__/stores
bun run --cwd packages/shared typecheck -- --scope full
bun run check --plan -- --intent push
node scripts/dev/ci-local.js --intent push --test-path shared:src/__tests__/providers/Auth.test.tsx
```

The critical plan keeps its full override. Adjust the test paths to the files that exist.

## Out of scope

Clearing site data, drafts, queued work or the reading cache; the membership and act work (W3-A).

## Implementation notes (2026-09-27)

- `useIdentityChangeReset(primaryAddress)` in `hooks/auth` is mounted by `AuthGate`, inside
  whichever provider it picks, with `usePrimaryAddress()`. Both apps mount auth only through the
  gate, and `Auth.tsx` sits at its frozen size ceiling, so the gate is the one mount point for the
  real and the mock provider; a mock-role switch, which reloads as another address, behaves as a
  real account switch does. It remembers the last account on the device (`getLastAccount` in
  `modules/auth/session.ts`, lower-cased, kept through sign-out) and, when a different account
  signs in, clears Home's filters, every sheet flag and the Work Dashboard's return point
  (`useUIStore.resetForAccountChange`), the garden workspace state (`useGardenStateStore.clearAll`),
  the admin's open sheets and per-page form state (`useSheetOrchestratorStore.clearAll`, new), and
  every cached read whose key names the previous account. A null address (signed out, restoring)
  decides nothing, and the first account on a device adopts what is there.
- It runs in a layout effect, so the new account's first frame never shows the old one's filters;
  by then the screens have moved their observers to the new account's keys, so the removed reads
  are inactive.
- What stays is listed beside the hook: language, debug mode, install and shell flags, the media
  policy, the reading cache's shared reads, the admin's last garden, and drafts and queued work
  (the admin's session-scoped create-garden and create-assessment drafts and a hypercert mint in
  flight included, since clearing drafts is out of scope).
- `packages/shared/AGENTS.md` states the store rule and names the hook.

## Step 4: the wallet sign-out

Not taken. The solo reproduction of N35's sign-out (Rabby extension or Rabby Mobile over
WalletConnect) has not been run; it rides the solo Stage A gate, and its result goes to this lane's
Linear child. The restore path is unchanged.

## RED and GREEN evidence

RED at `c17a03b46` with the new tests: the hook's module did not exist, and
`useUIStore.resetForAccountChange` was not a function; the gate's wiring test failed before the
gate mounted the hook. GREEN: the hook's three tests and the UI store test pass, and the full shared
suite passes.

## Unblock evidence

The lane closes when RED and GREEN are recorded, the PR merges, the sub-lane is `completed`, the
Linear child is Done, and the reproduction's result is written under step 4 either way.

## Validation Receipt

- Tested implementation commit SHA: `38e9c190c` (on `fix/account-switch-state-reset`)
- Run at (UTC): `2026-09-27T08:55Z` to `2026-09-27T09:10:07Z`, on the same tree just before its commit
- Exact command(s): `bun run --cwd packages/shared test` (full, before the mount moved from the providers into `AuthGate`); after the move, `bun run --cwd packages/shared test -- src/__tests__/hooks/auth src/__tests__/stores src/__tests__/providers` and `bun run --cwd packages/client test -- src/__tests__/routes src/__tests__/views/fund.test.tsx src/__tests__/views/VaultManagePositions.test.tsx src/__tests__/views/PublicVaults.test.tsx src/__tests__/views/Cookies.test.tsx src/__tests__/vite/pwa-shell.test.ts`; `bun run --cwd packages/shared typecheck -- --scope full`; `bun run --cwd packages/client typecheck`; `bun run --cwd packages/admin typecheck`; `bun --bun run oxlint` over the touched shared folders with `--deny-warnings`; `bun run check --only ontology`; `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js`
- Result: the full shared suite passed 5,936 tests (17 skipped) with the mount in the providers; after the move, the auth, store and provider suites passed 196 tests in 19 files and the client wallet-runtime and route suites passed 179 in 14. Every typecheck, oxlint, ontology and source structure passed. The critical plan's full client, admin and agent suites and the local pre-push gate were skipped at the owner's direction; PR CI runs the full suites.
- Validated paths: the non-plan paths `38e9c190c` changes against `c17a03b46`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- packages` → empty
- Evidence-only diff command and result (if applicable): this handoff commit changes only plan files
- Rendered proof: pending, mock-auth localhost: filter Home as one mock role, switch to another, and capture Home opening with defaults.
