# Wave 0 Baseline

Captured on 2026-07-16 from clean `develop` at
`6b06783965c1118a14c09a9f97ad07ad51daa52f` before any dependency manifest or lockfile change.

## Frozen dependency graph

- Bun runtime: `1.3.10`.
- `bun install --frozen-lockfile`: **PASS**; 3,428 packages resolved and the checked-in lockfile did
  not change.
- `bun outdated --recursive`: **PASS**; the reviewed target versions remain visible. Before each
  wave, exact family versions and peers still need a release-age recheck rather than accepting a
  newer release automatically.
- Lockfile SHA-256:
  `79dc1513a910b3bf8c68982e441df45f623e525b8220a96318b125854dc56177`.
- Manifest SHA-256 values:
  - root: `3a02491b324c1a72c630f4b3af2a6e81b9854c2a36ad34221195e5f61c6becc0`
  - docs: `54fa3134cfe568faa4f517ba486c68f601d31ed58f597fd42bf2970f4b28e7d4`
  - admin: `8d3376ea732b8e255a9b783142aa29b52f8b5accd51fea3ada09ce53c7e6581e`
  - agent: `4062f5deb3a4c72b47ce0b77f9ee5834049f4b4479b2393eadafcd2a43dfc88d`
  - client: `7e3dbc52d854d1f24d0c70c06d9eeebdff7b85dc5568daa56fce2822f1e7d56c`
  - contracts: `51c994a02fd950f65d3ab4af42d63e5d592fb3d7132b694de9b5d28014dd1c57`
  - indexer: `b38a03523e5ebec760f9a8f09f44d77fb26a7b8f1e1bb1c58ec8a8a26fe8329e`
  - shared: `25ca2015f92af56192a7eed5be931f5307da4779f024d87ccbdd2475a5c34cad`

## Security baseline

`bun audit --audit-level=high`: **FAIL**, with 86 findings: 5 critical and 81 high.

The critical baseline includes direct Vitest-family exposure and transitive
`websocket-driver`/`shell-quote` findings through Docusaurus. Direct high findings include the
current Vite, Hono, and React Router versions. Other high transitives include `basic-ftp`,
`undici`, `minimatch`, `form-data`, `tmp`, `flatted`, `rollup`, `systeminformation`, `h3`,
`lodash`, `defu`, `axios`, `protobufjs`, and `ws`. Wave 1 must remove its named advisories without
increasing this baseline; later parent upgrades own the remaining reachable transitives.

## Review-readiness evidence

| Command | Result | Evidence |
|---|---|---|
| `bun format:check` | PASS | Plan hub JSON was formatted, then the full check passed. |
| `bun lint` | PASS | Zero Oxlint and Solhint errors; existing warnings remain. |
| `bun run test` | PASS | The complete suite passed outside the Codex sandbox; Foundry passed 63 suites and 1,533 tests, and every Bun workspace exited 0. |
| sandbox root-cause probe | PASS | A sequential sandbox run reproduced Foundry's macOS system-configuration abort while the same suite passed outside the sandbox, proving the earlier exit 134 was environmental. |
| isolated client test | PASS | 81 files and 637 tests passed during diagnosis, confirming the client suite itself was not failing. |
| `VITE_CHAIN_ID=11155111 bun run build` | PASS | Contracts, shared, indexer, client/PWA, and admin built successfully. |
| `bun run build:agent` | PASS | Agent TypeScript build passed. |
| `bun run build:docs` | PASS | Docusaurus client/server build passed. |
| `node scripts/harness/plan-hub.mjs validate` | PASS | All 24 feature hubs validated. |

The original sandboxed root test abort came from Foundry's macOS system proxy/configuration lookup
attempting to create a null dynamic-store object. The required unrestricted rerun passed without a
repository change, so Wave 0 has a clean functional baseline and can be checkpointed.

## Governance override

`node scripts/harness/plan-hub.mjs linear-sync --feature dependency-modernization-2026 --json`
produced the correct parent-only creation preview, but this Codex environment exposes neither the
Linear connector nor `LINEAR_API_KEY`. On 2026-07-16, Afo explicitly authorized implementation to
continue with Linear deferred for later backfill. The feature hub remains execution truth.
