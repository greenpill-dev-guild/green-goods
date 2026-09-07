## Catalog feedback · QA session 2026-09-04 (never Linear; feeds the pre-Tuesday catalog split)

From tester notes:
C1  PWA-020 — wording says "desktop shell"; it is the PWA/the app. Rename.
C2  PWA-021 — combines open join, request-to-join + withdraw, steward welcome/decline, resubmit. Split by actor and act.
C3  PWA-023 — "deep links" undefined. Rewrite with concrete URLs: /home/:id/work/:workId, /home/:id/commitments/:commitmentId, /home/:id/assessments/:assessmentId.
C4  PWA-025 — locale quality is too broad for a human sweep; candidate for an automated/AI-driven check, keep a narrow human spot-check.
C5  PWA-035 — desktop review belongs to the admin dashboard; move (ADM) or retire.
C6  PWA-036 — governance drawer: split reading (drawer visibility, current stake) from writing (allocate).
C7  PWA-037 — endowment drawer: one case per action (deposit, withdraw own deposit, jar claim).
C8  PWA-038 — profile: split into avatar edit/remove (+draft recovery), theme + language, ENS claim/release, badges, logout.
C9  PWA-042 — keyboard/focus smoke does not fit a mobile PWA; rescope to the desktop shell or retire.
C10 PWA-043 — mixes local dev and hosted production; performance belongs to PostHog benchmarks. Split or retire the human row.
C11 PWA-044 — identity parity spans three surfaces; one row per surface instead.
C12 PWA-IOS-003/004/005 — no Android twins; add PWA-AND rows for login recovery, camera capture/draft, HEIC/library image.
C13 PWA-IOS-006 — expectation assumes a queue "flushes once"; rewrite to the real offline-queue behaviour.
C14 PWA-IOS-008 — incoherent scenario; the PWA-IOS/PWA-AND/PWA-ROLE ID scheme reads oddly.
C15 Principle (from a PWA-036 note): isolate actions from viewing — split reading from writing across the PWA rows.
C16 N/A is being used to mean "skipped this pass"; the app's N/A control should say what N/A means (qa.md § Verdict vocabulary), and a skipped case should simply have no entry.

From reading all 142 active rows (2026-09-05):
C17 Expectations that encode current bugs ("currently silent", "currently a silent no-op", "currently opens the wallet modal"): PWA-038, ADM-020, ADM-026, ADM-028, PUB-003, PUB-020, PUB-024. Expected results must state the intended behaviour only.
C18 Grouped admin transaction rows, all still never walked: ADM-020, 021, 022, 023, 025, 027, 028, 029. Split by act like the PWA rows.
C19 Areas: 33 areas for 53 PWA cases and 33 for 46 admin cases; five PWA areas hold one case. Re-cut to where the walker sits (Home, Garden, Work, Commitments, Wallet, Profile, Auth/Install/Update, Offline) — after Tuesday.
C20 Missing read-only PWA rows: garden detail, Insights/assessments list, members, commitments list/drawer, notifications on the desktop shell.
C21 No admin case covers submitting an assessment outside the journey relay: ADM-005 tests gating only and ADM-037 is the relay's starting assessment. Add a P0 transaction row for assessment submission (found via the admin evidence page, item 8, 2026-09-05).

## Disposition (2026-09-07, pre-Tuesday split on `feature/qa-runs`)

| Item | Disposition |
|---|---|
| C1 PWA-020 | Reworded in place: "Wallet login in the app…" |
| C2 PWA-021 | Retired → PWA-051 (join open), PWA-052 (request + withdraw), PWA-053 (steward welcome/decline), PWA-054 (resubmit) |
| C3 PWA-023 | Steps rewritten with the three concrete deep links |
| C4 PWA-025 | Narrowed in place to a pt/es spot-check of Home, one garden, Profile; the sweep belongs to an automated locale check |
| C5 PWA-035 | Retired → ADM-012 (desktop review lives in the admin) |
| C6 PWA-036 | Retired → PWA-055 (drawer visibility + stake), PWA-056 (allocate) |
| C7 PWA-037 | Retired → PWA-057 (deposit), PWA-058 (withdraw own deposit), PWA-059 (in-drawer jar claim) |
| C8 PWA-038 | Retired → PWA-060 (avatar + draft recovery), PWA-061 (theme + language), PWA-062 (ENS), PWA-063 (badges), PWA-064 (logout) |
| C9 PWA-042 | Rescoped in place to the desktop shell with a keyboard precondition |
| C10 PWA-043 | Retired → PWA-065 (hosted cold start only; local timings leave the catalog) |
| C11 PWA-044 | Retired → PWA-066 (PWA), PUB-034 (website), ADM-047 (admin) |
| C12 PWA-IOS-003/004/005 | Twins added: PWA-AND-006 (login recovery), PWA-AND-007 (capture + draft), PWA-AND-008 (gallery); PWA-AND-003 retired into 007/008 |
| C13 PWA-IOS-006 | Expectation rewritten to the real job-queue behaviour (pending while offline, submitted once with backed-off retries, clientWorkId dedupe, failed state); PWA-AND-004 matched |
| C14 PWA-IOS-008 | Scenario reworded in place; the prefix scheme itself waits for the re-cut |
| C15 principle | Applied through the splits above and the second pass below |
| C16 N/A meaning | QA app N/A control now says "out of scope for this run" (page lane) |
| C17 bug-encoding expectations | ADM-020, ADM-026 (+ locales), ADM-028, PUB-003, PUB-020, PUB-024 restated as intended behaviour; PWA-038 retired |
| C18 admin grouped tx rows | Deferred to the post-Tuesday re-cut |
| C19 areas | Deferred to the post-Tuesday re-cut; the second pass files its new rows under the target names (Garden, Home, Wallet, My Work, Work Submission, Commitments) |
| C20 missing read-only PWA rows | Second pass: PWA-097 (garden header + Work tab), PWA-098 (Insights), PWA-099 (Gardeners), PWA-100 (Pool tab), PWA-101 (commitment detail), PWA-102 (Commitments drawer); notifications on the garden page = PWA-094 |
| C21 assessment submission | Added ADM-046 (P0 transaction) |

## Second pass · PWA half (2026-09-07, `feature/qa-runs-pwa-split`, stacked on `feature/qa-runs`)

A read of the 156 active rows after the first split found seven PWA rows still grouping several
acts (none named in the tester notes) and the C20 gap still open. Split before Tuesday; the admin
rows (C18), the public rows, and the area re-cut (C19) remain post-Tuesday.

| Retired | Successors |
|---|---|
| PWA-027 Home orientation | PWA-067 (pull to refresh online and offline), PWA-068 (scope and sort filters), PWA-069 (arrival toast); the drawer entry points open each drawer's own rows |
| PWA-029 Send tokens | PWA-070 (Balance and Receive, read only), PWA-071 (browse-and-send with Max and a note), PWA-072 (recipient paths: search, paste, ENS, QR), PWA-073 (governance send with the warning confirm) |
| PWA-030 Work dashboard | PWA-074 (drafts resume and delete), PWA-075 (Pending filters and the time filter), PWA-076 (Completed filters) |
| PWA-031 Full work submission | PWA-077 (online wizard), PWA-078 (Submit Again after wallet expiry), PWA-079 (commitment link and Retry Link), PWA-080 (media removal and broken media) |
| PWA-032 Compose a commitment | PWA-081 (place an offer, read-to-end gate), PWA-082 (place a request incl. garden work), PWA-083 (draft dialog) |
| PWA-033 Commitment detail acts | PWA-084 (take up), PWA-085 (ask to take up), PWA-086 (steward accept and decline), PWA-087 (withdraw), PWA-088 (send for confirmation), PWA-089 (confirm), PWA-090 (not yet), PWA-091 (link work), PWA-092 (join the team), PWA-093 (failed act retry or discard) |
| PWA-039 Notifications, ENS toast, AppBar | PWA-094 (steward bell), PWA-095 (ENS reminder), PWA-096 (AppBar badge and auto-hide) |

Acts the grouped rows never named and that now have a row: ask to take up (approval-gated claim),
send for confirmation, join an open team. Still open for the post-Tuesday pass: a work detail read
row on the desktop shell (only the iOS and Android review rows open one today); "Offer It Again"
after a commitment expires; PWA-034 (proof composer) reads as one flow and stays; the
`[iOS]`/`PWA-ROLE` prefix scheme (C14).

