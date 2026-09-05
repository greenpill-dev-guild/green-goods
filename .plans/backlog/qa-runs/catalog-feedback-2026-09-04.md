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
C14 PWA-IOS-008 — incoherent scenario; the PWA-IOS/PWA-AND/PWA-ROLE ID scheme reads oddly (Afo).
C15 Principle (Afo, PWA-036 note): isolate actions from viewing — split reading from writing across the PWA rows.
C16 N/A was recorded as "skipped" on PWA-032/033/034/046–050 and PWA-IOS-002; app copy should say what N/A means (qa.md § Verdict vocabulary).

From reading all 142 active rows (2026-09-05):
C17 Expectations that encode current bugs ("currently silent", "currently a silent no-op", "currently opens the wallet modal"): PWA-038, ADM-020, ADM-026, ADM-028, PUB-003, PUB-020, PUB-024. Expected results must state the intended behaviour only.
C18 Grouped admin transaction rows, all still never walked: ADM-020, 021, 022, 023, 025, 027, 028, 029. Split by act like the PWA rows.
C19 Areas: 33 areas for 53 PWA cases and 33 for 46 admin cases; five PWA areas hold one case. Re-cut to where the walker sits (Home, Garden, Work, Commitments, Wallet, Profile, Auth/Install/Update, Offline) — after Tuesday.
C20 Missing read-only PWA rows: garden detail, Insights/assessments list, members, commitments list/drawer, notifications on the desktop shell.
