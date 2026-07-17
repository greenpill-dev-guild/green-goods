# Wave 11 — Final Certification Runbook

**Branch**: `chore/dependency-upgrades`
**Status**: prepared; run only after Waves 6-9 are checkpointed and Wave 10 is recorded as held

## Entry conditions

- The working tree contains only the intended modernization program changes.
- Every implemented wave has an independently revertible conventional checkpoint commit.
- Wave 6 has a supplied corrected audit and a green PostgreSQL 17.10 copied-volume/apply proof.
- Wave 7, Wave 8, and Wave 9 have green frozen-install, targeted behavioral, package build, and
  security evidence.
- Wave 10 is recorded as `held_supported_adapter_unavailable`; Wagmi 2 and the compatibility shim
  remain intact.
- No deployment, broadcast, production write, or hosted-indexer cutover is part of certification.

## Certification order

Run with exact Bun 1.3.14 and stop at the first failed mandatory gate.

1. Supply chain and lock integrity
   - `bun install --frozen-lockfile`
   - `bun pm untrusted`; compare to the approved blocked-script baseline
   - `bun audit --audit-level=high`
   - `bun outdated`; record only, do not silently substitute newer targets
   - confirm registries, git dependencies, engines, overrides, and `trustedDependencies`
2. Static and source quality
   - `bun run format:check`
   - `bun lint`
   - `node scripts/quality/check-codex-docs.js`
   - `bash scripts/quality/check-test-quality.sh`
3. Full behavior and deterministic builds
   - `bun run test`
   - `VITE_CHAIN_ID=11155111 bun run build`
   - `bun run build:agent`
   - `bun run build:docs`
4. Conditional contract and indexer proof
   - contract build and tests through package Bun scripts; never raw Forge
   - `bun run indexer:check-boundary`
   - indexer codegen, test, and build
   - confirm ABI, storage, schema, deployment, indexer-config, handler, and GraphQL shapes are
     unchanged
5. Design, Storybook, and PWA proof
   - `bun run check:design-md`
   - `bun run check:design-generated`
   - `bun run check:design-tokens`
   - `bun run lint:vocab`
   - `bun run --filter @green-goods/shared check:stories`
   - `bun run --filter @green-goods/shared check:story-quality`
   - static Storybook build and generated service-worker/precache budget
6. Runtime smoke
   - `bun run dev`, then `bun run dev:smoke:full`
   - stop the local stack cleanly
   - `bun run dev:prod`, then read-only `bun run dev:prod:smoke`
   - stop the production-backed local stack cleanly
7. Evidence closure
   - rerun `node scripts/harness/plan-hub.mjs validate`
   - record exact test counts, build outputs, audit counts, runtime versions, and residual advisory
     ownership
   - remove overrides only when the final lock proves they are unnecessary
   - verify no generated or runtime artifact drift remains

## Acceptance matrix

| Contract | Required proof |
|---|---|
| Security | Zero critical and zero direct high advisories; every transitive high has parent chain, reachability, and remediation owner |
| Install | Exact Bun 1.3.14 frozen install; no new trusted lifecycle script, registry, or git dependency |
| Application state | Query keys, persisted caches/stores, hydration, offline restore, paused mutations, forms, auth, and machine contracts pass |
| UI/PWA | Routing, dialogs/focus, keyboard behavior, shared layout, service-worker install, update, and offline reload pass automated proof |
| Web3 | Wallet restore, chain switching, simulation, signing, passkeys, and local-Anvil writes retain public shared contracts |
| Contracts | Build/tests/fork proof with no ABI, storage, schema, deployment, or broadcast change |
| Indexer | PostgreSQL 17.10 health, Envio build/codegen/tests, Docker health, and GraphQL/entity equivalence |
| Agent/docs | Webhook and transcription behavior, docs audit/build/search/Mermaid, and package builds pass |
| Observability | Consent behavior and telemetry redaction pass; no upload or external write is performed |

## Accepted proof limitation

Authenticated Brave proof is explicitly waived for this dependency program. Do not relabel
isolated Playwright, Browser, or DevTools results as authenticated QA. Automated routes, builds,
PWA checks, local smoke, and read-only production-backed smoke are the accepted substitutes, and
the waiver remains visible in final evidence.

## Rollback rule

If advisories increase, a peer/runtime duplicate appears, persisted state changes, a critical
journey regresses, GraphQL fingerprints diverge, or rollback is uncertain, revert the complete
checkpoint that introduced the regression. Do not repair forward across wave boundaries during
certification.
