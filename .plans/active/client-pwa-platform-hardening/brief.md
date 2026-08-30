# Client PWA Platform Hardening

**Slug**: `client-pwa-platform-hardening`
**Stage**: `active`
**Priority**: `p2`
**Created**: `2026-08-30T19:17:02.663Z`

## Problem

The public site and installed PWA currently share a heavy startup graph, Chrome Android's Open App
control replaces native link navigation with script navigation, service-worker update policy
conflicts with the custom prompt, JavaScript needed for cold offline startup is not precached, and
service-worker registration is incorrectly coupled to Background Sync support.

## Desired Outcome

- Chrome Android can capture a real `/home` link and open or focus the installed WebAPK.
- Public pages start without wallet, auth, chain, job-queue, or persisted-query dependencies.
- Updates download passively and activate on the next launch, with a bounded restart escape hatch.
- Signed-in and signed-out `/home` shells cold-load offline after one successful online warm-up.
- Work drafts and queued jobs survive storage pressure; Android shares import into a work draft.
- Existing public content, offline job-queue semantics, Brave guidance, and admin consumers remain compatible.

## Scope Notes

- In scope: client/shared PWA composition, manifest, service worker, storage, Share Target, badging,
  build budgets, tests, and physical-browser acceptance guidance.
- Out of scope: Web Push, video sharing, dependency upgrades, contract/indexer changes, and redesign.

## Success Signal

A production build meets the startup/shell budgets and a physical Android Chrome WebAPK opens from
the public link, cold-loads `/home` offline, and imports shared photos without losing drafts.
