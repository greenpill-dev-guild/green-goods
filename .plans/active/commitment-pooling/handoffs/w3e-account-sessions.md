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

## Unblock evidence

RED and GREEN recorded; PR merged; sub-lane `completed`; Linear child Done; the reproduction's
result written under step 4 either way.

## Validation Receipt

Pending.
