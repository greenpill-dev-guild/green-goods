# PWA Interface Simplification - State/API Handoff

## Lane

- Owner: Claude (a session the orchestrator starts; questions go to the orchestrator)
- Branch: `feature/pwa-membership-owner` (step 1); step 2 follows on its own branch
- Status: in progress (step 1 built; step 2 next)

## Scope (first slice)

- Step 1, the membership owner: one pure Shared module that answers which roles an account holds in
  a garden (gardener, steward, owner, evaluator, a pending open join) and tolerates a missing role
  list, plus a hook that returns the candidate gardens with loaded, error and stale flags. It
  carries PRD-1311's fix and regression test. The derivations below move onto it or delegate to it.
- Step 2, the active-garden store and resolver, as [spec.md](../spec.md#persistence-and-state-architecture)
  describes: a persisted Shared store keyed by `chainId:address`, separate from the UI store, and a
  resolver with the states loading, error, none, choose and ready.
- After both merge: the state parts of step 4 (Submit Work precedence) and step 5 (the offline
  photo garden).

## Code facts (develop `482d4b48e`, 2026-10-24)

The derivations of "my gardens" that step 1 retires or makes delegate:

- Home filter: `filterGardens` in `packages/shared/src/modules/garden/filters.ts`, re-exported by
  `hooks/garden/useFilteredGardens.ts`, counts gardeners and stewards through `gardenHasMember`
  (`utils/app/garden.ts`). #1162 added `isGardenMembersOnly` (`config/garden-visibility.ts`) for
  Aiyeloja Family Garden and Mama Gardens and applies it there with the same test; step 1 points it
  at the owner, which adds owners and evaluators, and keeps its cases in
  `__tests__/modules/garden-filters.test.ts`.
- Profile's list: `packages/client/src/views/Profile/GardensList.tsx:48` (`isGardenMember`).
- Arrival: `hooks/app/useArrivalState.ts:122-136` (stewards, gardeners and pending joins), read by
  `client/src/views/Home/index.tsx` and `views/Home/arrivalToast.ts`.
- Submit Work: `hooks/work/useWorkSubmissionFlow.ts:124` (`isGardenMember`).
- Offline: `modules/offline-content/policy.ts:32` and `hooks/offline/useOfflineContent.ts:73`
  (gardeners, stewards, owners), both spreading the role lists without a fallback (PRD-1311).
- Also reading roles: `hooks/garden/karmaIntegration.ts:204,216` (unguarded spreads, PRD-1311),
  `client/src/views/Home/Garden/index.tsx:177,193`, `hooks/commitment-pooling/useCommitmentViewerRoles.ts`,
  `hooks/public/usePublicGardens.ts:83` and the on-chain `hooks/roles/useGardenMembership.ts`.
  Decide per caller whether it moves; permission checks keep reading the garden record or the chain.

Two pendings stay apart. `isGardenMember` (`hooks/garden/useJoinGarden.ts:165`) counts an
optimistic open join (a local pending-join record with a time limit, cleared once the roster shows
the member) as membership. A join request on an approval-gated garden waits for a steward and
grants nothing; decision 2 shows it as awaiting review in the switcher and Explore.

The cockpit's selection pattern, to copy in shape and not in code: `hooks/garden/useAdminGardenContext.ts`,
`hooks/garden/useAdminGardenWorkspaceSelection.ts` and `hooks/navigation/useGardenUrlSync.ts`.

## Step 1: what changed

- `packages/shared/src/modules/garden/membership.ts` is the membership owner. `gardenMembership`
  reads the owner, steward, evaluator and gardener roles from a garden record, owner first, and
  tolerates a missing or malformed list; `isMyGarden` is "mine" (decision 2); `canSubmitWork`
  leaves out an evaluator alone, whom the work resolver rejects; `listMyGardens` keeps the list's
  order. Funders and community members are not members.
- `packages/shared/src/hooks/garden/useMyGardens.ts` returns the account's gardens with
  `isLoaded`, `isError` and `isStale`, and `refetch`. Another chain's placeholder list is never
  an answer. A fresh open join (the local pending-join record, read by the new
  `pendingJoinGardenIds` in `useJoinGarden.ts`) counts until the roster lists the account, then
  `forgetListedPendingJoins` drops it. A join request waiting for a steward never counts. It is
  a new declared leaf, `@green-goods/shared/hooks/garden/useMyGardens`, so Profile can read it;
  the API index and the four seam fingerprints were regenerated with it.
- The five derivations now delegate: Home's filter and #1162's members-only check
  (`modules/garden/filters.ts`, which adds owners and evaluators), Profile's list
  (`client/src/views/Profile/GardensList.tsx`), the arrival state (`hooks/app/useArrivalState.ts`),
  Submit Work's member check and its Community Garden offer (`hooks/work/useWorkSubmissionFlow.ts`),
  and the offline plan and its reschedule trigger (`modules/offline-content/policy.ts`,
  `hooks/offline/useOfflineContent.ts`). `gardenHasMember` is gone.
- PRD-1311: the offline spreads now go through the owner, and `hooks/garden/karmaIntegration.ts`
  guards its two spreads.
- Left on the record or the chain, as permission checks: the garden page's predicates
  (`client/src/views/Home/Garden/index.tsx`), `useCommitmentViewerRoles` (six roles, the
  contract's own test), the on-chain `useGardenMembership`, Karma's reconcile permission and the
  public people counts in `usePublicGardens`.
- Behavior changes to note: owners and evaluators now count in Home's "mine" filter and
  members-only check, Profile's list, the arrival's garden ids and the offline lists; owners can
  pick their garden in Submit Work (the resolver accepts them) while an evaluator alone still
  cannot; Profile shows its loading state, not "No gardens yet", while the list is unknown.

## TDD Proof

- RED (step 1), 2026-10-25, from `packages/shared`: `bun run test
  src/__tests__/modules/garden/membership.test.ts src/__tests__/hooks/garden/useMyGardens.test.tsx
  src/__tests__/modules/garden-filters.test.ts src/__tests__/hooks/useArrivalState.test.ts
  src/__tests__/modules/offline-content.test.ts src/__tests__/hooks/garden/useKarmaIntegration.test.ts`
  → 44 failed: membership 22/22 and useMyGardens 8/8 against "not implemented" stubs, filters 2
  (an owner or evaluator of a test garden is not a member), arrival 10 (still reads the gardens
  list), offline 1 (`TypeError: garden.gardeners is not iterable`) and Karma 1
  (`TypeError: input.owners is not iterable`), the PRD-1311 class. From `packages/client`:
  `bun run test src/__tests__/views/GardensList.test.tsx` → 9 failed (the list still read
  `useGardens`).
- GREEN (step 1): the same Shared command plus `src/__tests__/hooks/garden/useJoinGarden.test.ts`
  → 7 files, 122 passed; the client command → 9 passed. A mutation check (dropping the
  placeholder guard in `useMyGardens`) failed the chain-switch case, then was restored.
- Proof limit: none

## Validation

- Pending lane implementation.

## Validation Receipt

- Tested implementation commit SHA: pending
- Run at (UTC): pending
- Exact command(s): pending
- Result: pending
- Validated paths: pending
- Worktree identity command and result: pending
- Evidence-only diff command and result (if applicable): not applicable
- Evidence-only worktree-status command and result (if applicable): not applicable

## Risks / Blockers

- Step 5 changes what the phone keeps offline, and step 4 touches the submission controller: both
  are read line by line and keep the selector's full critical override.
- Record blockers here before changing `status.json`.
