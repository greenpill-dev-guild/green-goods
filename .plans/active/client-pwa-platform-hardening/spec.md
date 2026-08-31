# Client PWA Platform Hardening Spec

## Summary

Separate public and installed composition roots, make browser-native installation and service-worker
lifecycle behavior authoritative, and add bounded offline storage, Share Target, badging, and build
graph enforcement without adding dependencies.

## Users

- Primary: gardeners using the installed PWA on Android and offline-capable browsers.
- Secondary: public visitors reading garden and funding pages before installing or connecting a wallet.

## Functional Requirements

1. Open App is a native `/home` anchor backed by verified installation evidence and launch metadata.
2. Public and PWA bootstraps have separate route/provider graphs; public wallet code loads on interaction.
3. One update coordinator downloads passively, activates on next launch, and offers restart after 30 minutes.
4. Service workers register independently of Background Sync and cache the minimum JavaScript shell.
5. Persistent storage and quota cleanup protect work drafts and queued jobs.
6. Android Share Target imports bounded photo/text payloads into work drafts; badging reflects queue/update state.
7. Startup, route, preload, and offline-shell budgets fail the client build when exceeded.

## Research Evidence

- Current production entry closure: 105 files, 5,629 KiB raw, 1,540 KiB gzip, 103 module preloads.
- Current Workbox output: 21 precache entries, 239 KiB, with no JavaScript shell.
- `PublicInstallAction` prevents the anchor default and calls `window.location.assign`, bypassing Chrome's native link-capture path.
- Vite config declares `autoUpdate` while custom UI expects a waiting worker; generated output contains immediate activation behavior.
- `ServiceWorkerManager` currently treats Background Sync support as a prerequisite for registration.
- Existing presentation detection, query persistence, draft storage, quota estimation, job queue, and `generateSW` are the patterns to extend.

## Locked Decisions

- Update policy is next-launch activation; restart is user-triggered only after 30 minutes waiting.
- Share Target v1 feeds the normal work-submission draft and accepts images, not video.
- Public wallet/auth loads only after an explicit wallet interaction.
- Keep `generateSW`; emit a deterministic shell manifest instead of migrating to `injectManifest`.
- Keep current PWA dependencies; functional and dependency changes are not combined.
- The Plan Hub is repository-only unless the user separately approves a Linear mirror.

## Non-Functional Constraints

- Package boundaries: reusable types, hooks, providers, and storage modules live in Shared; composition/build wiring lives in Client.
- Performance: public <=450 KiB gzip, PWA `/home` <=1.25 MiB gzip, HTML module preloads <=16,
  major routes <=500 KiB incremental, proof/media <=850 KiB, shell <=5 MiB raw/1.5 MiB gzip.
- Security: treat share payloads as untrusted; enforce type, count, byte, text, URL, TTL, and consume-once rules.
- Offline: never evict drafts, queued jobs, auth state, or live share payloads; preserve foreground retry fallback.
- Localization: every new visible status or error is present in English, Spanish, and Portuguese.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Shared state/APIs | `state_api` | install evidence, update provider, capabilities, storage, share envelope |
| Client UI/build | `ui` | native anchor, bootstraps/routes, manifest/SW, badge wiring, budgets |
| Contracts | `contracts` | Not applicable |
| QA | `qa_pass_1`, `qa_pass_2` | Authenticated Brave plus physical Android proof |

## Risks

- Existing unrelated `AppShell.tsx` work overlaps badge placement; preserve and compose around that diff.
- An omitted runtime-mounted dependency will break cold offline launch; graph and offline tests must prove both auth states.
- Physical WebAPK capture, Share Target registration, and launcher badges cannot be certified by jsdom or an isolated browser.
