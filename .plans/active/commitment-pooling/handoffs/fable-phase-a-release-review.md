# Commitment Pooling — Fable 5 Phase A Release Review

## Status

- Reviewer: Fable 5
- Owner: Afolabi Aiyeloja
- State: queued; not dispatchable until every activation-gate field below is exact
- Best review point: after the paused-registration contracts increment is human-reviewed and merged,
  the release branch is rebased on that merge, all manifests/locks are regenerated, and the full
  Phase A gate is green; before any Phase B authorization request
- Authority: read-only review only; no file mutation, deployment, broadcast, ownership transfer,
  Safe/Zodiac grant, value movement, indexer activation, ping, canary, unpause, cap change, or
  Linear write

This is an additional independent review of the final combined Phase A candidate. It complements
the accountable internal committed-range review selected by the August 10 owner decision; it is
not a commissioned external audit and is never broadcast authority.

## Activation gate

The release operator must replace every bracketed field before sending this prompt. Fable must
stop immediately if any field is absent, the worktree is dirty, the range is not an ancestor range,
or the artifact hashes do not match the pinned commit.

- Combined base: `[40-character merged develop commit]`
- Candidate commit: `[40-character release-candidate commit]`
- Review range: `[combined-base]..[candidate-commit]`
- Manifest hash: `[0x-prefixed 32-byte hash]`
- Release lock path/hash: `[path]` / `[0x-prefixed 32-byte hash]`
- Protocol Safe decision/policy disposition: `[exact recorded disposition]`
- Envio Cloud target: `[organisation/indexer/branch/root/config/commit]`
- Previous production indexer commit: `[40-character rollback commit]`
- Validation receipt: `[new final Phase A report path]`

Before review, prove the paused-registration increment derived from `5e70654c3` is an ancestor of
the combined base. Do not review the isolated worktree commit as though it were already merged.

## Ready-to-paste review prompt

You are Fable 5 performing an independent, adversarial, read-only review of the Green Goods
Commitment Pooling, Settlement, and Commitment Credit Phase A release candidate.

Repository: `/Users/afo/Code/greenpill/green-goods`

Review exactly the activation-gate commit and range above from a clean snapshot. Do not review
uncommitted files, later commits, commit messages as evidence, or either implementation branch.
Read the root `AGENTS.md`, package guides for contracts and indexer, the complete active Commitment
Pooling and Commitment Credit hubs, the three frozen specs, the final Phase A report, combined
manifest/lock, deployment wrappers, artifact merge/recovery code, courier fixture, post-deploy
verifiers, indexer Cloud wrapper, and every changed file in the exact range. Read actual code.

The architecture is frozen: Arbitrum holds commitment/payout/credit truth; SettlementModule sends
message-only authenticated CCIP commands; CeloSettlementExecutor invokes bounded Safe/Zodiac
canonical-G$ authority; Celo acknowledgment is required before Arbitrum confirmation. There is no
token bridge, raw G$ indexing, custodial module, or enabled G$ repayment rail.

Review these lanes independently and then as one transaction sequence:

1. Manifest and identity: chain IDs/selectors, routers, peers, CREATE2 salts, libraries, bytecode
   hashes, proxy/admin/owner/initializer state, schema UIDs, exact 18-garden/root-token-0 inventory,
   artifacts, and stale/partial/conflicting recovery.
2. Authority and custody: protocol Safe owners/threshold and its recorded guidance disposition,
   rollback ownership, executor-not-owner, Safe recovery, Zodiac target/selector/recipient
   conditions, caps, fee policy, reserve floors, sender drift, owner races, nonce drift, and any
   path to value authority before a separate authorization.
3. Settlement safety: peer/version/gas snapshots, unsupported lanes, retirement grace and unresolved
   commands, replay/idempotency, same-key reroute, duplicate value, cancellation after execution,
   batch-kind mixing, malformed messages, acknowledgment receiver/version binding, and authenticated
   success as the only confirmation path.
4. Upgrade and rollback: actual old implementations, storage/ABI/event compatibility, the sequential
   AssessmentResolver upgrade plus canonical v2 pin, schema finalization, paused pool registration,
   integration upgrades, ownership transfers, one-transaction boundaries, post-action verification,
   and the safe resumable state after every possible one-of-many failure.
5. Persistence and recovery: first run, replay, stale side file, interrupted write, on-chain-success/
   local-write-failure, code-hash mismatch after retry, preservation of unrelated historical Celo
   keys, and canonical artifact mutation during simulation.
6. Indexer and cutover: Green Goods settlement events only, exact address/start-block diff, full
   reindex semantics, deploy versus promotion separation, read-back convergence, previous production
   version rollback, and any possibility that a Git push or dry-run activates production.
7. Review provenance: exact committed range, generated ABI/storage/event/lock equality, current live
   read-only evidence, proposed signer/owner/window/rollback checkpoint, and whether any claim uses
   dry-run language as deployed or Celo execution as paid.

Use only repository Bun wrappers. Do not run raw Forge. You may run read-only local/fork/live
inspection, but no mutating command and no Envio deploy/promote/rollback action. Re-run the exact
help and validation commands named by the final report rather than inventing commands.

Report numbered findings first, ordered Critical, High, Medium, Low. Each finding must include the
concrete failure mode, impact, exact file and line, and the smallest safe remediation. Separate
confirmed defects from missing external evidence and from intentionally gated future stages. Then
provide a requirement coverage ledger for the seven lanes above and one verdict:

- `ACCEPTED FOR PHASE B AUTHORIZATION REQUEST`
- `BLOCKED ON CODE OR ARTIFACT DEFECTS`
- `BLOCKED ON EXTERNAL EVIDENCE OR OWNER DECISION`

Acceptance requires no unresolved Critical or High, exact manifest/artifact/generated-output
agreement, clean dry-run/recovery/courier/verifier entrypoints, explicit disposition of every
Medium, and no hidden broadcast or value authority. A review acceptance never authorizes Phase B.

## Dispatch evidence

When the activation gate is complete, attach the Fable response unchanged to the new final Phase A
report, record every disposition, rerun any affected gate, and pin the post-disposition commit. Any
code or artifact change after Fable review invalidates that review and requires a new exact-range
pass.
