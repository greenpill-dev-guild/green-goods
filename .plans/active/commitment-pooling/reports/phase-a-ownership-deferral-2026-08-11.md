# Phase A ownership deferral — 2026-08-11

## Decision

The current Commitment Pooling, Settlement, and Credit deployment ceremony ends with every touched
proxy paused and owned by the frozen deployment sender
`0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6`.

This ceremony does not:

- transfer any Arbitrum or Celo proxy to the protocol Safe;
- register or backfill the approved 18 GardenToken accounts with protocol root token 0;
- unpause Commitment Pooling;
- wire settlement peers, grant Safe/Zodiac value authority, ping, canary, or move value; or
- change or deploy the production indexer.

The exact live 2-of-6 protocol Safe
`0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19` remains the approved future owner.

## Current ceremony enforcement

- `commitment-pooling-release.json` declares the terminal state as
  `paused-deployer-owned` and sets ownership transfer, pool backfill, and unpause to false.
- Existing-proxy upgrade entries name the deployment sender as their current-ceremony end owner.
- An ownership broadcast fails before RPC whenever the current manifest excludes it.
- The one-password operator allowlist contains only the eight current deployer-signed
  upgrade/deploy/finalize wrappers. It rejects Arbitrum ownership, Celo ownership, and backfill.
- Every current wrapper accepts `--receipt` for exact mined-transaction recovery after a local
  checkpoint write failure.
- Post-deploy verification uses the default `deployment` owner phase. The Safe-owner verifier is
  intentionally not a current ceremony command.

No EOA-specific backfill path was introduced. The existing backfill is a Safe-receipt ceremony, so
changing its sender would create new authority behavior instead of merely shrinking this release.

## Later Product issue acceptance

Before ownership, backfill, or core unpause, the later issue must:

1. pin a new reviewed base and manifest that explicitly includes the transfer;
2. prove the ABI/storage-neutral paused-owner registration increment derived from `5e70654c3` is
   human reviewed, merged, and compatible with the final ABI/storage/event manifests;
3. reread the complete protocol-Safe owner set, threshold, code, and recovery facts on every target
   chain, including Celo rather than inferring equivalence from an address alone;
4. transfer one proxy at a time, verifying the exact sender, nonce, receipt, live owner, and atomic
   checkpoint before the next proxy;
5. generate and review the exact 18-garden/root-token-0 Safe transaction plan, verify one Safe
   receipt and post-state checkpoint at a time, and prove idempotent replay/recovery;
6. run the Safe-owner post-deploy verifier after all transfers and backfill; and
7. request core unpause as its own explicit authorization after every prior fact is green.

Safe/Zodiac value authority, message-only ping, minimum-value canary, and cap changes remain
separate issues/authorizations even after protocol ownership moves.

## Local proof

- `bun run release:manifest:write` regenerated the frozen lock and printed the
  `paused and deployment-sender owned` terminal state.
- Focused manifest, release-operator, and real release-entrypoint tests passed: 17 tests across
  three files. The complete script suite then passed 142 tests.
- The contracts wrapper passed 1,977 Solidity tests plus the 142 script tests. Full build, EIP-170
  size gate, all storage baselines, lint (zero errors), audit realism, and audit coverage passed.
- The read-only fork lane passed the CreditRegistry treasury round trip and all six bidirectional
  Arbitrum/Celo CCIP lane checks.
- The dedicated pinned-Arbitrum pooling shard passed all 37 pooling and ordered Assessment release
  rehearsal tests, including the renamed single-state release sequence.
- The indexer codegen and indexing-boundary checks passed; all 206 indexer tests and the TypeScript
  build passed. The hosted indexer was not contacted or changed.
- Plan Hub validation, architecture closure, ontology, repository format, and diff whitespace
  checks passed.
- The repository quick gate passed formatting, lint, typechecking, 3,417 shared tests, 658 client
  tests, 102 admin hub tests, and 245 agent tests. Its intentional quick-mode contract and indexer
  skips are covered by the complete package gates above.
- No deployment, broadcast, ownership mutation, Safe/Role grant, value movement, production
  indexer mutation, ping, canary, unpause, cap change, or Linear write occurred.

This report records a Phase A scope correction only. It is not a release-candidate disposition and
grants no Phase B authority.
