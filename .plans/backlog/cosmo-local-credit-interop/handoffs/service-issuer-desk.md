# Persistent member service desk — implementation handoff

The existing Agent SQLite database now stores steward service drafts, sent revisions, member
decisions and immutable revision history. Stewards explicitly load, prepare, review, save and
send terms for one configured exchange pool. Members explicitly load their own sent drafts,
review the terms and approve or decline. Approval is persisted only after the server verifies
the separate EIP-712 terms signature. Nothing here deploys a token, activates an issuer, mints
vouchers or changes previously issued services.

Runtime is frozen for root's serial consumer proof. The final bounded review corrections reject
surrounding whitespace in deployment token names and service units, and show a sent revised
draft as changed when its former approval has been cleared. Focused regression assertions cover
both corrections; those latest assertions and the new Admin editor still need the final run.

## Ownership and public API

- `packages/shared/src/public-contracts/service-issuer-desk.ts` owns draft, approval, persisted
  record, command and signed-request types. `ServiceIssuerDeskRecord` includes canonical pool
  context and a ledger `revision`, separate from `draft.terms.revision`.
- `modules/commitment-pooling/service-issuer-approval-terms.ts` contains the existing pure
  digest, typed-data and provenance rules. `service-issuer-approval.ts` retains browser signing
  and re-exports those rules. Agent does not import browser signing machinery.
- `modules/commitment-pooling/service-issuer-desk-protocol.ts` owns strict parsing, the separate
  proof domain, bigint serialization and receipt-backed pool selection. The HTTP route is
  `/public/service-issuer-desk`.
- `modules/commitment-pooling/service-issuer-desk-client.ts` owns explicit authenticated HTTP
  commands. `hooks/commitment-pooling/useServiceIssuerDesk.ts` composes them with account signing
  and query state. Import the hook and types through `@green-goods/shared/commitment-pooling`.

`useServiceIssuerDesk(selection?: {routeId,poolId} | null)` returns `records`, `loaded`,
`isLimited`, `canSign`, and the mutations below. With no selection, `load` reads the current
member's own sent drafts; with a selection it reads that pool's steward desk. Mounting never
prompts for a signature. Writes have no automatic retry or offline resume.

| Mutation | Input | Behavior |
| --- | --- | --- |
| `load` | none | Explicit signed read; at most 200 records with a partial-window flag |
| `save` | `{draft,expectedRevision}` | Creates or revises proposed terms under the selected pool; null revision creates |
| `send` | stored record | Makes the exact saved revision available to its member |
| `approve` | stored record | Re-reads the current revision, signs exact terms, then persists the verified approval |
| `decline` | stored record | Declines only the member's current sent, unapproved revision |

The former unavailable `useServiceIssuerDrafts` and cache-only `useServiceIssuerApproval` hooks
and their obsolete test were retired after both consumers migrated. Per-pool issuer listing
reads in `useServiceIssuerOnboarding.ts` remain intact.

## Persistence and authority

- New Agent owners are `services/db/service-issuer-desk.ts`, `services/service-issuer-desk.ts`,
  `services/service-issuer-desk-authority.ts` and `api/routes/service-issuer-desk.ts`.
- The existing SQLite schema version 11 includes current-draft and append-only revision tables.
  `BEGIN IMMEDIATE`, expected-revision checks and immutable member/context fields reject stale
  competing writes. Exact successful retries return the same state. Saved edits increment the
  terms revision, clear current approval and require a new explicit send and member signature.
- An approved revision cannot be declined in place. Revision history retains its approval when
  later proposed terms change. An old terms signature cannot approve the new revision.
- Server-derived context binds route, pool, garden and source chain. Caller labels such as
  `garden` and `preparedBy` cannot confer authority. The actual current pool runtime/proxy pins,
  owner and recognized underlying Safe guard determine steward access.
- A pool may be owned by its configured Safe or its exact approved AccessManager. In the latter
  case, the configured Safe must currently hold manager role 0, then the actor must satisfy that
  Safe's owner/guard checks. The manager is never treated as a Safe. Nonzero manager delay is
  allowed only for this offchain draft desk; no onchain governance delay is bypassed.
- Contracts-agent readback at 2026-11-08 05:50:17 UTC, block 49168571, confirmed the Green Goods
  pool's exact configured AccessManager and Safe role 0 with an 86400-second delay. Tests cover
  that route and reject unknown managers, missing role, changed runtime and invalid guard access.
- Signed commands bind actor, Gnosis chain, audience, timestamp and the complete command body.
  Proofs expire after five minutes. Identical read proofs alone may be cached for 60 seconds;
  every mutation is separately signed. Session generations invalidate work across account return
  and sender replacement, and offline commands fail immediately.
- `services/account-signatures.ts` now exposes a raw hash verifier alongside the existing
  message verifier. EOA recovery and the universal ERC-1271/ERC-6492 validator verify the exact
  typed-data hash. Personal-message authentication does not substitute for approval verification.
  Provider outages remain distinguishable from invalid signatures.

## Terms and downstream boundary

Draft validation follows the actual member deployment boundary: six token decimals; canonical
symbol; positive finite capacity, issued supply and pool inventory; inventory within issued
supply and holding cap; issued supply within capacity; and a pool fee between zero and
1,000,000 millionths. Reward allowance may exceed current stock but must be finite. Document
references require HTTPS without credentials and a nonzero 32-byte digest. Token name and
service unit must not contain surrounding whitespace.

The Admin editor expresses fee as percent with at most four decimal places, so 1.25% becomes
12,500 millionths. Voucher amounts use six decimals. Excess precision is rejected rather than
rounded. Full pool identity, amounts, capacity and service terms are reviewed before save, and
the saved revision is reviewed again before sending it to the member.

Final browser-review corrections: the editor's Storybook controls exclude bigint-bearing route,
pool and record objects; the wrapper uses the established toast service leaf import. Narrative
fields `buys`, `scope` and `remedy` now preserve LF/CR line breaks entered in textareas, while
other control characters and multiline identity/document values remain rejected. New protocol
and editor regression assertions accompany that narrow parser correction; final reruns belong
to the root's serial gate.

Approval provenance remains
`issuer-approval:100:<member>:<draftId>:<termsRevision>`. The existing approval export now includes
the full signed record and context through the other agent's dialog changes. Contracts tooling
may consume that bounded reference, but metadata alone never activates or funds the service;
actual member signing and deployment/readback remain separate gates.

## Admin consumer files

- `packages/admin/src/views/Community/components/VoucherIssuerOnboarding.tsx` now uses the durable
  desk, explicit load and save/send actions. It surfaces failures and partial results.
- New `VoucherIssuerDraftEditor.tsx` supplies create/edit/review/save with existing Admin form and
  dialog components. Editing locks member identity; failures retain the reviewed terms.
- New `VoucherIssuerDraftEditor.stories.tsx` covers existing terms, new service, saving and save
  failure. New `src/__tests__/views/VoucherIssuerDraftEditor.test.tsx` covers review before save,
  exact fee and pool identity, excess precision, failed save and pending controls.
- `voucherIssuerRows.ts` and `VoucherIssuerOnboarding.test.tsx` include the revised-draft status
  correction. The Shared/UI agent owns Client integration, approval dialogs and en/es/pt copy.

## Observed proof and remaining checks

- Agent focused command:
  `bun run --cwd packages/agent test -- src/__tests__/service-issuer-desk.test.ts src/__tests__/service-issuer-desk-authority.test.ts src/__tests__/account-signatures.test.ts`
  — 3 files / 14 tests passed, observed 2026-11-08 05:52:57 UTC. This covers actual EOA command
  proofs, distinct approval signatures, forged approval rejection, CAS/retries, immutable history,
  approved-decline rejection, canonical context and exact manager authority.
- Shared focused command:
  `bun run --cwd packages/shared test -- src/__tests__/service-issuer-desk-client.test.ts src/__tests__/hooks/commitment-pooling/useServiceIssuerDesk.test.tsx src/__tests__/service-issuer-approval.test.ts`
  — 3 files / 16 tests passed, observed 05:51:12 UTC. This preceded the additional parser bounds
  test and the final member check, whitespace and status assertions.
- Agent and Shared full source/test typechecks passed at the backend checkpoint. Root's later
  full Agent run reported 635 passing tests and four timeouts in three unrelated avatar/media
  files under host load; all new award/desk tests passed. Root owns serial timeout reruns.
- A targeted runtime oxlint check passed. The last owned formatting pass completed successfully
  at the final freeze. The two later child-started consumer typechecks were intentionally canceled
  for host contention and do not count as passing proof.
- Remaining root-owned proof: final Agent/Shared/Admin source and test typechecks, focused final
  desk/approval/editor/onboarding suites, source-structure and lint checks, and rendered editor,
  member approval and award flows. No rendered proof was collected by this child.
- No live approval or transfer was signed, no transaction was broadcast, no deployment was made
  and no external record was published. New pool activation is not implied by local desk support.

Sensitive changes across this child slice: Agent schema/startup/API registration and the account
hash verifier; Shared manifest adds six explicit leaf exports only (award config, award Safe,
approval terms, desk protocol, award public types, desk public types). There are no dependency,
lockfile, environment-file, permission or release-setting changes. See
[voucher award handoff](voucher-awards.md) for the separate durable grant protocol and Gnosis RPC
correction. Production continues to require one authoritative mounted SQLite ledger.

## Certified seam fingerprint refresh — 8 November 2026 UTC

The six additive Shared manifest exports invalidated all four certified seam fingerprints because
`scripts/quality/check-direct-tested-seams.mjs` includes the complete exporting package manifest
in `registryFiles()` (line 322), then hashes those bytes in `evidenceFingerprint()` (line 340).
A read-only byte comparison against HEAD established that `packages/shared/package.json` was
the only changed declared fingerprint input for each entry. All registered implementation,
composition-root, direct-consumer and proof files matched HEAD, and all existing export targets
were unchanged. Recomputing with only HEAD's manifest restored every recorded fingerprint;
recomputing from all HEAD inputs also matched. This is a statement about the registry's declared
inputs, not a claim that the broader commitment-pooling dependency graph was unchanged.

The lead then reported a fresh Shared full-suite run with 724 passing files and 9,538 passing
tests. Every registered direct, conformance and integration proof passed. A separate
`voucher-console-live.test.ts` file had five old pool/wallet expectation failures being corrected
by its owner; that full run was not reported as green. Based on the passing registered proof and
the manifest-only fingerprint change, the lead authorized this narrow refresh.

`node scripts/quality/check-direct-tested-seams.mjs --print-fingerprints --json` produced the
deterministic replacement values. Only all four `evidenceFingerprint` fields and `reviewedAt`
dates (`2026-11-08`) changed in `scripts/data/module-seam-registry.json`; lifecycle, proof paths
and baselines are unchanged. `bunx --no-install biome format --write scripts/data/module-seam-registry.json`
passed without additional changes. Final
`node scripts/quality/check-direct-tested-seams.mjs --json`, observed 07:04 UTC, returned
`registryViolations: []` and `stale: []`. Its overall exit status remains **1** solely for
`missing-direct-import` in an ignored temporary signer-server test; that file and baseline were
left untouched. No heavy checks were run by this child for the refresh.

Task record: cosmo-local-credit-interop / member service desk | Type: feature | Outcome: local implementation ready, final integration proof pending
Agent/model: voucher_award_storage / runtime model unknown | Coverage: persistent desk, Admin editor and targeted verification follow-ups through 2026-11-08 07:04 UTC

| Phase | Start → end (UTC) | Result / evidence or blocker |
| --- | --- | --- |
| Investigate | unknown → unknown | Existing Agent persistence and exact pool/Safe authority selected |
| Implement | unknown → 2026-11-08 06:23 | Durable desk, cryptographic approval, explicit consumer flows and bounded review corrections |
| Verify/review | 2026-11-08 05:51 → 06:23 | Focused backend/Shared green checkpoint; new Admin proof and final regressions pending root's serial gate |
| Wait | unknown → ongoing | Root coordinates heavy checks serially after observed host contention; runtime frozen |
| Review / verify | unknown → 2026-11-08 07:04 | Declared seam inputs compared with HEAD; registered proofs passed in lead's fresh suite; narrowly refreshed fingerprints and confirmed no registry violations |

Human corrections: unknown; attention: unknown. No publish phase entered.
