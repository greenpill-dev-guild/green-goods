# QA call mode

Load only for `--call`; apply these deltas alongside the intake and filing phases.

## Call mode (`--call`)

The post-QA-call variant: same phases, three deltas. A run nobody will confirm, such as an agent
closing an automated QA pass, also loads [unattended-report.md](./unattended-report.md): it keeps
this join and clustering, replaces the Phase 4 and Phase 6 gates with conservative rules, and skips
the QA Sheet. One writer per session; the Phase 3b dedupe catches the other's records if both ran.

- **Phases 1-2** — the source is threefold: `bun run qa pull --slug <slug> --run <id>` (the QA
  app's verdicts and notes, exact Test IDs, from the run the call recorded into: the `run-N` id
  in the session header, or in the parent's lede on a rerun; `--run latest-closed` when the run
  was rolled over before this ran), the call's Gemini notes from Drive (title contains "QA" or
  "Build Sync"), and any evidence page a tester linked from a note (a Notion or Drive URL beside
  an issue number, carried into the slice's evidence comment as a link, never re-typed). App
  verdicts recorded **during the call window** are ground truth — a run can hold several
  sessions, so filter joined entries by their `at` timestamps ([§ Session window](#session-window))
  before calling anything verdict-backed; older entries are standing state. For a re-QA also pull
  the run it checks (`bun run qa pull --slug <slug> --run <previous id> --out
  tmp/qa-session/<slug>/previous`) and pass `--previous tmp/qa-session/<slug>/previous/qa-state.json`
  to `qa report`, whose delta then names both runs. `N/A` means out of scope, never skipped
  ([`.claude/context/qa.md § Verdict vocabulary`](../../../context/qa.md)); ask the tester to clear a
  skipped case in the app before the pull; when that cannot happen, pass those IDs to
  `qa report --skipped <ID,ID>` so the generator counts them as not walked and lists them in its
  header, never as covered. Then
  `bun run qa report --slug <slug> --window <start>..<end>` — with `--out <the directory you
  pulled into>` whenever the collision branch below sent the pull to `tmp/qa-session/<slug>-call`,
  so the report reads that pull and not the earlier session's (add `--build client=<sha>,admin=<sha>`
  once Phase 6 has the deploys): the `report.md` written beside that pull is where both results
  blocks of the parent come from — never count by hand. Note items without a Test ID may be
  fuzzy-matched into *proposals* here, because the Phase 4 gate confirms each one with you — an
  unattended run never guesses an ID. If `tmp/qa-session/<slug>/` already holds a pulled
  session (a local close, or an earlier failed run), `qa pull` refuses to overwrite it: pull to a
  fresh directory with `--out tmp/qa-session/<slug>-call` and continue from that path — never
  `--force` over an existing pull, whose severity edits and redactions are sacred.
- **Phase 2b — split, then classify.** A dictated app note is several observations, not one
  finding: on 2026-09-04 one note carried six polish items and the session's only release blocker
  in a single paragraph. Before anything clusters, extract one numbered observation per distinct
  symptom from every app note (the Phase 2 extraction rule, applied to app notes exactly as to
  meeting notes), each tagged with its Test ID, tester, and verdict, and give each observation one
  disposition from [`.claude/context/qa.md § Finding dispositions`](../../../context/qa.md):
  `defect`, `polish`, `decision`, `investigate`, `catalog`, or `environment`. Write the `catalog`
  observations to `tmp/qa-triage/<slug>/catalog-feedback.md` — they feed the next catalog change
  and never reach Linear; at Phase 7 copy the file, de-attributed (no verdicts, no tester names),
  into the plan hub that owns the next catalog change (the hub of the feature whose behavior those
  cases test) before the workspace is removed, so cleanup cannot lose it. A note that says "major regression", "major blocker", or "completely
  broken" proposes Urgent for its cluster; the priority stays derived until the gate confirms.
- **Phases 3-5** — `defect` and `polish` observations cluster into slices: same catalog area +
  same suspected seam, split past 3 Test IDs or a package boundary, ordered by priority. A
  cross-surface cluster whose root cause sits in shared code stays one slice on the shared
  package. The cap is a **Todo queue budget**, default 8; the gate may raise it when the week's fixing
  capacity matches. File every accepted defect and polish cluster, or link its existing tracked
  Issue. After deriving state and priority below, the first N Todo-eligible slices by priority
  propose `Todo`; file every remaining slice as `Backlog`, keeping its derived priority. Record
  the budget and the Todo/Backlog split in the parent's Slices intro and list all slices there;
  the cap never sends a formed slice to `Not sliced`. That section holds note-only follow-ups
  without an exact Test ID and uncorrelated telemetry, alongside investigate and environment
  lines; catalog feedback keeps its separate disposition. Standing fail/blocked entries
  **outside** the window are never slices by default;
  the gate may accept ones that were never filed (no open Issue carries their Test ID), and such a
  slice opens with `Standing since <date>.` and is listed that way in the parent. `decision`
  observations become the parent's `Decisions needed` section plus one child issue
  ([linear-templates.md § Product decisions child](../linear-templates.md)); `investigate`
  observations become `Not sliced · investigate` lines; `environment` observations become one line
  in the parent. Each slice states where its Test IDs can be verified — `local` (dev:prod on a
  laptop), `device` (a case marked `requiresDevice`), or `production` (`requiresProduction`) — so
  the fix loop takes local-verifiable slices first. Payloads use
  [linear-templates.md § QA session report / § QA slice](../linear-templates.md) — one
  `QA session <date>` parent, slices as sub-issues via `parentId`. Before drafting the parent,
  look for an existing one — use the `session:<date>` label to narrow candidates, but require the
  parent shape before reuse: the exact `QA session <date>` title and no `package:*` label (the
  pulse stamps the same label on its pre-staged tracking Issues, and Phase 3b's package-scoped
  scan cannot see the parent at all); an existing parent is reused, never duplicated.
  Verdict-backed slices propose `Todo` + derived priority (P0-case fail → High, P1 → Medium, else
  Low; Urgent when the call flagged it release-blocking, or proposed from a tester's note and
  confirmed at the gate); `polish` slices propose Low (`Todo` when a member entry sits inside the
  window, else `Backlog`); note-only items propose `Backlog`. **Human-filed issues**: list Product Issues created since the window opened,
  whatever their labels (a teammate filing from the call rarely stamps an activity label); propose a
  match per slice by title and surface; the gate confirms each. A confirmed match is linked as
  `already tracked`, and the slice's Test IDs are posted as a comment on that Issue; an unattended
  run's exact-key dedupe reads pipeline comments as well as source lines, so the reverse lookup
  works next time. The Phase 4 scope-lock gate runs once over everything the run proposes, with
  this reply grammar in place of the default prompt's tags: slice numbers, `all`, or `none`; `S3:urgent` /
  `S3:high` / `S3:medium` / `S3:low` to override a priority; `D2:drop` to drop a decision line;
  `I1:slice` to promote an investigate line into a slice; `M2:PRD-849` to confirm a proposed match
  or `M2:none` to reject it; catalog and environment lines are recorded as listed unless the reply
  says `C3:slice` or `E1:slice`. Nothing outside the reply is filed.
- **Phase 6** — write the parent first — Results by priority and Results by kind pasted verbatim
  from `report.md` — then attach the full `report.md` to the parent as a Linear document
  ([linear-templates.md § Full report document](../linear-templates.md), after the privacy grep;
  team display names allowed, nothing else private) and link it from the lede, then the decisions
  child, then the slices. [Window enrichment](#window-enrichment) runs here, with its safe
  summaries in each slice's first comment; Sheet Defects rows are still offered per slice member
  with the usual confirmation (an unattended run never writes the Sheet), and the Sheet rows
  remain the one place replay URLs and session IDs may land, under its existing private exception.

Downstream, fix sessions pull the slices via the `debug` skill's QA Slice Fix Protocol — one
slice = one branch = one PR, posture per [`.claude/context/qa.md § Fix posture`](../../../context/qa.md).

## Session window

A QA run can hold several sessions, so a call's verdicts are the entries whose `at` timestamp falls
inside its session window: the call's start and end from the Gemini notes header, padded 15
minutes before and 60 minutes after, because testers often record late. A rehearsal that morning
or an earlier solo pass is not this call. With no notes, use the slug date's calendar day up to the
run, say so in the report, and weigh that wider window's verdicts with proportionate caution. Only
in-window entries back slices and the results blocks, and the same window bounds the enrichment
queries. Older entries are standing state: at most one context line in the report.

## Window enrichment

The testers were in the product during the window, so its telemetry from that window is
first-party evidence of what they hit. Enrichment never blocks the record: an unavailable or
degraded source becomes one flag line in the run's summary.

1. **Build under test (Vercel).** A beta or local session records the build it ran when the run
   knows it, and otherwise `build: unknown`; it never takes a production SHA. For a production
   session, find for `client` and `admin` every production deploy in state `READY` that was live
   during any part of the window: the one live when it opened, plus any that finished during it. Record one deploy as `surface @ <commit-sha>` in the parent's lede, and
   several as `build: mixed` with every SHA, so no slice is investigated against the wrong release.
   The Blob store holds no build SHA, so this line ties the verdicts to a deployable. Pass the SHAs
   to `qa report --build client=<sha>,admin=<sha>`.
2. **PostHog.** Switch to each surface's project (App `163591` for the PWA and website, Admin
   `262122` for admin; skip docs). First run the degraded-telemetry probe from
   [`sync-triage-pulse.md` § Phase 3](../../../../docs/routines/sync-triage-pulse.md); when the
   exception payloads are structurally empty, flag `posthog: degraded` and skip matching. When
   healthy, match each fail or blocked slice to in-window exceptions on its surface and route, and
   keep only safe-summary fields: error hash, sessions, users, first and last seen, confidence.
   The parent gets at most one line of per-surface counts. An in-window error hash that matches no
   recorded case becomes a `[derived:telemetry]` line under `Not sliced`: the query has no tester
   predicate, so it may be ordinary production traffic.
3. **Sentry, when connected.** Resolve `green-goods-client` or `green-goods-admin` by name through
   the connector, and keep the link, top frame and release of each issue first seen or active in
   the window. Without a connector, skip this step silently.
4. **Placement and privacy.** Enrichment goes in each slice's first comment, per the evidence
   comment pattern in [linear-templates.md](../linear-templates.md), never in the body. Error
   hashes, counts, commit SHAs and Sentry links are safe; replay URLs, session IDs and distinct IDs
   never reach Linear. The parent may carry one recipe line, `recordings: PostHog App project,
   session window <start>–<end>`, so a person can find the replays without a URL in Linear.
