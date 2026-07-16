# Dependency Modernization Migration Record

## Summary

Sequential dependency-family migration on `develop`, preserving public APIs, persisted state,
wallet/passkey behavior, contracts, GraphQL shapes, and rollback checkpoints.

## Blast Radius

- Compatible tooling and runtime updates span every workspace manifest and the Bun lockfile.
- Critical behavioral boundaries are shared auth/job queue/mutation hooks, persisted query/store
  state, wallet/passkey transactions, PWA caching, EAS contracts, and indexer GraphQL output.
- Contract majors, Envio 3, deployments, broadcasts, and hosted cutovers remain out of scope.

## Execution Order

Follow `plan.todo.md` waves. Coupled migrations preserve contracts -> indexer -> shared -> apps ->
agent ordering. Only one dependency family changes between green checkpoints.

## Validation Results

Wave 0 evidence is recorded in `baseline.md`.

- Frozen install, format, lint, deterministic app build, agent build, docs build, and plan-hub
  validation passed.
- The security baseline contains 5 critical and 81 high findings.
- The first sandboxed `bun run test` aborted when Foundry accessed macOS system proxy settings;
  the mandatory unrestricted rerun passed all workspaces, including 1,533 Foundry tests.
- The parent-only Linear mirror cannot be created in this environment; Afo explicitly deferred
  that mirror until later and authorized implementation to continue from `.plans` truth.

Wave 0 is green and ready for its checkpoint. No manifests, lockfile, application source, or
runtime images changed in this wave.

Wave 1 evidence is recorded in `wave-1-security.md`.

- Audit improved from 5 critical / 81 high to 0 critical / 64 high, and all named target
  advisories are removed.
- Frozen install, targeted package tests/typechecks/builds, PWA precache, and Repo Quick Gate pass.
- Afo explicitly waived authenticated Brave proof on 2026-07-16. Automated route tests,
  production builds, PWA proof, and Repo Quick Gate are the accepted Wave 1 substitutes.

## Risks / Rollback

- Revert the complete checkpoint when audit, peer, install, test, build, runtime, browser, persisted
  state, or public-contract proof regresses.
- Never manually edit the lockfile or force unsupported peer ranges.
- Keep the prior PostgreSQL volume/image pair for runtime rollback.
- Preserve the browser-proof waiver as a final certification limitation; do not claim authenticated
  rendered proof was run.

## Completion Checklist

- [ ] Every admitted wave is committed with green proof.
- [ ] Zero critical and zero direct high advisories remain.
- [ ] Remaining transitive highs have a parent chain and owner.
- [ ] Full Ship Gate plus agent/docs/runtime/browser certification passes.
- [ ] Plan and Linear parent mirror are closed only after all evidence is recorded.
