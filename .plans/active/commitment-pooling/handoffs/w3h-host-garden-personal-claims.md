# Pooling Rehearsal Follow-ups — W3-H The host garden counts for a personal claim

## Lane

- Execution sub-lane: `w3h_host_claim_context` (machine lane `state_api`)
- Branch: `fix/host-garden-personal-claims`, from a fresh `origin/develop` after W3-G merges
- Depends on: `w3g_commitment_send_record`
- Merge: `--merge` on green CI and resolved bot threads
- Class: sensitive (the commitment roles hook and the claim-context sheet)
- Linear child: `status.json` → `execution_sub_lanes.w3h_host_claim_context.linear.issue`
- Decision: § 1 row 49

## Scope

N42. On the protocol pool, a personal claim may name the host garden as its context when the reader
holds a role there. A garden claim still may not.

## What the code does today (read 2026-09-26 at `4615608d9`)

- `hooks/commitment-pooling/useCommitmentViewerRoles.ts` builds `claimGardens` for the protocol
  pool from every garden except the host, for both `member` and `stewarded`. Its comment says the
  contract refuses the host as a garden-claim context and gates a personal claim on membership, "so
  the host is left out of both lists". Develop had the same exclusion before W3-A.
- `AcceptanceLib.resolveClaimant` on a protocol pool reverts `GardenClaimMustBeExternal` only for a
  garden claim that names the host. A personal claim needs `isGardenMember(gardenContext,
  msg.sender)` in any garden, the host included, and then `requirePricedOfferClaimAuthority`, which
  adds no host rule.
- The route garden is not always the host. A protocol commitment opens through any garden's route
  (`GardenCommitment.test.tsx` covers a member's garden), and W3-A's chain read
  (`useGardenMembership`) answers for the route, so it cannot stand in for the host.
- `useGardenCommitmentController` takes `canClaimHere` on a protocol pool from whether either list
  has an entry, so a reader whose only garden is the host sees Find a Garden.
- `CommitmentClaims.tsx` hands `claimGardens.member` and `claimGardens.stewarded` to
  `ClaimContextSheet` as the personal and garden choices.

## Steps

1. **The lists.** Keep the host in `member` when the reader holds a role there, and keep it out of
   `stewarded`. Read the host's membership from chain for `pool.garden` itself, with its own
   `useGardenMembership` call and the join overlay, the way `isMemberHere` does for the route, so a
   revoked host role is not offered and a host-only member is not missed.
2. **The comment.** Rewrite the roles hook's comment to say which claim the host is refused for.
3. **The sheet.** Check that `ClaimContextSheet` reads well when the host is the only personal
   choice, and that a garden claim never lists it.

## Tests (RED first)

- `useCommitmentViewerRoles`: a reader whose only role is in the host gets the host in `member` and
  not in `stewarded`; a host steward gets the host in `member` only; with the commitment opened
  through another garden's route, the host's answer still comes from the host's own read.
- `useGardenCommitmentController`: a host-only member on the protocol pool gets `canClaimHere`
  true; a chain denial for the host takes it away.
- A client test that the personal claim queues with the host as its garden context.

## Rendered proof

Mock-auth localhost or Storybook: the protocol pool with a host-only member shows Take This Up and
a claim-context sheet listing the host for a personal claim. Label the captures.

## Validation

```bash
bun run --filter @green-goods/shared test -- src/__tests__/hooks/commitment-pooling src/__tests__/hooks/client-ui
bun run --filter @green-goods/client test -- src/__tests__/views
bun run --cwd packages/shared typecheck -- --scope full
node scripts/dev/ci-local.js --intent push --test-path shared:src/__tests__/hooks/commitment-pooling/useCommitmentViewerRoles.test.tsx
```

Adjust the test paths to the files that exist.

## Out of scope

N43, checking the other protocol contexts against chain roles; the send record (W3-G).

## Implementation notes (2026-09-27)

- `useCommitmentViewerRoles` reads the host's own membership with a second `useGardenMembership`
  call on `pool.garden`. The route and the host now share one rule (`membershipIn`): a completed
  chain read decides, a join that landed after it overrides its "no", and the indexed roster stands
  in only while the chain has not answered.
- The host joins `member` on that read and never joins `stewarded`. Other gardens are still listed
  from the roster and the join overlay.
- `claimGardensKnown` also waits for the host's read, so a pending read never shows Find a Garden.
  A failed host read counts toward `membershipUnavailable`, and Retry reads it again.
- `ClaimContextSheet` needed no change: it lists whatever the hook hands it, and a lone personal
  choice is preselected. Its comment and the controller's now say which claim refuses the host.
- No client test was added for the queued context. The client passes the chosen context through
  unchanged, which the existing delegation test covers, and nothing in the client decides the host.

## RED and GREEN evidence

RED at `524e3aefd` with the new tests, in `packages/shared`,
`bun run test -- src/__tests__/hooks/commitment-pooling/useCommitmentViewerRoles.test.tsx src/__tests__/hooks/client-ui/useGardenCommitmentController.test.tsx`:
five failed, each as the gap predicts. A host-only member on the protocol pool got no act, the host
was missing from `member` in three cases, and Retry read only the route. GREEN at `54fcf3e0b`: both
suites pass, with the controller's default fixture now listing the host it stewards for a personal
claim.

## Unblock evidence

The lane closes when RED and GREEN are recorded, the PR merges, the sub-lane is `completed`, and
the Linear child is Done. As of 2026-09-27, RED and GREEN are recorded above; the PR is open.

## Validation Receipt

- Tested implementation commit SHA: `54fcf3e0b` (on `fix/host-garden-personal-claims`)
- Run at (UTC): `2026-09-27T07:12:52Z` to `2026-09-27T07:17:30Z`
- Exact command(s): `bun run --cwd packages/shared test -- src/__tests__/hooks/commitment-pooling src/__tests__/hooks/client-ui`, `bun run --cwd packages/client test -- src/__tests__/views/GardenCommitment.test.tsx`, `bun run --cwd packages/shared typecheck -- --scope full`, `bun run --cwd packages/client typecheck`, `bun --bun run oxlint packages/client/src packages/shared/src --deny-warnings` and `SOURCE_STRUCTURE_BASE_REF=origin/develop node scripts/quality/check-source-structure.js`
- Result: shared hooks 108 passed in 12 files; the client commitment view 30 passed; shared and client typechecks exit 0; oxlint exit 0; source structure passed against `origin/develop`. The local pre-push gate was skipped at the owner's direction; PR CI runs the full suites.
- Validated paths: the five paths `54fcf3e0b` changes against `524e3aefd`
- Worktree identity command and result: `git status --porcelain=v1 --untracked-files=all -- <the validated paths>` → empty
- Evidence-only diff command and result (if applicable): `git diff --exit-code 54fcf3e0b -- <the validated paths>` → exit 0 before this handoff commit, which changes only `.plans`
- Rendered proof: none yet. The change is in the roles hook's lists, and the sheet renders them unchanged. Mock-auth localhost or Storybook proof of a host-only member stays pending.
