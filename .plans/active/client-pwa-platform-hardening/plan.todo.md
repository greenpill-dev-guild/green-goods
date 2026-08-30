# Client PWA Platform Hardening Plan

**Feature Slug**: `client-pwa-platform-hardening`
**Stage**: `active`
**Status**: `ACTIVE`
**Created**: `2026-08-30T19:17:02.663Z`
**Last Updated**: `2026-08-30T21:14:30Z`

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Use real link navigation for Open App | Chrome can capture trusted link navigation; scripted location replacement remains a browser navigation. |
| 2 | Select one bootstrap at runtime | Reuses the existing presentation detector without deployment or multi-HTML rewrites. |
| 3 | Use prompt lifecycle with passive next-launch activation | Prevents mixed-version clients and reloads during forms, uploads, or transactions. |
| 4 | Keep `generateSW` plus an emitted shell graph | Adds deterministic JS caching without replacing the working Workbox integration. |
| 5 | Preserve user data during quota cleanup | Offline drafts and jobs are authoritative; remote/read caches are reproducible. |
| 6 | Import Android shares into work drafts | Reuses the existing offline-first submission and media validation path. |
| 7 | Defer Web Push and dependency upgrades | Neither is required for launch, offline, update, share, or badge correctness. |

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| Native Android launch and verified installation | `ui`, `state_api` | Slice 1 | implemented; physical-device proof pending |
| Separate public/PWA graphs and leaf exports | `ui`, `state_api` | Slice 2 | complete |
| Startup and route budgets | `ui` | Slice 2 | complete |
| Unified registration and update lifecycle | `ui`, `state_api` | Slice 3 | complete |
| Offline JS shell and storage retention | `ui`, `state_api` | Slice 4 | implemented; physical-device proof pending |
| Share Target and badging | `ui`, `state_api` | Slice 5 | implemented; physical-device proof pending |
| Web Push deferred | `state_api` | Slice 5 | complete |
| Contract changes | `contracts` | Not applicable | complete |

## Implementation Slices

1. Add RED tests, installation evidence, manifest relationship/launch metadata, asset links, and native anchor behavior.
2. Add presentation-specific bootstraps/routes/providers, public interaction-lazy wallet islands,
   leaf imports, build graph metrics, and hard startup budgets.
3. Add the singleton update provider, stable scoped registration, legacy cleanup, prompt lifecycle,
   and independent service-worker/Background Sync capabilities.
4. Emit/cache the PWA shell graph, add hashed-script cache fallback, request persistence after
   meaningful writes, and enforce quota-aware re-fetchable-cache eviction.
5. Add Share Target ingestion/import/expiry, queue/update badging, i18n, and end-to-end regression tests.

## TDD / Proof Order

- [x] Run existing launch/update tests to establish the baseline.
- [x] Add focused regression tests for every implementation slice.
- [x] Implement Shared boundaries before Client consumers.
- [x] Run focused GREEN checks for the Client and Shared PWA surfaces.
- [ ] Complete the repository-wide selected gates and physical-device proof. The shared checkout's
  unrelated address-typing work and the WalletConnect/`uint8arrays` resolver failure currently
  block the full Client typecheck/test gate; Android/WebAPK proof requires a physical device.

## Validation

- [x] Targeted Shared and Client Vitest suites (44 Shared + 101 Client assertions)
- [ ] Shared typecheck and Client production build (Shared and direct Vite production build pass;
  Client `tsc -b` is blocked by concurrent address-typing changes)
- [x] PWA precache/startup budget checks and generated-worker invariants
- [ ] `bun run agentic:check` and selector-required frontend checks (`agentic:check` reaches the
  unrelated stale generated client token audit; vocab, tokens, ontology, stories, and story quality
  pass independently)
- [ ] Repo Quick Gate for Shared public exports/provider contracts
- [x] Authenticated Brave QA for public/PWA routes and deferred wallet surface
- [ ] Physical Android Chrome/WebAPK install, launch capture, Share Target, badge, cold-offline, and
  two-version lifecycle proof

## Implementation Checkpoint

- Production budgets: public `0.24 MiB` gzip; installed `1.19 MiB` gzip; `10` module preloads;
  offline shell `4.88 MiB` raw / `1.29 MiB` gzip.
- Offline shell: `116` deterministic assets (`114` JavaScript, `1` CSS, and `index.html`).
- Generated worker: no `clients.claim()`; the only `skipWaiting()` is inside the explicit
  `SKIP_WAITING` message handler.
- Authenticated Brave: the public shell, installed `/home` shell, and interaction-deferred funding
  wallet surface render; local indexer/analytics failures degrade without breaking navigation.
