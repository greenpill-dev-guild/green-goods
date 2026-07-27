# Community contracts handoff

**Status:** BLOCKED — do not dispatch until the Commitment Pooling standalone registration helper implementation/interface is frozen. The append-only schema policy amendment and this exact handoff are already present.

## Inputs

- `spec.md` §§3–4 and the Commitment Pooling contracts interface/handoff.
- Existing Work/Assessment resolver UUPS patterns and the approved `packages/contracts/AGENTS.md` schema-policy wording.

## Outputs

- Four exact schemas/resolvers, including old/new UID events, typed custom errors, deterministic moderation head, native-direct-funding policy, `need-schemas` deploy target, tests, exact deployment artifact keys, and post-deploy verification described in `spec.md` §3.

## Acceptance

- Field order, revocability, resolver ABI/events/errors/initializer/UUPS rules, generated storage gaps, deterministic `(timeCreated, uid)` moderation reopening, same-garden references, native-token policy, append-only persistence, Sepolia gate, and non-zero UID checks match the spec exactly.

## RED / GREEN

- RED: resolver tests fail for unregistered garden, wrong role, bad reference/domain/merge/reopen/funding values, revocation policy, and storage layout before implementation.
- GREEN: all targeted unit/script checks and Sepolia dry-run pass; no existing schema or artifact key changes.

## Exact commands

```sh
bun run --filter @green-goods/contracts test:match -- test/unit/NeedResolvers.t.sol
bun run --filter @green-goods/contracts test:match -- test/StorageLayout.t.sol
bun run --filter @green-goods/contracts test:script
bun run --filter @green-goods/contracts build:full
bun packages/contracts/script/deploy.ts need-schemas --network sepolia --dry-run --pure-simulation
```

## Out of scope

Product UI, Envio EAS indexing, join-request storage, funding receipt oracle, broadcast, and changes to existing schema definitions.

## Unblock evidence

Frozen standalone helper ABI/implementation, named failing-test evidence, and a dry-run showing additive artifact output only. Re-read confirms the approved append-only guidance remains present.
