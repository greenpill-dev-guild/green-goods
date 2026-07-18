# Dependency Modernization 2026 - QA Pass 2 Handoff

## Lane

- Owner: Codex
- Branch signal: `codex/qa-pass-2/dependency-modernization-2026`
- Status: automated green; host audit passed; runtime reinstall proof pending

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
- Runtime smoke: the supplied host launch exposed stale `node_modules`; client and admin cannot
  resolve exact-declared `@rolldown/plugin-babel@0.2.3`. Docs and Storybook start successfully.
- Codex cannot fetch the missing exact tarball because its registry proxy returns
  `blocked-by-allowlist` HTTP 403. The root `.env` also remains policy-protected. No untrusted
  registry, manual lock edit, or source fallback was introduced.
- Live Whisper model fetch: external network unavailable; behavioral and runtime-layout proof passes.

## Remaining host commands

```sh
bunx bun@1.3.14 install --frozen-lockfile
bun run dev:prod
# second terminal
bun run dev:prod:smoke
```

No further source migration is required unless the post-install runtime proof exposes a regression.
