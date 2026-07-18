# Dependency Modernization 2026 - QA Pass 2 Handoff

## Lane

- Owner: Codex
- Branch signal: `codex/qa-pass-2/dependency-modernization-2026`
- Status: passed

## Certification result

- A fresh install found accidental reliance on Envio's nested ReScript hoisting.
- Promoting the already-resolved exact ReScript 11.1.3 runtime into `packages/indexer` produced the
  expected RED/GREEN repair without adding a new resolved version.
- Final frozen install, lock integrity, Envio codegen/build/test, 6,515 tests, deterministic builds,
  Storybook/PWA, static quality, and supply-chain policy pass.
- The pre-existing contract verifier path defect is repaired with RED/GREEN black-box coverage;
  the fast production gate passes build, Forge formatting, Solhint, and 1,533 contract tests.
- Waves 7–11 are intentionally one consolidated final checkpoint because they share a cumulative
  certified lockfile; reconstructing intermediate lockfiles would create unverified graph states.

## Current host proof

- Final Bun audit: the supplied Bun 1.3.14 run is 0 critical / 29 transitive high, unchanged from
  Wave 6. Residual chains and remediation owners are recorded in the Wave 11 report.
- Frozen reinstall: supplied host Bun 1.3.14 proof installed 214 packages and materialized the
  exact-declared `@rolldown/plugin-babel@0.2.3` without lock drift.
- Production runtime: client and admin started on Vite 8.1.4; docs and Storybook also became ready.
  The stack reported all four services ready in 5.5 seconds.
- Read-only production smoke: client, admin, docs, Storybook, Arbitrum chain ID and deployed
  bytecode, production agent health, hosted GraphQL, and indexer lag all passed. The hosted indexer
  lag was 40 blocks against a 2,000-block threshold.
- Live Whisper model fetch: external network unavailable; behavioral and runtime-layout proof passes.

## PR CI repair

- Admin CI: the smoke and auth fixtures now share a deterministic Sepolia JSON-RPC mock, removing
  the public Alchemy demo endpoint from role-resolution readiness. Admin TypeScript, the 12-test
  Admin CI discovery pass, and 20 focused DeploymentRegistry/role tests pass.
- Indexer CI: `setup-generated` now uses pnpm's scoped `@envio-dev/*` public-hoist pattern so Envio
  2.32.12's generated CommonJS imports resolve under strict pnpm installs. An isolated fixture proves
  the scoped transitive import without broad hoisting or a new dependency version.
- Cross-package proof: `node scripts/dev/ci-local.js --quick` passes formatting, lint, type checks,
  and 4,331 shared/client/admin/agent tests. The replacement GitHub jobs provide the authoritative
  clean-room browser and generated-indexer proof.

## Closeout

QA Pass 2 is complete and PR #642's two dependency-upgrade CI assumptions are repaired. No mandatory
source, security, install, build, or runtime proof remains for this modernization program. The
opt-in live Whisper model test remains a documented confidence follow-up rather than a known
regression.
