# Cross-reference — Product Sync 2026-05-13

## Per-surface PostHog signal

**Meta-finding**: across both projects (App `163591` + Admin `262122`), every captured `$exception` event has `exception_type=None` and `message=None`. The events are being captured (29 distinct URLs over 14d) but the actual exception payload is empty. This is a real production observability gap — flag separately. Below uses URL + counts + first_seen as proxy signal in lieu of per-error matching.

### App project (`163591`) — client PWA + public website

| URL | Users (14d) | Sessions | First seen | Last seen | Likely covers items |
|---|---|---|---|---|---|
| `greengoods.app/home/garden` | 3 | 4 | 2026-05-09 02:26 | 2026-05-11 16:52 | (general home — no direct item match) |
| `greengoods.app/cookies?campaign=earth-week-fund` | 2 | 2 | 2026-05-07 16:50 | 2026-05-07 20:05 | **Items 2, 6** (Connect Wallet persistence + balance refresh on cookies) |
| `greengoods.app/login`, `/login?redirectTo=%2Fhome` | 2 + 2 | 2 + 2 | 2026-05-03 / 2026-05-04 | 2026-05-04 / 2026-05-09 | **Items 14-17** (passkey + Google login bugs) |
| `greengoods.app/gardens` | 2 | 2 | 2026-05-07 03:19 | 2026-05-07 16:05 | (gardens listing — no direct item match) |
| `greengoods.app/` | 2 | 2 | 2026-05-06 08:07 | 2026-05-07 16:07 | **Item 1** (cached landing page redirect) |
| 16 dev `localhost:3001/*` rows | — | — | — | — | ignored (local dev) |

### Admin project (`262122`) — admin cockpit

| URL | Users (14d) | Sessions | First seen | Last seen | Likely covers items |
|---|---|---|---|---|---|
| `admin.greengoods.app/` | 3 | 3 | 2026-05-11 09:57 PDT | **2026-05-13 10:55 PDT** | **Items 18-22** (admin freeze + responsive — landed during the sync) |
| `admin.greengoods.app/hub/work?gardenAddress=0xe1Da...` | 1 | 1 | 2026-05-13 10:59 PDT | 2026-05-13 10:59 PDT | (hub work queue — adjacent to item 18) |
| `admin.greengoods.app/garden/overview` | 1 | 1 | 2026-05-13 23:28 PDT | 2026-05-13 23:28 PDT | **Item 23** (media uploader/overview) |
| `admin.greengoods.app/garden` | 1 | 1 | 2026-05-13 10:57 PDT | 2026-05-13 10:57 PDT | **Items 18-20** (garden switch issues) |
| `admin.greengoods.app/community/payouts?gardenAddress=0x3f0f...` | 1 | 1 | 2026-05-13 16:08 PDT | 2026-05-13 16:09 PDT | (payouts route — not in current extraction) |

Five admin URLs cluster within the sync window (10:55-10:59 PDT). Strong corroboration of the reported admin dashboard bugs (18-22).

## Linear scan — existing `protocol:green-goods` records on Product team

| State | Count | Bug-related? |
|---|---|---|
| Backlog | 13 | All grant/funding records (PRD-484, 487-491, 494, etc.) — none match our bug items |
| Todo | 37 | Mostly grant + planned-work items (PRD-446-449, 481, 480, 479, etc.). **PRD-447 "scope: Client PWA gardener audit"** (`activity:qa`) is conceptually adjacent but doesn't cover any specific item |

**Result**: all 26 extracted items are `new` per the dedupe scan. No duplicates, no related-link candidates beyond the loose PRD-447 affinity.

## QA Sheet — Defects + Test-tab scan

- **Defects tab**: 0 existing rows (header-only after this morning's bootstrap). Nothing to dedupe against. All 26 items would be net-new appends.
- **Test tabs**: all `Result` columns blank. **0 derived `[derived:test-fail]` candidates** (no rows where `Result == Fail` and `Defect Link` empty).

## Derived candidates from related areas

| Source | Result | Why |
|---|---|---|
| `quality.top-failures` (App, 7d) | 0 net-new | Top URLs by affected_users already mapped to existing items 1, 2, 6, 14-17 via URL match. No standalone derived candidate worth adding. |
| `quality.top-failures` (Admin, 7d) | 0 net-new | Same — all admin error URLs map back to items 18-23. |
| `errors.recurring` (≥50 sessions / 30d) | 0 candidates | No error hash crosses the threshold; the dataset is too small (most prod URLs sit at 1-3 sessions). The recurring-pattern aggregation is not triggered for this batch. |
| QA-sheet failed-test scan | 0 candidates | Test tabs empty |

## Vercel deploy correlation

**Deferred for this batch**. Items 1-26 are interactively-extracted from the QA session itself (not telemetry-anchored). PostHog exception metadata is null, so per-item `first_seen` lookup doesn't anchor to a specific bug — it anchors to "the day Caue tested the dashboard". Per-item Vercel deploy correlation would attach the same recent prod-deploy SHA to every admin item, which adds no signal.

When the exception-instrumentation gap is fixed (separate item — see Meta-findings below), the per-item Vercel correlation becomes valuable. For now, leaving the Deploy-correlation block off all 26 items.

## Per-item disposition (proposed)

| # | Type | Surface | PostHog signal | Linear scan | Tracker scan | Proposed | Priority |
|---|---|---|---|---|---|---|---|
| 1 | bug | Public Website | weak (root URL, 2 sessions) | new | not present | Issue + Need, `package:client` | P1 |
| 2 | bug | Public Website (cookies) | weak (`/cookies` URL, 2 sessions) | new | not present | **Issue + Need, `package:client`** | **P0** (blocks all wallet txns) |
| 3 | feedback | Public Website | no | new | not present | Need only | P2 |
| 4 | feedback | Public Website (`/fund`) | no | new | not present | Need only | P2 |
| 5 | feedback | Public Website (`/fund` endow) | no | new | not present | Need only | P2 |
| 6 | bug | Public Website (`/cookies`) | weak | new | not present | Issue + Need, `package:client` | P2 |
| 7 | bug | PWA Android | no (UA isn't captured) | new | not present | Issue + Need, `package:client` | P1 |
| 8 | bug | PWA Android | no | new | not present | Issue + Need, `package:shared` | P1 |
| 9 | bug | PWA (cross) | no | new | not present | Issue + Need, `package:client` | P2 |
| 10 | bug | PWA Android | no | new | not present | Issue + Need, `package:client` | P1 |
| 11 | bug | PWA Android | no | new | not present | Issue + Need, `package:client` | P1 |
| 12 | idea | PWA | no | new | not present | Need only | P3 |
| 13 | bug | PWA (client) | no | new | not present | Issue + Need, `package:client` | P2 |
| 14 | bug | Cross Surface (auth) | weak (`/login` URLs, 4 sessions) | new | not present | Issue + Need, `package:shared` | P1 |
| 15 | feedback | Cross Surface (auth) | no | new | not present | Need only (architectural) | P1 strategic |
| 16 | bug | PWA (auth) | weak (login URLs) | new | not present | Issue + Need, `package:shared` | P1 |
| 17 | bug | PWA (auth) | no | new | not present | Issue + Need, `package:shared` | P1 |
| 18 | bug | Admin Dashboard | medium (root + garden 3 sessions, in-window) | new | not present | **Issue + Need, `package:admin`** | **P0** (blocks operator work) |
| 19 | bug | Admin Dashboard | weak | new | not present | Issue + Need, `package:admin` | P1 |
| 20 | bug | Admin Dashboard | weak (garden URL) | new | not present | Issue + Need, `package:admin` | P1 |
| 21 | bug | Admin Dashboard | no | new | not present | Issue + Need, `package:admin` | P2 |
| 22 | bug | Admin Dashboard | no | new | not present | Issue + Need, `package:admin` | P2 |
| 23 | bug | Admin Dashboard | weak (`garden/overview`) | new | not present | Issue + Need, `package:admin` | P1 |
| 24 | bug | Admin Dashboard | no | new | not present | Issue + Need, `package:admin` | P1 |
| 25 | bug | Admin Dashboard | no | new | not present | Issue + Need, `package:indexer`+`package:admin` | P1 |
| 26 | bug | Admin Dashboard | no | new | not present | Need only (clarification, may be docs) | P3 |

## Meta-findings (separate items worth filing)

- **M1 [bug, observability]**: PostHog `$exception` events are captured but `exception_type` and `message` properties are empty across BOTH App and Admin projects. The error tracking system has events but no diagnostics. Surface: cross-package (`package:shared` or `package:client`). Affects: bug-intake routine, qa-triage-pulse routine, and any future `/debug` PostHog enrichment. Severity P1.
