# Wave 3 Application Platform

Captured on 2026-07-16 after the Wave 2 checkpoint at `0006cf7d6`.

## Changes

- Aligned React and React DOM to exact `19.2.7` across the root, docs, client, admin, and root
  overrides.
- Upgraded `@types/react` to exact `19.2.15`; kept the already-current
  `@types/react-dom` at exact `19.2.3`.
- Aligned TanStack Query and its persistence client to exact `5.101.2` in application packages
  while raising the shared peer floor to the same compatible release.
- Upgraded React Hook Form to `7.81.0`, resolvers to `5.4.0`, Zod to `4.4.3`, Zustand to
  `5.0.14`, XState to `5.32.4`, and idb-keyval to `6.3.0`.
- Kept the already-current `@xstate/react` `6.1.0`, whose peer range supports XState 5.32.4.
- Added compatibility characterization tests for the existing IndexedDB cache shape and the
  online paused-mutation resume hook. No persisted key, schema, query key, store shape, machine
  contract, hook export, form contract, or auth contract changed.

## Compatibility Evidence

- React DOM `19.2.7` requires React `^19.2.7`; the root override guarantees one application
  runtime.
- TanStack persistence `5.101.2` requires TanStack Query `^5.101.2`; both application packages
  are exact-aligned.
- Resolvers `5.4.0` accepts React Hook Form `^7.55.0`; Zustand accepts React 18+, and
  `@xstate/react` accepts XState `^5.28.0`.
- Every selected release passed the three-day release-age gate.
- The first focused run exposed a local incremental Bun-cache symlink that had skipped the
  existing compatibility normalization because `CI` was inherited and an older basics shim was
  present. Rerunning the existing unchanged postinstall shim normalized the new peer-hash paths;
  the repeated gate passed. A clean install starts without the shim and runs the normal path.

## Security and Supply Chain

- `bunx bun@1.3.14 install --frozen-lockfile`: **PASS**.
- `bunx bun@1.3.14 audit --audit-level=high`: **POLICY PASS**, with 0 critical and 64 transitive
  high findings, unchanged from Waves 1 and 2.
- The root multiformats/uint8arrays overrides, resolutions, and postinstall shim remain unchanged.
- No trusted dependency, registry, git dependency, or lifecycle-script permission was added.

## Validation

| Command or gate | Result | Evidence |
|---|---|---|
| shared platform characterization | PASS | 7 files and 98 tests cover Query defaults, reconnect resume, job queue storage, stores, XState auth, and forms. |
| client persistence/auth/offline characterization | PASS | 5 files and 34 tests, including a real IndexedDB persist/dehydrate/restore round trip. |
| admin form characterization | PASS | 2 files and 10 tests. |
| Repo Quick Gate | PASS | Shared 3,357 tests, client 638 tests, admin hub 102 tests, and agent 230 tests passed with required typechecks. |
| complete admin suite | PASS | 74 files and 539 tests. |
| deterministic Sepolia build | PASS | Contracts, shared, indexer, client/PWA, and admin built; PWA precache stayed within budget. |
| docs production build | PASS | Docusaurus built successfully with React 19.2.7. |

Authenticated Brave proof remains waived by Afo. Automated tests, deterministic production
builds, and PWA checks are the accepted evidence for this wave.
