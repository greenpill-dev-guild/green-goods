# PWA Interface Simplification - State/API Handoff

## Lane

- Owner: Claude (a session the orchestrator starts; questions go to the orchestrator)
- Branch: set when work begins using `<type>/<work-description>`
- Status: ready (opened at the start gate on 2026-10-24)

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

## TDD Proof

- RED: pending
- GREEN: pending
- Proof limit: none recorded

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
