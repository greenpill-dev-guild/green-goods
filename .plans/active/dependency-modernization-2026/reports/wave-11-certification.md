# Wave 11 — Final Certification

**Branch**: `chore/dependency-upgrades`
**Status**: implementation and automated certification green; host audit passed; runtime reinstall proof pending
**Certified**: 2026-07-18

## Outcome

All approved dependency waves are implemented and automated-green. Wave 10 remains intentionally
held because Reown has not published explicit Wagmi 3 support. No public Green Goods API, shared
hook export, query key, persisted format, auth contract, transaction lifecycle, GraphQL response,
ABI, storage layout, EAS schema, deployment artifact, broadcast, or hosted indexer was changed.

Certification found one real clean-install defect: Envio-generated runtime code imports ReScript,
but the workspace had relied on incidental hoisting from Envio's nested dependency. The RED fresh
install failed with `Cannot find module rescript/lib/js/js_json.js`. Promoting the already-resolved
exact ReScript 11.1.3 runtime into `packages/indexer` fixed the defect without introducing a new
package version. The regenerated lock then passed frozen install, Envio codegen, 186 indexer tests,
the indexer TypeScript build, and the 10-contract/2-network boundary check.

## Supply chain and lock integrity

| Check | Result |
|---|---|
| Exact runtime | Bun 1.3.14 (`0d9b296a`) |
| Frozen install | Pass in a clean mirror after the ReScript repair |
| Lock reproducibility | Workspace and certified-mirror `bun.lock` SHA-1 both `903789d580ab526c50e9ed0464c6e13a38a2a924` |
| Lifecycle scripts | Only the known blocked `@posthog/cli@0.7.11` and `msw@2.14.6` scripts; neither was trusted |
| Trusted dependencies | Unchanged: `esbuild`, `sharp` |
| Git dependencies | No addition; the existing Chainlink-transitive pinned `matter-labs/era-contracts#446d391` entries are unchanged from `HEAD` |
| Outdated snapshot | Completed under the three-day release-age gate; newer releases were recorded, not silently substituted |
| Audit | Host Bun 1.3.14 proof passed at 0 critical / 29 transitive high findings, unchanged from the Wave 6 baseline |

The supplied current-lock host audit is authoritative: it remains at 0 critical and 29 transitive
high findings, with no count regression from Wave 6. The new Transformers parent path to
`adm-zip@0.5.18` is confined to ONNX Runtime's package-install ZIP extraction script; Green Goods
does not pass uploaded or user-controlled ZIPs to that code. `adm-zip@0.6.0` is outside ONNX's
declared `^0.5.16` range, so forcing it would be a behavior-changing pre-1.0 override.

The residual findings cannot be safely collapsed with Bun overrides. Bun only supports top-level
overrides, while the lock intentionally contains incompatible majors of `minimatch`, `undici`,
`ws`, `path-to-regexp`, and `picomatch`. The remediation assignments are:

| Finding family | Affected path / reachability | Safe disposition |
|---|---|---|
| OpenZeppelin 4.7.3 | Chainlink CCIP contract-development dependency; Green Goods' direct upgradeable package is 4.9.6 | Keep in the dedicated CCIP 2 / OpenZeppelin 5 protocol plan; no global contract override |
| `adm-zip` 0.4.16 / 0.5.18 | Hardhat development tooling plus ONNX Runtime's install-time binary extraction; no Green Goods user ZIP path | EAS/Hypercert/ONNX parent remediation; do not force pre-1.0 `0.6.0` outside parent ranges |
| `minimatch`, `serialize-javascript`, `tmp`, `path-to-regexp`, `picomatch` | Mixed legacy build, docs, test, PWA, and contract-tooling parents; safe majors already coexist in the lock | Upgrade the owning parents as compatible releases land; a top-level override would downgrade or cross-major other consumers |
| `undici`, `ws` | Multiple SDK, tooling, and WebSocket-client copies; safe copies already coexist with affected copies | Track parent releases and preserve HTTP/default wallet paths; do not collapse incompatible networking majors globally |

## Static, test, and build evidence

- Biome checked 1,958 files with no formatting changes.
- Oxlint passed. Forge formatting passed. Solhint reported 0 errors and the existing 164 warnings.
- Codex-doc drift, test-quality, DesignMD, generated design, token, and vocabulary checks passed.
- The full `agentic:check` front door passed, including local Modern Web Guidance retrieval and the
  authenticated-browser verification policy guard.
- Story coverage passed for 197/197 stories; story quality passed for 169 files.
- `bun run test` passed 6,515 tests with two governed skips:
  - contracts: 1,533
  - shared: 3,357
  - client: 640
  - admin: 539
  - agent: 232 plus the opt-in live model test skipped by default
  - indexer: 186
  - docs: 28
- `VITE_CHAIN_ID=11155111 bun run build` passed contracts, indexer, client, and admin in dependency
  order. The client PWA generated a 21-entry, 0.44 MiB precache.
- Standalone agent and docs builds passed.
- Storybook 10.4.6 built successfully under Vite 8.1.4 and copied its static assets.
- Envio 2.32.12 codegen, generated ReScript build, tests, TypeScript build, supply-chain policy, and
  indexing-boundary proof passed under Node 22.
- Contract build/tests passed with no ABI, storage, schema, deployment, or broadcast changes.
- The repaired `verify:contracts:fast` production front door passed full compilation, Forge format,
  Solhint, and all 1,533 contract tests. Its incorrect repository-root calculation is protected by
  a new black-box RED/GREEN test.

## Checkpoint policy

Waves 7–11 use one consolidated final checkpoint. Their manifest changes, internal migrations, and
shared final lockfile were certified cumulatively; reconstructing intermediate lockfiles after the
fact would introduce unverified graph states and make rollback less certain. Earlier Waves 0–6 keep
their existing checkpoints.

## Supported majors

- Vite 8/plugin-react 6 and Transformers.js 4 are complete with their internal migrations and
  behavioral regression coverage.
- Wagmi 3 is held exactly as planned. Reown's maintained examples remain on Wagmi 2 and the adapter
  publishes minimum peer ranges rather than an explicit Wagmi 3 compatibility contract. Wagmi 2,
  `multiformats`, `uint8arrays`, and the compatibility shim remain intact.

## External proof limits

These are environment/install restrictions, not observed dependency regressions:

1. The final host audit passed. Codex's own npm/Bun package-download path still receives a proxy
   `blocked-by-allowlist` HTTP 403, including for the exact locked `@rolldown/plugin-babel@0.2.3`
   tarball.
2. The opt-in live Whisper model test reaches the real Hugging Face loading path, but external model
   fetch is unavailable in this sandbox. Mocked PCM/WAV, retry, fallback, Node/Bun import, built
   startup, and production dependency-layout tests pass.
3. The supplied host `dev:prod` run proved docs and Storybook startup, then client/admin failed
   because `@rolldown/plugin-babel` is absent from the current `node_modules`. Root, client, admin,
   and `bun.lock` all exact-pin `0.2.3`; this is stale install state, not a missing manifest or Vite
   migration. Codex cannot perform the repair because package downloads are proxy-blocked and the
   root `.env` remains policy-protected. No untrusted mirror or manual lock edit was used.
4. Authenticated Brave proof was explicitly waived for this program.

## Remaining operator proof

No further source migration is required. From a normal host terminal, repair the stale install and
refresh runtime proof against this exact lock:

```sh
bunx bun@1.3.14 install --frozen-lockfile
bun run dev:prod
# in a second terminal
bun run dev:prod:smoke
```

Do not ship the checkpoint until the frozen install materializes `@rolldown/plugin-babel@0.2.3`
and client/admin remain available during the production-backed smoke.
