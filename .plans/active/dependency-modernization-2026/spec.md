# Dependency Modernization 2026 Spec

## Summary

Modernize dependencies in sequential, reversible waves on `develop`. Every wave updates only one
coherent dependency family, preserves Bun's release-age and supply-chain protections, runs frozen
install and audit checks, proves affected behavior, and stops immediately when a compatibility or
security boundary cannot be satisfied.

## Users

- Primary: Green Goods developers, CI, and operators.
- Secondary: gardeners, funders, and administrators whose existing flows must remain unchanged.

## Functional Requirements

1. Apply the compatible and non-contract-major targets locked in `plan.todo.md` without silent
   target substitution.
2. Preserve public shared exports, query keys, persisted cache/store formats, auth and transaction
   lifecycles, GraphQL shapes, contract ABIs/storage, EAS schemas, and deployment artifacts.
3. Keep multiformats/uint8arrays overrides and the postinstall shim until a supported Wagmi 3 graph
   proves they are unnecessary on fresh installs and real wallet/passkey paths.
4. Keep GraphQL on 16.14.2 while graphql-request's supported peer range excludes GraphQL 17.
5. Record security, validation, rollback, and TDD/proof-limit evidence for every wave.

## Research Evidence

- Existing pattern references: the completed TypeScript 7 hub, the Envio 3 backlog hub, Bun
  dependency guidance, the migration protocol, and the Validation Intent Ladder.
- Source reviewed: all workspace manifests, root overrides/resolutions, Bun configuration, package
  guides, runtime images, CI scripts, current source imports, and existing regression tests.
- Evidence confirmed: TypeScript 7 is merged; the release-age gate is three days; multiformats and
  uint8arrays compatibility is load-bearing; quick CI omits contracts, indexer, builds, docs, audit,
  and frozen-install proof; root build omits agent and docs.
- Open inference: Wagmi 3 is admitted only if a release-age-eligible Reown adapter explicitly
  supports its peer graph at implementation time.

## Human Judgment Points

- Locked decisions: stay on `develop`, create one checkpoint commit per green wave, continue while
  green, and include non-contract majors but not contract or Envio majors.
- Protected surfaces: shared auth/job queue/work providers and mutation hooks, wallet/passkey
  transactions, contracts, indexer data, persisted browser state, and package-manager security config.
- Tradeoff: reaching a higher version never outweighs functional compatibility; unsupported majors
  are recorded as blocked rather than forced with peer overrides.

## Non-Functional Constraints

- Package boundaries: preserve workspace ownership and mandatory contracts -> indexer -> shared ->
  apps -> agent migration ordering for coupled changes.
- Performance: compare build/startup, PWA, virtualization, model-load, and indexer catch-up behavior.
- Security: preserve minimum release age and trustedDependencies; reject new direct critical/high
  advisories and unexplained registries, git sources, lifecycle scripts, or engines.
- Offline / sync: cache hydration, drafts, job queue, paused mutations, and service-worker behavior
  must remain stable.
- Localization: no new user-facing copy is planned; any unavoidable copy follows locale parity.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI | `ui` | UI/PWA dependency families and visible regression proof |
| State / API | `state_api` | Tooling, shared state, Web3, agent, indexer, and major migrations |
| Contracts | `contracts` | Compatible EAS dependency only; no ABI/storage/deployment changes |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential functional and regression certification |

## Risks

- Risk: lockfile churn hides an incompatible transitive dependency. Mitigation: one family per wave,
  frozen install, audit diff, and checkpoint commit.
- Risk: browser tests miss authenticated wallet/PWA behavior. Mitigation: authenticated Brave proof
  is mandatory for visible and wallet-sensitive waves.
- Risk: runtime image upgrade corrupts local data. Mitigation: copied PostgreSQL volume, fresh
  indexer generation, and rollback to the prior image/volume pair.
