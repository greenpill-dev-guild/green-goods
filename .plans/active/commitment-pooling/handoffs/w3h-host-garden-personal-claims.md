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
- On a protocol pool the route garden is the host, so W3-A's chain read (`useGardenMembership` for
  the route) already answers the reader's role in the host.
- `useGardenCommitmentController` takes `canClaimHere` on a protocol pool from whether either list
  has an entry, so a reader whose only garden is the host sees Find a Garden.
- `CommitmentClaims.tsx` hands `claimGardens.member` and `claimGardens.stewarded` to
  `ClaimContextSheet` as the personal and garden choices.

## Steps

1. **The lists.** Keep the host in `member` when the reader holds a role there, and keep it out of
   `stewarded`. Take the host's answer from the route garden's chain read, with the join overlay,
   the way `isMemberHere` does, so a revoked host role is not offered.
2. **The comment.** Rewrite the roles hook's comment to say which claim the host is refused for.
3. **The sheet.** Check that `ClaimContextSheet` reads well when the host is the only personal
   choice, and that a garden claim never lists it.

## Tests (RED first)

- `useCommitmentViewerRoles`: a reader whose only role is in the host gets the host in `member` and
  not in `stewarded`; a host steward gets the host in `member` only.
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

## Unblock evidence

RED and GREEN recorded; PR merged; sub-lane `completed`; Linear child Done.

## Validation Receipt

Pending.
