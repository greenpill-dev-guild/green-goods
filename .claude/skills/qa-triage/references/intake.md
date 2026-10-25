# QA intake and enrichment

Load for fresh notes and incomplete local runs. A routine-pre-staged `session:<date>` reads
Phase 1 step 0, preserves its source and record shapes, then moves to the filing reference.

## Required surfaces

- **Linear MCP** — read + write on the Product team. Resolve team / labels / statuses by name at the start of every run; never hardcode IDs.
- **PostHog connector** — three projects:
  - App `163591` for client PWA + editorial website
  - Admin `262122` for admin cockpit
  - Agent `262124` — not used by this skill
  - Always call `switch-project` before any PostHog tool call (see [PostHog surface routing](../../../../docs/routines/posthog-questions.md))
- **Google Drive MCP** — `search_files`, `read_file_content`, `get_file_metadata`, `get_file_permissions` against the team Drive containing the Gemini-generated notes and the **Green Goods v1.1 QA** Sheet (file id `1IiviDIqwFM7gcD3oV48LwHNW5poCE-HmSCLtsLt3xBo`).
- **Vercel MCP** — used for deploy correlation in Phase 3a-bis, gated on PostHog matches. Optional but recommended; without it, items lose the "this bug appeared with commit X by author Y" context.
- **Codex CLI** resolved by `.claude/scripts/resolve-codex-binary.sh` from a valid `CODEX` override, the installed ChatGPT.app/Codex.app bundle, or `PATH` — background extraction on real runs when delegation is permitted and neither `--no-codex` nor `--fixture` is set; otherwise retain the manual prompt.

## Workspace

Per-run workspace: `tmp/qa-triage/<slug>/` (gitignored operational scratch).

Contents:

- `notes.md` — symlink or copy of the source notes
- `extraction.md` — Phase 2 extracted bugs/ideas/feedback list (numbered)
- `cross-ref.md` — Phase 3 PostHog + Linear + QA-sheet matches per item
- `triage.md` — Phase 4 user-locked scope (the contract)
- `payloads.md` — Phase 5 draft Linear payloads
- `sheet-rows.csv` — Phase 5 Defects-tab rows for guided paste
- `sheet-test-backfill.csv` — Phase 5 Test-tab `Defect Link` backfills
- `schema-bootstrap.csv` — emitted only when the Defects tab needs the 6 new PostHog/Linear columns
- `codex-merge.json` — idempotency ledger for the background Codex result (result digest, stable item keys, assigned item numbers, and merge status)
- `codex-scratch-path.txt` / `codex-success-path.txt` — current attempt and successfully published attempt; consume automatic output only when both identify the same completed directory
- `manual-prompt.md` — fallback prompt with readable absolute notes and schema paths
- `report.md` — Phase 7 final summary
- `catalog-feedback.md` — call mode only: the `catalog` observations from Phase 2b; copied de-attributed into the catalog-owning plan hub at Phase 7 before cleanup

Skill-wide cache: `~/.config/qa-triage/cache.json` — stores the resolved Sheet file
id, column ordering, and last-verified permissions snapshot. User-specific assignment
patterns live in `~/.config/qa-triage/preferences.json`. Neither file is repository truth.

The durable result is the accepted Linear record plus the QA Sheet row. On a fully
successful Phase 7, remove only the current run's scratch workspace after printing the
summary. Keep scratch for dry runs, failures, or incomplete runs so they can be resumed.

## Fixture mode (`--fixture`)

Validation-only: runs the full phase flow against the synthetic fixture at [`fixtures/example-product-sync.md`](../fixtures/example-product-sync.md), usually paired with `--dry-run`. **Never promote a fixture run to a real write** — the fixture's Drive URL is synthetic and would leak the placeholder into Linear bodies.

All deviations from a real run, in one place:

- **Phase 0** — skip the live-MCP probes: PostHog reachability (step 3), the Sheet permission check (step 5), and the full Sheet structure read (step 6). Treat Sheet permissions as tight (the cached `last_permission_check` is authoritative) and reuse the cached `qa_sheet` block in `~/.config/qa-triage/cache.json`. Do NOT populate `test_catalog` — a stale catalog from a real run is more useful than a fixture-derived one. Steps 1, 2, 3a (current-run state), and 4 (Sheet file-id resolve from cache) still run.
- **Phase 2** — skip the Codex parallel pass: the fixture is trivially verifiable against its source markdown, so the pass adds no signal to this synthetic source.

## Phase 0 — Setup (read-only)

> `--fixture` runs skip several Phase 0 steps — see § Fixture mode.

1. **Resolve workspace slug** from the input file's title or filename stem (lowercase-hyphenated, e.g., `Build Sync — 2026-06-10` → `build-sync-2026-06-10`).
2. **Resolve Linear handles by name** at the start of every run:
   - Team: `Product` (fallback `Research` only when the user asks).
   - Workflow states: expect `Backlog`, `Todo`.
   - Label families: `protocol:green-goods`, `package:*`, `activity:build`, `activity:design`, `activity:qa`, `activity:maintenance`, `source:drive`, `source:sync-triage-pulse`, `source:qa-session` (resolve-or-create; for qa-session handoff inputs), `ai:codex`, `ai:routine`. The dated label `session:YYYY-MM-DD` (the call's or session's date) is resolve-or-created on each run that needs it.
   - If any required label family is missing, fail loud and stop — do not invent records under a different label.
3. **Probe PostHog reachability** with a single-event query against both `POSTHOG_PROJECT_ID_APP` (`163591`) and `POSTHOG_PROJECT_ID_ADMIN` (`262122`). If either is unreachable, mark the affected surface as `enrichment: unavailable` and continue. (Skipped in fixture mode.)

3a. **Inspect current-run extraction state** when resuming: read `codex-scratch-path.txt`
   and any pending result before dispatch. Preserve running or failed scratch. Legacy Git
   worktrees belong to their original runs; report a collision and leave cleanup to a separately
   authorized action. This flow creates no branch or worktree.
4. **Resolve the QA Sheet** via Drive MCP `search_files`. Title-pattern chain:

   ```text
   name contains 'Green Goods v1.1 QA' and mimeType = 'application/vnd.google-apps.spreadsheet'
   → fall back to: name contains 'Green Goods QA' ...
   → fall back to: name contains 'QA' ...
   ```

   The known file id is `1IiviDIqwFM7gcD3oV48LwHNW5poCE-HmSCLtsLt3xBo` (owner `afo@greenpill.builders`). On first run, confirm and cache to `~/.config/qa-triage/cache.json`. If zero hits remain after the chain, continue with `--no-sheet` semantics.

5. **Verify Sheet access mode** via `get_file_permissions`. **Hard stop** if the Sheet is `anyoneWithLink` or `public` — the row payload includes session IDs and replay URLs, which only belong in a fully-private internal surface. Surface the permission state, abort the run, and recommend tightening access. There is no override for a public or link-accessible Sheet. (Skipped in fixture mode.)

6. **Read Sheet structure** via `read_file_content` (skipped in fixture mode):
   - Confirm tab names match `Public Website`, `PWA iOS`, `PWA Android`, `Admin Dashboard`, `Cross Surface`, `Defects` plus auxiliary `Guide`, `Summary`.
   - Read the `Defects` tab's header row. Detect whether the 6 added columns exist (`PostHog Hash`, `PostHog Sessions 7d`, `PostHog Users 7d`, `PostHog Session ID`, `PostHog Replay URL`, `Linear URL`). If absent, emit `schema-bootstrap.csv` (a single-row CSV with the new column names) to the workspace.
   - Read the `Defects` body and the 5 Test tabs into private context.
   - **Cache the `Scenario` + `Area` + `Test ID` triple from every Test-tab row** to `~/.config/qa-triage/cache.json` under a `test_catalog` key. Phase 5's Linked-Test-ID inference uses this catalog to fuzzy-match extracted item descriptions to Scenarios — far more useful than expecting verbatim Test-ID references (e.g., "ADM-005") in conversational meeting notes. Match by keyword overlap between the item one-liner and `Scenario` (case-insensitive, tokenize on whitespace, ≥40% token overlap = match). Empty catalog (test tabs never populated) → Linked-Test-ID stays empty; no failure.
   - Cache the resolved column order to `~/.config/qa-triage/cache.json` so subsequent runs skip bootstrap detection.

See [`sheet-schema.md`](../sheet-schema.md) for the canonical Defects and Test-tab schemas.

## Phase 1 — Discover (read-only)

Lookup order, first match wins:

0. **Resume from a `sync-triage-pulse` pre-stage** — if invoked as `/qa-triage session:<YYYY-MM-DD>`, resume that batch. Otherwise, when no explicit path or slug was given, list the recent batches: Product-team tracking Issues carrying `source:sync-triage-pulse` that are still in `Backlog`, from the last 14 days, grouped by their `session:<YYYY-MM-DD>` label. Labels live on the tracking Issues, never on the Customer Needs. The routine pre-stages both weekly calls, the Monday Engineering Sync and the Wednesday Build Sync, so a week can hold two batches; name each by the call in its records' source lines. When at least one batch exists, surface:

   > Found pre-staged items from sync-triage-pulse: {date} {call} ({N}){, {date} {call} ({N})}. Resume one batch (reply with its date), run a fresh extract from notes, or quit? `[<date> / fresh / quit]`

   On a date: populate `extraction.md` from that batch's Backlog tracking Issues (one item per Issue: its linked Customer Need's verbatim source when it has one, otherwise the Issue's own source line, plus the Issue's summary / safe evidence blocks; the routine files an item without a Need unless an outside report or a PostHog match backs it), skip Phases 2 and 3 (Codex dispatch + PostHog cross-ref already done by the routine), and jump straight to Phase 4 with the batch as the numbered triage list. Each resumed item keeps its record shape through Phases 5 and 6: a tracking Issue with a linked Need is promoted or kept as a pair, and an issue-only item is promoted or updated in place without a Customer Need, whatever row of § Disposition rules its type would otherwise match. Only a Phase 4 tag changes a shape. `track-only` adds a Need to an issue-only item only with the reporter evidence § Disposition rules asks the user for, since a resumed Issue carries no outside quote. `issue-only` on a pair cannot finish here, because this skill never deletes a Customer Need: the Need stays until the user removes it in Linear, and the Phase 7 report lists the item under `Need removal pending` with the Need's link, never as issue-only. Resume one batch per invocation, then run `/qa-triage session:<date>` for another. On `fresh`: ignore the pre-stage and continue to step 1 below; the Phase 6 confirm step will detect duplicates against the existing Customer Needs.

   The resume path cuts the user's interactive triage to ~5 minutes after a call. See [`sync-triage-pulse.md`](../../../../docs/routines/sync-triage-pulse.md) for the routine's contract.

1. **Explicit argument** — `/qa-triage <path>` resolves the path directly. `/qa-triage <slug>` resolves to `tmp/qa-triage/<slug>/notes.md` if an incomplete run exists.
2. **Drive query** —

   ```text
   (title contains 'Build Sync' or title contains 'Engineering Sync' or title contains 'Product Sync') and title contains 'Notes by Gemini' and modifiedTime > '<14d-ago RFC3339>'
   ```

   Filter to `mimeType = 'application/vnd.google-apps.document'`.

3. **`~/Downloads/` fallback** —

   ```bash
   ls -t ~/Downloads/*Sync*Notes\ by\ Gemini*.md 2>/dev/null | head -5
   ```

   The glob matches the notes of every sync (Build, Engineering, and legacy Product Sync), which is safe because the candidate list is confirmed before parsing.

Show the candidate list (max 5, last 14 days) with title + modified date. Confirm before parsing — never silent-pick, even on a single match. If zero candidates, surface the empty result with the queries tried and stop.

## Phase 2 — Parse & extract (read-only)

1. Read the notes markdown and extract one numbered item per bug, idea, feedback, or question. Gemini notes have stable sections (`Summary`, `Discussion`, `Action items`, `Q&A`) — don't write a parser, just read the markdown.

2. Write `extraction.md`:

   ```markdown
   ## Extracted from <meeting-title> · <date>

   1. [bug] <one-line description>
      Surface: <client-pwa | client-website | admin | docs | unknown>
      Verbatim: > "<exact quote from the notes>"
      Speaker: <name or "anonymous">

   2. [idea] ...
   3. [feedback] ...
   ```

   Item types: `bug` → eligible for a main `activity:build` Issue. `idea` / `feedback` → track-only by default, meaning Customer Need + lightweight Backlog tracking Issue. Sync notes add the Customer Need rule from [`sync-triage-pulse` § Customer Needs](../../../../docs/routines/sync-triage-pulse.md#customer-needs): an item from a Build Sync or Engineering Sync keeps its Customer Need only when the notes attribute it to someone outside the team or a Phase 3 PostHog query matches it. Any other sync item is issue-only, its Issue with no Customer Need, whatever its type: an engineering chore, a tooling or process change, or a bug or idea the team raised itself.

3. **Run the independent extraction** on real runs unless `--no-codex` or `--fixture`
   applies, and only when the active agent policy permits delegation. Use
   [codex-prompt.md § Dispatch mechanics](../codex-prompt.md#dispatch-mechanics-phase-2): copy
   notes, rendered prompt, and schema into a fresh temporary directory; launch the read-only,
   ephemeral child outside Git; keep its result in the run workspace. Preserve `CODEX_HOME`,
   exclude parent service credentials, and close stdin. Continue Phase 3 while it runs.
   On resume, inspect the recorded child/result before considering another dispatch.

   If delegation is unavailable, prohibited, or fails, record why in `report.md` and render
   `manual-prompt.md` using [the manual fallback](../codex-prompt.md#manual-fallback), with
   readable absolute paths to the notes and schema. `--no-codex` uses that same fallback.
   A child failure never blocks the primary extraction. Process returned items through the
   idempotent completion handler; never merge them ad hoc.

## Phase 3 — Cross-reference (read-only)

### Codex completion handler (required)

Use the merge contract in [codex-prompt.md § Idempotent completion handler](../codex-prompt.md) whenever `codex-result.md` may be ready. Invoke it at all three checkpoints:

1. on the background-completion notification;
2. after Phase 3 enrichment, before first presenting the Phase 4 triage gate; and
3. immediately before Phase 7 finalization and current-run scratch cleanup.

Before consuming automatic output, the handler verifies matching scratch/success pointers, the
current attempt's completion marker, and that its result matches the published file. Failed or
prior-attempt results are evidence only.
It then reads the `items` array, validates the records, computes the file digest and stable item
keys, and records them in `codex-merge.json`. A digest already handled is a no-op. Net-new items
are added once to `extraction.md`, then enriched or replaced by key in `cross-ref.md`.

If completion arrives after Phase 3, reopen Phase 3 only for net-new Codex items. If the Phase 4 list was already shown or `triage.md` already contains a scope lock, present an additive triage gate for only those new item numbers and append the response to `triage.md`; preserve every earlier disposition. Do not let late Codex output silently enter Phase 5 payloads.

At the Phase 7 checkpoint, do not spin or poll indefinitely. If the background job is still running, keep the workspace and child scratch, report the run as pending, and resume this handler on its completion notification instead of finalizing or cleaning up early. A completed dispatch with a missing, malformed, or empty result follows the existing failure fallback and may finalize without Codex additions.

For each item in `extraction.md`, organized in surface buckets:

### 3a. PostHog enrichment

Call `switch-project` to the matching project (App for PWA/website, Admin for admin; skip for docs/unknown), then run named questions from [`posthog-questions.md`](../../../../docs/routines/posthog-questions.md):

- `errors.match-bug-report` with the verbatim quote as `snippet`.
- `errors.recurring` over 30 days — does the matched error hash cross the ≥50-session threshold?

Surface only safe-summary fields in `cross-ref.md` (error hash, affected sessions, affected users, **first_seen**, last_seen, app surface, confidence). Never copy replay URLs, session IDs, or distinct IDs into the cross-ref file — those are private-context only, materialized into the Sheet payload in Phase 5.

### 3a-bis. Vercel deploy correlation (gated on PostHog match)

For items where step 3a returned a match with a non-null `first_seen`, ask Vercel which deploy was live when the error first appeared:

- List recent prod deploys via the Vercel MCP for each project (`client`, `admin`) with state `READY`, target `production`, finishedAt in `[first_seen - 24h, first_seen + 1h]`.
- Pick the most recent deploy whose `finishedAt` is **before** `first_seen` (the one that was live when the error started).
- Fetch metadata: deploy URL, commit SHA, commit message (first line), deploy author, finishedAt, and the previous successful prod deploy's commit SHA.
- Build diff URL: `https://github.com/greenpill-dev-guild/green-goods/compare/{prev_sha}...{current_sha}`.
- If no prod deploys hit the window (item predates available history), omit the correlation block — do not invent deploys.

**Skip Vercel entirely for items without a PostHog match** — there's nothing to anchor against, and the query wastes ~1-2s per item.

Surface as a Deploy-correlation block per item in `cross-ref.md`. Privacy: deploy metadata is GitHub-public — safe for Linear bodies. Runtime log content is NOT pulled here.

### 3b. Linear scan

List open Customer Needs and Issues on the Product team carrying `protocol:green-goods` + the inferred `package:*`. Match on described behavior:

- `duplicate` — exact match. Link the existing record; do not file a new one.
- `related` — same area, distinct symptom. Link as `relates to` when filing.
- `new` — no match.

### 3c. QA-sheet dedupe scan

Using the `Defects` rows read in Phase 0, check each item against existing rows by Linear URL, PostHog error hash, or Title fuzzy-match. If matched, flag as `tracker-known` and skip the Defects row write in Phase 6 (the Linear write still runs if the user re-files it).

### 3d. QA-sheet failed-test scan

Using the test-tab rows from Phase 0, for every Test row where `Result == "Fail"` and `Defect Link` is empty, surface as `[derived:test-fail]` candidate with its `Test ID`, `Surface`, `Priority`, `Scenario`, `Expected Result`, and `Notes`.

### 3e. Derived candidates (per surface)

Surface up to 5 additional candidates the user might want to file but didn't mention on the call:

- `[derived:posthog]` — top errors from `quality.top-failures` (7d) on the matching project, **not already** in `extraction.md`.
- `[derived:recurring]` — recurring patterns from `errors.recurring` (30d) crossing the ≥50-session threshold for the same surface.
- `[derived:test-fail]` — from step 3d.

Numbered as items 100+ in the triage list.

Output: `cross-ref.md`, one block per item:

```markdown
### Item 1 — <one-line description>

- Surface: client-pwa
- PostHog: 12 sessions, 8 users (7d), hash `7f3a...`, first seen 2026-05-10
- Deploy correlation: commit `abc1234` (Gui · 2h before first_seen) — packages/client work-submission · [diff](https://github.com/.../compare/...)
- Linear scan: 1 related (PRD-1234), no duplicates
- Tracker scan: not present
- Disposition (proposed): new Issue, package:pwa, activity:build
```
