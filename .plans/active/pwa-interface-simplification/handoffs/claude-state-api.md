# PWA Interface Simplification - State/API Handoff

## Lane

- Owner: Claude (a session the orchestrator starts; questions go to the orchestrator)
- Branch: `feature/pwa-membership-owner` (step 1, PR #1274); `feature/pwa-active-garden` (step 2,
  stacked on step 1)
- Status: in progress (steps 1 and 2 built; the state parts of steps 4 and 5 follow their merge)

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

## Step 2: what changed

- `packages/shared/src/stores/useActiveGardenStore.ts` keeps one garden id per `chainId:address`
  scope in local storage under `green-goods:active-garden`, apart from the UI store and the
  cockpit's key. Saved choices are read as untrusted input; nothing in it forgets a garden.
- `packages/shared/src/modules/garden/active-garden.ts` is the pure resolver: `loading` while the
  account's gardens are unknown (keeping the remembered garden, after a failed read too),
  `error` when the read failed with nothing remembered, `none` for zero gardens, `ready` with the
  remembered garden while it is still the account's or with the one garden (which selects itself
  and is remembered), and `choose` otherwise. No account reads as `loading`.
- `packages/shared/src/hooks/garden/useActiveGarden.ts` wires the signed-in account, the store and
  the resolver, writes the one-garden choice, and exposes `selectGarden`, which accepts only one
  of the account's own gardens. It is a new declared leaf for step 3.
- `hooks/auth/useIdentityChangeReset.ts` names the store among what stays when another account
  signs in (keyed by chain and address), as `packages/shared/AGENTS.md` asks.
- Nothing reads the active garden yet: Home and the chip (step 3), Submit Work's fallback
  (step 4) and the offline photo garden (step 5) do. Drafts, queued jobs, promise links and
  permission checks never read it.

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
- RED (step 2), 2026-10-25, from `packages/shared`: `bun run test
  src/__tests__/modules/garden/active-garden.test.ts src/__tests__/stores/useActiveGardenStore.test.ts
  src/__tests__/hooks/garden/useActiveGarden.test.tsx` → 20 failed against "not implemented"
  stubs: the resolver 11 (zero, one, several, stored-eligible, stored-stale, a stale id replaced by
  the one garden, none with a remembered id kept, cached-while-loading, error-without-cache,
  an account switch, the scope's case), the store 4 and the hook 5.
- GREEN (step 2): the same command → 3 files, 20 passed; the full Shared suite → 7,655 passed.
  Two mutation checks (dropping the hook's eligibility guard, and reading any account's
  remembered garden) failed three cases, then were restored.
- Proof limit (step 2): drafts and queued jobs live in IndexedDB, which the hook test does not
  open. Their protection is structural: the store, the resolver and the hook import no draft,
  job-queue or commitment module directly, and the store writes only its own key. The hook test
  asserts that the work flow store (the submission in progress and its promise link) and every
  other local-storage record stay identical after a switch.

## Validation

- Step 1, before commit: full suites passed (Shared 7,635 with 16 skipped, client 1,747,
  admin 1,383); Shared and client typecheck in both scopes; `test-quality`, `source-structure`
  and `docs-generated` passed.
- Step 1 push gate: critical tier, the full override (31 checks). The first run, on
  `80db26067`, failed only `design-guardrails`, on colours develop's Grove spike had added to
  `packages/extension/src/graph/canvas.ts`; develop's own Design run failed the same way. After
  #1272 baselined them, the rerun below passed.
- Step 1 review round (CodeRabbit on #1274): the storage write in `forgetListedPendingJoins` now
  survives a refusal (RED: an uncaught `QuotaExceededError`; GREEN: the join and hook tests, 16
  passed). Not applied: counting the open join in Home's old filter, which never counted it;
  step 3 replaces that scope with the switcher and Explore, which read `useMyGardens`.
- Rendered proof: none (state only). `browser-proof` is advisory and pending: the offline content
  paths and Profile's list are in the authenticated class; acceptance (step 20) carries that
  proof.
- Step 2: the full Shared suite passed (7,655); Shared typechecks in both scopes; the four
  auth-session seam proofs passed (130 tests) before its fingerprint was refreshed for the
  comment in `useIdentityChangeReset.ts`. The push gate adds `browser-passkey` for that path.
  Its first run failed one spec, `client.reporting-account.passkey.spec.ts` ("trying again makes
  one account…"), which failed identically on plain develop `99884497b` in this worktree; with
  CI's placeholder `VITE_PIMLICO_API_KEY=test` all three passkey specs passed, and so did the
  rerun below.

## Validation Receipt

Step 1 (`feature/pwa-membership-owner`):

- Tested implementation commit SHA: `d2433563114ddeaa53bc444b7bec371a118abc17` (step 1's commits
  merged with develop `99884497b`, plus the review fix that guards the pending-join write; the
  first green run was on `ffdbd834a` at 03:40:51Z)
- Run at (UTC): `2026-10-25T04:30:33Z`
- Exact command(s): `VITE_PIMLICO_API_KEY=test PATH="$HOME/.local/share/mise/installs/node/22.22.1/bin:$PWD/node_modules/.bin:$PATH" node scripts/dev/ci-local.js --intent push`
- Result: passed, 30 of 31 selected checks fresh (format, lint, validation-system-test,
  test-quality, typecheck, test-typecheck, test and build for Shared, client, admin and Agent,
  docs-authority, docs-test, docs-build, staged-modules, source-structure, design-guardrails,
  agent-guidance, supply-chain, docs-generated, em-dashes); `browser-proof` pending (manual,
  advisory)
- Validated paths: the 28 paths of `git diff --name-only origin/develop d24335631`: the
  membership module and hook, the join reader, the Home filter, the arrival state, Submit Work,
  the offline policy and hook, Karma, the visibility config, the barrels and the Shared
  manifest, Profile's list, their tests, the API index and commands digests, the seam registry,
  and this hub's `status.json` and handoff
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  packages docs scripts` → empty
- Evidence-only diff command and result: `git diff --exit-code d24335631 -- packages docs
  scripts` → exit 0 (this record changes only `.plans/`)
- Evidence-only worktree-status command and result: `git status --porcelain=v1
  --untracked-files=all -- packages docs scripts` → empty

Step 2 (`feature/pwa-active-garden`, stacked on step 1):

- Tested implementation commit SHA: `8bae95387305c632786a1e168c23f7ac5424b550` (step 2's commits
  over step 1's final head `3cfc9f060`)
- Run at (UTC): `2026-10-25T04:10:45Z`
- Exact command(s): `VITE_PIMLICO_API_KEY=test PATH="$HOME/.local/share/mise/installs/node/22.22.1/bin:$PWD/node_modules/.bin:$PATH" node scripts/dev/ci-local.js --intent push`
- Result: passed, 31 of 32 selected checks fresh (step 1's 30 plus `browser-passkey`);
  `browser-proof` pending (manual, advisory)
- Validated paths: the 34 paths of `git diff --name-only origin/develop 8bae95387`: step 1's 27
  plus the active-garden resolver, store and hook, their three tests, and the comment in
  `hooks/auth/useIdentityChangeReset.ts` (the manifest, digests, seam registry and hub files
  changed again)
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all --
  packages docs scripts` → empty
- Evidence-only diff command and result: `git diff --exit-code 8bae95387 -- packages docs
  scripts` → exit 0 (this record changes only `.plans/`)
- Evidence-only worktree-status command and result: `git status --porcelain=v1
  --untracked-files=all -- packages docs scripts` → empty

## Risks / Blockers

- Step 5 changes what the phone keeps offline, and step 4 touches the submission controller: both
  are read line by line and keep the selector's full critical override.
- Record blockers here before changing `status.json`.
