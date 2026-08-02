# Community contracts handoff

**Status:** BLOCKED — do not dispatch until the Commitment Pooling standalone registration helper implementation/interface is frozen. The append-only schema policy amendment and this exact handoff are already present.

## Inputs

- `spec.md` §§3–4 and the Commitment Pooling contracts interface/handoff.
- Existing Work/Assessment resolver UUPS patterns and the approved `packages/contracts/AGENTS.md` schema-policy wording.

## Locked architecture

- Four exact schema records across two UUPS proxies:
  - `NeedsResolver`: Need, NeedSignal, NeedStatus with exact-schema dispatch and unknown branches failing closed.
  - `FundingAttributionResolver`: FundingAttribution plus dependent Need UID and native-direct policy.
- EAS `recipient` is the garden. Root Need requires `refUID = 0`; every child requires `refUID` to an exact, same-recipient, non-revoked, non-expired Need.
- `NeedSignal` decodes only `bool support`. NeedStatus keeps `mergedIntoNeedUID` because that is a second relationship.

## Outputs

- Two implementations/proxies, four schema registrations, atomic UID configuration/events, typed custom errors, deterministic `moderationHead[attestation.refUID]`, native-direct-funding policy, `need-schemas` deploy target, tests, exact deployment artifact keys, and post-deploy verification described in `spec.md` §3.
- Deployment artifacts expose only `needsResolver` and `fundingAttributionResolver` at the resolver level; all four schema strings and UIDs remain independently persisted.

## Acceptance

- Field order, per-attestation revocability, v1 zero expiration, resolver ABI/events/errors/initializer/UUPS rules, generated storage gaps, deterministic `(timeCreated, uid)` moderation reopening, exact-schema/same-garden/live-parent references, native-token policy, append-only persistence, Sepolia gate, and non-zero/pairwise-distinct UID checks match the spec exactly.

## RED / GREEN

- RED: resolver tests fail for unknown schema, zero/duplicate UID configuration, root nonzero reference, missing/wrong-schema/cross-garden/revoked/expired parent, wrong role, bad domain/merge/reopen/funding values, expiration/revocability policy, and storage layout before implementation.
- GREEN: all four schema branches, both signal directions, two proxies, additive artifact merge, targeted unit/script checks, lint/build, and Sepolia dry-run pass; no existing schema or artifact key changes.

## Exact commands

```sh
bun run --filter @green-goods/contracts test:match -- test/unit/NeedResolvers.t.sol
bun run --filter @green-goods/contracts test:match -- test/StorageLayout.t.sol
bun run --filter @green-goods/contracts test:script
bun run --filter @green-goods/contracts lint:check
bun run --filter @green-goods/contracts build:full
bun packages/contracts/script/deploy.ts need-schemas --network sepolia --dry-run --pure-simulation
```

## Out of scope

Product UI, Envio EAS indexing, join-request storage, funding receipt oracle, broadcast, and changes to existing schema definitions.

## Unblock evidence

Frozen standalone multi-resolver registration helper ABI/implementation, named failing-test evidence, and a dry-run showing two proxies/four schemas with additive artifact output only. The existing one-schema resolver-less `badge-schemas` path is a reusable convention but does not by itself clear this gate. Re-read confirms the approved append-only guidance remains present.

Fresh code re-read on 2026-07-28, after current HEAD included Envio migration commit `8fd89e660`, still found only the resolver-less one-schema `badge-schemas` implementation plus legacy deployment/test registration helpers. No standalone multi-resolver production helper, `commitment-schemas` target, or frozen helper tests exist yet, so this lane cannot inherit the Commitment Pooling interface without inventing it.
