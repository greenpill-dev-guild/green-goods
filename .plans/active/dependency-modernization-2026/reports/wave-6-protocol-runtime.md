# Wave 6 — Compatible Protocol and Runtime

**Branch**: `chore/dependency-upgrades`
**Status**: green and ready for checkpoint
**TDD**: not applicable — no product, contract, schema, or handler source adaptation

## Applied

- EAS contracts `1.8.0 → 1.9.0` and EAS SDK `2.7.0 → 2.9.0`, exact-pinned.
- Envio `2.32.3 → 2.32.12`, exact-pinned.
- Indexer runtime `node:20-slim → node:22-slim`; package engine aligned to Node `>=22.12.0 <23`.
- PostgreSQL `17.5 → 17.10` in the durable indexer Docker Compose stack.
- Hasura remains `v2.43.0`, exactly matching Envio 2.32.12 generated output.
- The Bun lockfile was regenerated from every current workspace manifest after the supplied audit
  exposed that the first Wave 6 rehearsal had retained stale root/admin/agent/docs importer pins.
- Compatible security overrides now force Axios `1.16.0`, `systeminformation` `5.31.7`, Lodash and
  Lodash-ES `4.18.1`, node-forge `1.4.0`, and Babel's SystemJS transform `7.29.4`.

## Compatibility evidence

- Envio generated-state hashes are unchanged for config, schema, handlers, and ABIs.
- `IEAS.sol` and `ISchemaRegistry.sol` are unchanged across EAS contracts 1.8.0 and 1.9.0.
- The EAS contract change is limited to internal resolver implementation/version metadata; no Green
  Goods Solidity source, ABI, storage layout, EAS schema, deployment artifact, indexer schema, or
  handler changed.
- The six added security overrides are same-family updates, passed the three-day release-age gate,
  and add no registry, git dependency, lifecycle script, trusted dependency, or engine change.
- `systeminformation` 5.31.7 was released on 2026-05-29 and is the maintainer's patched version for
  [GHSA-5xpp-75jx-m839](https://github.com/sebhildebrandt/systeminformation/security/advisories/GHSA-5xpp-75jx-m839).
  Bun 1.3.14 regenerated the 3,578-package lock with only the override,
  resolved version, and integrity hash changing from 5.31.6.

## Green validation

- Bun 1.3.14 frozen install passed before the final `systeminformation` advisory expansion: 3,458
  installs across 3,578 packages with no changes, including the preserved multiformats postinstall.
- Contract build: passed.
- Contract resolver suites: 95 passed, 0 failed.
- Shared EAS/assessment suites: 84 passed, 0 failed.
- Client assessment suite: 10 passed, 0 failed.
- Envio 2.32.12 codegen: passed before the registry outage; generated ReScript build passed again.
- Indexer build: passed.
- Indexer boundary: 10 contracts and 2 networks validated.
- Indexer tests: 186 passed, 0 failed.
- Repo Quick Gate: passed, including format, lint, typechecks, 3,357 shared tests, 638 client tests,
  102 admin hub tests, and 230 agent tests.
- Secured-graph revalidation passed under the sanitized mirror: 3,357 shared, 638 client, 230 agent,
  102 admin hub, and 186 indexer tests (4,513 total), plus docs, agent, client, and admin builds and
  the client PWA precache budget.

## Supplied audit and remediation

The human-supplied `bun audit --audit-level=high` result reported **0 critical / 43 high**. It was
run before the corrected all-workspace lock regeneration and before the six compatible overrides
above, so it is evidence for the pre-remediation graph rather than certification of the current
lock.

The six overrides remove 15 reported high advisory instances: Lodash (1), Lodash-ES (1), Axios
(6), node-forge (4), Babel SystemJS (1), and the first two systeminformation advisories (2). The
next supplied audit reported **0 critical / 29 high** because GHSA-5xpp-75jx-m839 expanded the
affected range through systeminformation 5.31.6. The override and lock now use the patched 5.31.7.

The final normal-terminal audit on 2026-07-17 reports **0 critical / 29 high**, all transitive. The
patched `systeminformation` graph is clean. The total remains 29 because GitHub reviewed and
updated the new `adm-zip` advisory on the same day as the final audit. Its only patched release,
0.6.0, is a pre-1.0 breaking update with documented extraction behavior changes, so globally
overriding the EAS/Hypercert parent ranges is not a safe compatible repair.

| Residual family | Expected highs | Reachability and owner |
|---|---:|---|
| OpenZeppelin contracts / upgradeable 4.7.3 | 2 | Chainlink CCIP/Arbitrum vendor graph; the affected Governor compatibility surface is not imported by Green Goods. Hold for the dedicated CCIP/OpenZeppelin plan. |
| adm-zip 0.4.16 | 1 | EAS contracts and Hypercert development parents. Green Goods does not pass user-controlled ZIP archives to this package. Upgrade through compatible EAS/Hypercert parents; do not force the behavior-changing 0.6.0 release globally. |
| minimatch | 12 | Build, lint, test, docs, and codegen tooling paths. Update through compatible parents; do not globally collapse Bun's mixed major graph. |
| serialize-javascript | 1 | Mocha/Workbox/Docusaurus/Storybook/Sentry build tooling. Requires parent upgrades or the Wave 7 major, not a forced global major. |
| tmp | 1 | LHCI and Solidity/EAS/Hypercert development tooling. Mixed pre-1.0 APIs make a global override unsafe. |
| undici | 7 | Vulnerable 7.x instances sit under docs and contract-development parents; the graph also contains 5.x, so defer to compatible parent releases. |
| ws | 2 | Some 8.x paths are wallet/runtime reachable; mixed 7.x/8.x graph prevents a safe global override. Owner: Web3 parent upgrades and Wagmi 3 compatibility lane. |
| path-to-regexp | 1 | Express/MSW/Docusaurus routing tooling; mixed 0.x/1.x/3.x/6.x graph. Update parents only. |
| picomatch | 2 | Build/test/watch tooling; mixed 2.x/4.x graph. Update parents only. |

## Docker and runtime proof

The host-side copied-volume rehearsal and apply completed successfully:

- Applied database: PostgreSQL 17.10 on Debian/aarch64.
- Database fingerprint before/after:
  `d587fd70e7f474c1ac9f91679c647fc1c39e941f790b3c253be93100e80d2364`.
- GraphQL fingerprint before/after:
  `be4c24ce536627e0c37a03f3de51b2e97f3cb1351c3881be9219112ffdb5e412`.
- The script reported `Local PostgreSQL 17.10 upgrade and GraphQL equivalence: PASS`.
- A separate port-level check confirmed live PostgreSQL 17.10, Hasura 2.43.0, and a healthy
  `/healthz` response after the apply.

## Final install and audit proof

- `bunx bun@1.3.14 install --frozen-lockfile`: passed; 72 packages installed and the preserved
  multiformats postinstall reported its compatibility patch already present.
- `bunx bun@1.3.14 audit --audit-level=high`: 0 critical / 29 transitive high.
- There are no direct critical or high advisories. Every residual high has a parent chain,
  reachability assessment, and remediation owner above.
- A repeat Envio install verification previously encountered registry-wide HTTP 5xx behavior after
  successful codegen/build. The final root frozen install proves the checked-in graph resolves and
  installs normally.
