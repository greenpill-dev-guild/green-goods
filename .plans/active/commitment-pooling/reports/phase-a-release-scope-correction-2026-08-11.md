# Phase A Release Scope Correction — 2026-08-11

## Verdict

**COMMENT_ONLY. Phase A remains blocked. Do not authorize broadcast.**

This report records the owner decisions made after the immutable
`phase-a-release-engineering-review-2026-08-11.md` review and the resulting repository correction.
It does not rewrite that pinned report or certify a final combined candidate.

## Owner decisions applied

- Protocol Safe policy is a signature threshold of at least 2 with at least 3 owners. The exact
  live 2-of-6 protocol Safe set is approved for this release and remains subject to an exact live
  owner-set and threshold reread before ownership transfer.
- Garden settlement recovery remains its separate exact 2-of-3 policy.
- The hosted production indexer is an older deployment and is outside this contracts release lane.
  PRD-722 receives only the verified SettlementModule/CeloSettlementExecutor address and receipt
  start-block diff, then owns configuration, deployment/reindex, cutover/rollback, and read-back.
- Fable 5 review was dispatched against `de7863391`. Because this correction changes the candidate,
  that response may inform remediation but cannot certify the final commit.

## Operator ceremony correction

`contracts:release:operator` now verifies a clean checkout at an exact 40-character candidate,
prompts once for the frozen Foundry deployer keystore password, verifies that it unlocks the exact
manifest sender, and retains the credential only in a mode-0600 temporary password file for the
session. It launches no shell and accepts only the documented Bun broadcast wrappers and their
exact reviewed arguments. Network, sender, RPC, account, keystore, password, and private-key
overrides are rejected. A failed boundary closes the session.

Ownership transfer is the final deployer-signed Arbitrum action. The approved 18-garden backfill is
then Safe-signed and the Bun wrapper verifies the supplied Safe receipt; it does not require or infer
the deployer credential. A later Celo window may use the same still-open authorized session or a new
session with one new password entry.

## Fresh correction evidence

- Operator/manifest tests: 7 passed; contracts TypeScript typecheck and both package/root `--help`
  entrypoints passed.
- Solidity suite: 1,977 passed. Full build, EIP-170 size gate, all 15 storage layouts/namespaces,
  lint with zero errors, realism audit, and coverage audit passed.
- The combined contracts command reached 134 passing script tests, then 7 release CLI entrypoint
  tests stopped at the intentionally stale release identity lock. The lock must not be regenerated
  until paused-registration increment `5e70654c3` is reviewed, merged, and the final base is pinned.
- Indexer codegen, 12-contract/two-chain boundary check, 206 tests, and build passed. No hosted
  indexer command or production mutation ran.
- Architecture closure, ontology, format, source-structure, diff checks, and the repository quick
  gate passed.

## Remaining blockers

- Merge the separately reviewed paused-registration increment, then pin the final combined base.
- Freeze the remaining Safe/Zodiac owner, recovery, role, cap, fee, reserve, and live-authority gas
  inputs; value authority remains disabled.
- Regenerate and review the release lock on that final base, rerun the complete release entrypoint
  and fork gates, and obtain fresh exact-range internal plus Fable 5 dispositions.
- Peer wiring, Safe/Zodiac grant, message-only ping, core/value unpause, canary, and cap increase
  remain separately gated and have no implied authority here.

No deployment, broadcast, ownership or authority mutation, value movement, hosted-indexer action,
message-only ping, canary, unpause, cap change, or Linear write occurred.
