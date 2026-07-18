# Wave 2 Tooling and Docs

Captured on 2026-07-16 after the Wave 1 checkpoint at `b53f288f4`.

## Changes

- Aligned the repository package-manager and CI/runtime pins to Bun `1.3.14`.
- Upgraded Biome to `2.4.15`, Oxlint to `1.66.0`, Playwright to `1.60.0`, MSW to
  `2.14.6`, and Lighthouse to `13.2.0`.
- Aligned the complete Storybook family to exact `10.4.6` releases.
- Aligned Docusaurus and its Faster package to exact `3.10.2` releases and local search to
  `0.55.2`.
- Removed three source-confirmed unused dependencies: admin Radix Slot and Tabs, and agent Faker.
- Removed Oxlint rules that no longer exist in 1.66 while retaining the core `prefer-const` rule.
- Replaced the broad Docusaurus `future.v4: true` switch with explicit flags. Faster remains on,
  while legacy MDX compatibility and the existing storage keys remain preserved.
- Preserved the existing `react-docgen-typescript@2.4.0` patch and the load-bearing
  multiformats/uint8arrays strategy unchanged.

## Behavioral Regression Proof

The upgraded Storybook/Playwright browser gate exposed a native View Transitions edge case:
skipped transitions can reject `ready` and `finished` with `AbortError`, while the admin page
transition component observed only `finished`. A focused regression test first reproduced the
unhandled rejection and missed arrival callback. The implementation now observes all transition
promises, ignores only browser `AbortError`, and still rethrows unexpected failures.

| Proof | Result | Evidence |
|---|---|---|
| RED | PASS | The focused admin test failed because `onNavigateArrive` was not called and a rejected transition produced an unhandled `AbortError`. |
| GREEN | PASS | The focused file passes 19 tests and the Storybook browser suite passes 39 files and 120 tests with no unhandled errors. |

## Security and Supply Chain

- Every target version existed in the public registry and passed the repository's three-day
  release-age gate before installation.
- `bunx bun@1.3.14 install --frozen-lockfile`: **PASS**, with no lockfile change.
- `bunx bun@1.3.14 audit --audit-level=high`: **POLICY PASS**, with 0 critical and 64 transitive
  high findings. The count is unchanged from Wave 1 and there are no direct high findings.
- Docusaurus Faster adds another parent path to existing transitive
  `serialize-javascript`/`fast-uri`/`picomatch` findings but does not increase the advisory count.
- `trustedDependencies` remains unchanged (`esbuild`, `sharp`). The MSW and PostHog CLI lifecycle
  scripts remain blocked rather than being trusted implicitly.

## Validation

| Command or gate | Result | Evidence |
|---|---|---|
| Bun `1.3.14` frozen install | PASS | 3,438 installs and 3,534 packages; no changes. |
| `bun run format:check` | PASS | Repository formatting is clean. |
| `bun lint` | PASS | Zero configured errors under Oxlint 1.66; new advisory warnings remain visible. |
| `node scripts/dev/ci-local.js --quick` | PASS | Shared 3,355 tests, client 637 tests, admin hub 102 tests, and agent 230 tests passed with required typechecks. |
| docs audit, typecheck, and build | PASS | Docusaurus 3.10.2 Faster client/server build completed. |
| Storybook coverage and quality gates | PASS | 197 covered components and 169 story files passed. |
| static Storybook build | PASS | Storybook 10.4.6 built successfully with Vite 7.3.6. |
| Storybook clean-room browser suite | PASS | 39 files and 120 tests passed under Playwright 1.60.0 Chromium. |
| admin focused and full tests | PASS | PageTransition 19 tests and admin 539 tests passed. |
| admin production build | PASS | Vite 7.3.6 built 12,304 modules successfully. |

## Proof Boundary

Afo explicitly waived authenticated Brave proof for this modernization program. The Playwright
Chromium result is clean-room automated evidence only; it is not reported as authenticated Brave
QA. Automated route tests, builds, PWA checks, local smoke, and repository gates are the accepted
substitutes.
