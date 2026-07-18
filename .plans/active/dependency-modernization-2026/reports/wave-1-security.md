# Wave 1 Security

Captured on 2026-07-16 after the Wave 0 checkpoint `5ebabc77c`.

## Changes

- Exact Vitest family `4.1.10` across root, agent, and shared browser tooling.
- Exact Vite `7.3.6` and `@vitejs/plugin-react` `5.2.0` across root, client, and admin.
- Exact Hono `4.12.30`, React Router DOM `7.18.1`, and GraphQL `16.14.2`.
- Narrow compatible overrides: `basic-ftp` `5.3.1`, Hono `4.12.30`, `shell-quote`
  `1.10.0`, and `websocket-driver` `0.7.5`.
- Hono's tightened route-param type required one internal, runtime-neutral annotation on the funding
  receipt handler so the guaranteed `:id` route is preserved through its helper boundary.

All targets were verified in the npm registry and admitted by the existing three-day release-age
gate. No registry, git dependency, trusted dependency, engine, or lifecycle-script policy changed.

## Security result

`bun audit --audit-level=high` improved from **5 critical / 81 high** to
**0 critical / 64 high**. The named Vitest, Vite, Hono, React Router, GraphQL,
`shell-quote`, `websocket-driver`, and `basic-ftp` target findings are absent. There are no direct
high findings in the upgraded families.

Remaining highs are transitive and owned by later admitted or excluded parents:

- Wave 2 tooling/docs/PWA parents: Docusaurus, local search, Lighthouse/LHCI, Storybook, MSW,
  Workbox, PM2, Mocha/c8, and their Rollup/minimatch/undici/path routing chains.
- Wave 5 web3/observability parents: Reown, Wagmi 2, Thirdweb, Sentry, and PostHog chains including
  socket.io-parser, form-data, h3, defu, axios, lodash, and ws.
- Wave 6 compatible EAS/Envio parents and the dedicated CCIP/OpenZeppelin plans own the protocol
  copies of undici, minimatch, tmp, lodash, fast-uri, immutable, and OpenZeppelin 4 advisories.
- Wave 9 Transformers owns the Xenova protobufjs chain.

## Validation

| Proof | Result |
|---|---|
| `bun install --frozen-lockfile` | PASS |
| Agent tests | PASS: 20 files, 230 tests |
| Agent typecheck | PASS after the route-context type annotation |
| Funding public API regression | PASS: 43 tests |
| Shared tests | PASS: 285 files, 3,355 passed, 1 skipped |
| Shared typecheck | PASS |
| Client tests/build/PWA precache | PASS: 81 files, 637 tests; Vite 7.3.6 production build |
| Admin tests/build | PASS: 74 files, 538 tests; Vite 7.3.6 production build |
| `node scripts/dev/ci-local.js --quick` | PASS |
| Authenticated Brave route QA | WAIVED by Afo on 2026-07-16; automated route tests, production builds, PWA proof, and Repo Quick Gate are the accepted substitutes |

## Proof override

The Codex browser extension connection failed twice and repo policy prohibited substituting an
isolated browser. Afo explicitly waived the mandatory Brave check on 2026-07-16 and accepted the
green automated route, build, PWA, and Quick Gate evidence for this dependency program. Wave 1 may
be checkpointed without browser proof; the proof limitation remains visible in final certification.
