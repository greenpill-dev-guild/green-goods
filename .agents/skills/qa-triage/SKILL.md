---
name: qa-triage
user-invocable: true
description: Process a product sync QA session and turn the meeting notes into triaged Linear records + QA-sheet rows. Use this skill whenever the user mentions a QA call, QA sync, product sync, QA session, product review, "triage the QA bugs", "file the bugs from the call", "extract bugs from the sync notes", "update the QA sheet with bugs", processing meeting notes for bugs, or wants to file Linear issues from a recent QA meeting — even if they don't explicitly say "qa-triage". Pulls the latest Gemini notes from Drive (with ~/Downloads fallback), cross-references each item against PostHog telemetry and existing Linear/Sheet records, scope-locks the triage, then writes Linear Customer Needs/Issues with assignees and appends Defects rows to the Green Goods QA Sheet.
argument-hint: "[<notes-path|slug|qa-sync:YYYY-MM-DD>] [--dry-run] [--no-codex] [--no-sheet] [--fixture]"
version: "0.2.0"
status: active
packages: ["all"]
dependencies: ["posthog-questions", "doc-feedback", "debug", "audit-then-ship"]
last_updated: "2026-05-13"
last_verified: "2026-05-13"
---

# QA Triage Skill

Interactive sibling of the `bug-intake` cron'd routine. Pulls the latest **Product Sync** QA notes from Drive (with `~/Downloads` fallback), extracts bugs, ideas, and feedback, cross-references each item against PostHog telemetry and existing Linear + QA-sheet records, gates the triage with an explicit scope lock, then writes Linear records and appends rows to the **Green Goods v1.1 QA** Sheet.

Mirror [`docs/routines/bug-intake.md`](../../docs/routines/bug-intake.md) for the Linear protocol, label scheme, and privacy boundary — this skill is its **interactive, on-demand, single-source** sibling, not a replacement.

## Activation

| Trigger | Action |
|---------|--------|
| `/qa-triage` | Discover the latest Product Sync notes (Drive → Downloads). If the [`qa-triage-pulse`](../../docs/routines/qa-triage-pulse.md) routine has pre-staged Customer Needs for the latest sync, offer to resume from those instead. |
| `/qa-triage <path>` | Use the supplied notes path (absolute, relative, or `~/Downloads/...`) |
| `/qa-triage <slug>` | Resume against `.plans/qa-triage/<slug>/notes.md` from a prior run |
| `/qa-triage qa-sync:<YYYY-MM-DD>` | Resume from routine-pre-staged Customer Needs carrying that `qa-sync:*` label. Phases 1-3 are skipped (already done by `qa-triage-pulse`); triage gate fires immediately. |
| `/qa-triage … --dry-run` | Print payloads instead of writing to Linear; still emit Sheet CSVs |
| `/qa-triage … --no-codex` | Skip the Codex parallel pass (default is automatic dispatch) |
| `/qa-triage … --no-sheet` | Skip the QA-sheet write branch entirely |
| `/qa-triage … --fixture` | Use the synthetic fixture at `.agents/skills/qa-triage/fixtures/example-product-sync.md` as the source notes; pairs with `--dry-run` to validate the full phase flow without a real sync. **Never promote a `--fixture` run to a real write** — the fixture's Drive URL is synthetic and would leak the placeholder into Linear bodies. Fixture mode is validation-only. |

## Required surfaces

- **Linear MCP** — read + write on the Product team. Resolve team / labels / statuses by name at the start of every run; never hardcode IDs.
- **PostHog connector** — three projects:
  - App `163591` for client PWA + editorial website
  - Admin `262122` for admin cockpit
  - Agent `262124` — not used by this skill
  - Always call `switch-project` before any PostHog tool call (see [AGENTS.md § PostHog](../../AGENTS.md))
- **Google Drive MCP** — `search_files`, `read_file_content`, `get_file_metadata`, `get_file_permissions` against the team Drive containing the Gemini-generated notes and the **Green Goods v1.1 QA** Sheet (file id `1IiviDIqwFM7gcD3oV48LwHNW5poCE-HmSCLtsLt3xBo`).
- **Vercel MCP** — used for deploy correlation in Phase 3a-bis, gated on PostHog matches. Optional but recommended; without it, items lose the "this bug appeared with commit X by author Y" context.
- **Codex CLI** at `/Applications/Codex.app/Contents/Resources/codex` — automatic background dispatch on every run unless `--no-codex` is set.

## Workspace

Per-run workspace: `.plans/qa-triage/<slug>/` (committed to git as the durable record).

Contents:

- `notes.md` — symlink or copy of the source notes
- `extraction.md` — Phase 2 extracted bugs/ideas/feedback list (numbered)
- `cross-ref.md` — Phase 3 PostHog + Linear + QA-sheet matches per item
- `triage.md` — Phase 4 user-locked scope (the contract)
- `payloads.md` — Phase 5 draft Linear payloads
- `sheet-rows.csv` — Phase 5 Defects-tab rows for guided paste
- `sheet-test-backfill.csv` — Phase 5 Test-tab `Defect Link` backfills
- `schema-bootstrap.csv` — emitted only when the Defects tab needs the 6 new PostHog/Linear columns
- `report.md` — Phase 7 final summary

Skill-wide config: `.plans/qa-triage/.config.json` — caches resolved Sheet file id, column ordering, and last-verified permissions snapshot so Phase 0 doesn't re-prompt every run.

## Phase 0 — Setup (read-only)

> **Fixture-mode short-circuit.** When `--fixture` is set, skip the live-MCP probes in steps 3, 5, and 6 (PostHog reachability, Sheet permission check, full Sheet structure read). Treat the Sheet permissions as tight (already verified), reuse the cached `qa_sheet` block in `.config.json`, and DO NOT populate `test_catalog` on fixture runs — the fixture is synthetic and a stale catalog from a real run would be more useful than a fixture-derived one. Steps 1, 2, 3a (orphan worktree sweep), and 4 (Sheet file-id resolve from cache) still run.

1. **Resolve workspace slug** from the input file's title or filename stem (lowercase-hyphenated, e.g., `Product Sync — 2026-05-13` → `product-sync-2026-05-13`).
2. **Resolve Linear handles by name** at the start of every run:
   - Team: `Product` (fallback `Research` only when the user asks).
   - Workflow states: expect `Backlog`, `Todo`.
   - Label families: `protocol:green-goods`, `package:*`, `activity:qa`, `activity:maintenance`, `task:*`, `source:drive`, `source:qa-triage-pulse`, `agent:claude`, `agent:codex`, `agent:routine`. The per-week label `qa-sync:YYYY-MM-DD` is resolve-or-created on each run that needs it.
   - If any required label family is missing, fail loud and stop — do not invent records under a different label.
3. **Probe PostHog reachability** with a single-event query against both `POSTHOG_PROJECT_ID_APP` (`163591`) and `POSTHOG_PROJECT_ID_ADMIN` (`262122`). If either is unreachable, mark the affected surface as `enrichment: unavailable` and continue. **Skipped in `--fixture` mode.**

3a. **Report orphan Codex worktrees** from prior failed runs:

   ```bash
   for wt in /tmp/gg-codex-qa-*; do
     [ -d "$wt" ] || continue
     slug=$(basename "$wt" | sed 's/^gg-codex-qa-//')
     # Skip if the worktree corresponds to the current run's slug
     [ "$slug" = "<current-slug>" ] && continue
     printf '%s\n' "$wt"
   done
   ```

   Phase 2 dispatches `$CODEX exec --full-auto` into a worktree that gets cleaned up in Phase 7. If a prior run died (kill -9, crash, OS reboot), the worktree and branch persist and the next run's `git worktree add` can collide. Do **not** remove orphaned worktrees or branches during Phase 0. Surface the orphan paths in `report.md` and ask for an explicit cleanup command if the current run is blocked. Automatic cleanup is allowed only for the current run's recorded `WORKTREE` / `BRANCH` in Phase 7.
4. **Resolve the QA Sheet** via Drive MCP `search_files`. Title-pattern chain:

   ```
   name contains 'Green Goods v1.1 QA' and mimeType = 'application/vnd.google-apps.spreadsheet'
   → fall back to: name contains 'Green Goods QA' ...
   → fall back to: name contains 'QA' ...
   ```

   The known file id is `1IiviDIqwFM7gcD3oV48LwHNW5poCE-HmSCLtsLt3xBo` (owner `afo@greenpill.builders`). On first run, confirm and cache to `.config.json`. If zero hits remain after the chain, continue with `--no-sheet` semantics.

5. **Verify Sheet access mode** via `get_file_permissions`. **Hard stop** if the Sheet is `anyoneWithLink` or `public` — the row payload includes session IDs and replay URLs, which only belong in a fully-private internal surface. Surface the permission state and require `proceed anyway` to continue (default: abort and recommend tightening access). **Skipped in `--fixture` mode** (treat the cached `last_permission_check` in `.config.json` as authoritative).

6. **Read Sheet structure** via `read_file_content` (**skipped in `--fixture` mode** — rely on the cached `qa_sheet` block in `.config.json`):
   - Confirm tab names match `Public Website`, `PWA iOS`, `PWA Android`, `Admin Dashboard`, `Cross Surface`, `Defects` plus auxiliary `Guide`, `Summary`.
   - Read the `Defects` tab's header row. Detect whether the 6 added columns exist (`PostHog Hash`, `PostHog Sessions 7d`, `PostHog Users 7d`, `PostHog Session ID`, `PostHog Replay URL`, `Linear URL`). If absent, emit `schema-bootstrap.csv` (a single-row CSV with the new column names) to the workspace.
   - Read the `Defects` body and the 5 Test tabs into private context.
   - **Cache the `Scenario` + `Area` + `Test ID` triple from every Test-tab row** to `.config.json` under a `test_catalog` key. Phase 5's Linked-Test-ID inference uses this catalog to fuzzy-match extracted item descriptions to Scenarios — far more useful than expecting verbatim Test-ID references (e.g., "ADM-005") in conversational meeting notes. Match by keyword overlap between the item one-liner and `Scenario` (case-insensitive, tokenize on whitespace, ≥40% token overlap = match). Empty catalog (test tabs never populated) → Linked-Test-ID stays empty; no failure.
   - Cache the resolved column order to `.config.json` so subsequent runs skip bootstrap detection.

See [`sheet-schema.md`](./sheet-schema.md) for the canonical Defects and Test-tab schemas.

## Phase 1 — Discover (read-only)

Lookup order, first match wins:

0. **Resume from `qa-triage-pulse` pre-stage** — if invoked as `/qa-triage qa-sync:<YYYY-MM-DD>`, OR if no explicit path/slug was given but Linear has ≥1 open Customer Need carrying both `source:qa-triage-pulse` and a `qa-sync:<latest-date>` label, surface the resume prompt:

   > Found {N} pre-staged Customer Needs from {date}'s Product Sync (routine: qa-triage-pulse). Resume from those, or run a fresh extract from notes? `[resume / fresh / quit]`

   On `resume`: populate `extraction.md` from the linked Customer Need + Backlog tracking-Issue pairs (one item per pair, using the Need's verbatim source and the Issue's summary / safe evidence blocks), skip Phases 2 and 3 (Codex dispatch + PostHog cross-ref already done by the routine), and jump straight to Phase 4 with the pre-staged set as the numbered triage list. On `fresh`: ignore the pre-stage and continue to step 1 below; the Phase 6 confirm step will detect duplicates against the existing Customer Needs.

   The resume path cuts the user's interactive triage to ~5 minutes after a sync. See [`qa-triage-pulse.md`](../../docs/routines/qa-triage-pulse.md) for the routine's contract.

1. **Explicit argument** — `/qa-triage <path>` resolves the path directly. `/qa-triage <slug>` resolves to `.plans/qa-triage/<slug>/notes.md` if a prior run exists.
2. **Drive query** —

   ```
   title contains 'Product Sync' and title contains 'Notes by Gemini' and modifiedTime > '<14d-ago RFC3339>'
   ```

   Filter to `mimeType = 'application/vnd.google-apps.document'`.

3. **`~/Downloads/` fallback** —

   ```bash
   ls -t ~/Downloads/*Product*Sync*Notes\ by\ Gemini*.md 2>/dev/null | head -5
   ```

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

   Item types: `bug` → eligible for a main `activity:qa` Issue. `idea` / `feedback` → track-only by default, meaning Customer Need + lightweight Backlog tracking Issue.

3. **Dispatch Codex automatically (required unless `--no-codex` OR `--fixture` is set).** The assistant MUST fire the worktree dispatch on every real run that doesn't carry the `--no-codex` flag — no judgment override, no "skipped to keep the flow tight". The parallel extraction pass exists specifically to catch what a single-agent extraction misses. Skipping defeats the dual-extraction design. **`--fixture` mode is exempt**: the fixture is synthetic and trivially verifiable against the source markdown, so the parallel pass adds no signal but burns ~30s + a worktree per dry-run. Pattern source: the user-level memory `feedback_claude_orchestrated_codex.md` (under `~/.claude/projects/-Users-afo-Code-greenpill-green-goods/memory/`, outside the repo):

   ```bash
   CODEX=/Applications/Codex.app/Contents/Resources/codex
   WORKTREE=/tmp/gg-codex-qa-<slug>
   BRANCH=codex/qa-triage/<slug>

   git worktree add "$WORKTREE" -b "$BRANCH" "$(git branch --show-current)"
   ln -s "$(pwd)/.env" "$WORKTREE/.env"

   # Render the prompt + schema into the worktree
   # (see ./codex-prompt.md for the template)

   "$CODEX" exec --full-auto -C "$WORKTREE" \
     -o "$WORKTREE/codex-result.md" \
     --output-schema "$WORKTREE/schema.json" \
     "$(cat $WORKTREE/qa-prompt.md)"
   ```

   Fire via `Bash` with `run_in_background: true`. Continue to Phase 3 immediately. Phase 3 merges Codex's additions into `cross-ref.md` once its result file lands (background-completion notification).

   Fallbacks, in order:
   - `--no-codex`: skip dispatch; still write `codex-prompt.md` to the workspace as an optional manual run.
   - Dispatch failure (missing binary, dirty tree, branch collision): log to `report.md`'s `⚠ Codex failures` block and surface `codex-prompt.md` for manual copy-paste. Never block on Codex.

   Cleanup at Phase 7: if this run successfully recorded `WORKTREE` and `BRANCH`, remove only that current-run worktree/branch with `git worktree remove --force "$WORKTREE" && git branch -D "$BRANCH"`. Skip cleanup on `--dry-run` so the worktree can be inspected. Do not clean older `/tmp/gg-codex-qa-*` paths automatically.

## Phase 3 — Cross-reference (read-only)

For each item in `extraction.md`, organized in surface buckets:

### 3a. PostHog enrichment

Call `switch-project` to the matching project (App for PWA/website, Admin for admin; skip for docs/unknown), then run named questions from [`posthog-questions/SKILL.md`](../posthog-questions/SKILL.md):

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
- Disposition (proposed): new Issue, package:client, activity:qa
```

## Phase 4 — Triage gate (REQUIRED USER GATE)

Mirror [`audit-then-ship`](../audit-then-ship/SKILL.md) Phase 2 exactly. Present the numbered list (extracted items + derived items) with proposed dispositions and ask, verbatim:

> Which items should I file? Reply with numbers (e.g., `1, 3, 5`), `all`, or `none`. For each, append a tag if you want to override: `1:track-only` (Customer Need + lightweight Backlog tracking Issue), `3:defer` (skip this run), `5:duplicate-of-PRD-1234`. Anything outside the listed numbers is out of scope for this run.

Record the reply in `triage.md`:

```markdown
## Scope Lock

- Approved as Issue + Customer Need: [1, 3]
- Approved as track-only: [2, 7]
- Linked to existing record: [5 → PRD-1234]
- Deferred / out of scope: [4, 6, 8, derived 100, 101]
```

Hard rules:
- Informal reply ("yeah just go") → re-ask once with the exact prompt.
- "Use your judgment" → all severity-HIGH items (PostHog match ≥50 sessions, OR call's explicit release-blocker framing). Re-confirm.
- Do not advance without a recorded scope lock.

## Phase 5 — Draft Linear payloads + Sheet rows + assignee dialog

For each locked item, draft payloads using [`linear-templates.md`](./linear-templates.md).

### Linear API constraints (codified from the 2026-05-13 first-run findings)

Linear enforces three constraints the skill's older design didn't account for. Apply these before drafting labels and Customer Needs:

1. **`agent:*` is single-value-per-Issue.** Only ONE of `agent:claude`, `agent:codex`, `agent:routine` may be applied. When both an "origin" agent and a "delegate-to" agent apply to the same Issue (e.g., Claude created it, Codex is fixing it), the **delegate-to** wins as the label; the originating agent goes in the body's `## Provenance` section. If only one role applies (no delegation), use the originating agent.

2. **`package:*` is single-value-per-Issue.** Only ONE `package:*` may be applied. When a bug spans two packages (e.g., admin display + indexer enrichment, or shared hook + client view), the **primary surface** wins as the label; the secondary package(s) are named in the body's `## Surface` section with a one-line note explaining the constraint.

3. **Customer Needs cannot be standalone.** Linear's API requires `Exactly one of projectId or issueId must be defined`. Every Customer Need this skill creates must link to an Issue via the `issue` parameter. There is no standalone Need disposition; use `track-only` for Customer Need + lightweight Backlog tracking Issue.

### Disposition rules (no standalone Need path)

| Item shape | Issue created | Customer Need created |
|---|---|---|
| Clear actionable bug (named surface + suggestable fix) | **Main Issue** — `activity:qa` + `Todo` + priority by severity | Yes, linked via `issue` |
| Bug with no repro or no clear surface | **Backlog Issue** — `activity:qa` + `Backlog` | Yes, linked via `issue` |
| Idea / feedback / UX polish / strategic gap | **Track-only Issue** — `activity:maintenance` (or `activity:architecture` for strategic items) + `Backlog` + priority Low/Medium | Yes, linked via `issue` |
| Question / "me too" / no actionable content | Skip both | Skip both |
| Duplicate of existing record | No new Issue; link via `relatedTo` | Optional — comment on existing if user wants the verbatim quote preserved |

Title shape for track-only Issues: prefix `[tracking]`, then use an action-verb-led title (e.g., "[tracking] Bring back public-site Positions UI", not "Positions UI missing"). Body: shorter than a bug Issue — Summary + Surface + Suggested fix + Source.

**Assignee dialog (bulk-default + exceptions-only review)**:

Single bulk prompt up front, then surface only the items where the proposed assignee differs from the default — never ask 27 separate questions.

> Default assignee for all N filed Issues: (a) Afo, (b) `agent:claude`, (c) unassigned, (d) other engineer (name).
> Per-item overrides? Reply with bullets like `5:gferreira525, 12-15:agent:claude, 18:unassigned` or `confirm` to accept the default for everything.

Then, before writing, the assistant surfaces a **proposed exceptions list** for the user to ratify — items where the bulk default seems wrong given context (e.g., an admin bug when the default is Gui, a PWA architectural bug when the default is `agent:claude`). The user sees only items that need a decision, not the whole list.

Recall `agent:*` is single-value: when delegate (`agent:claude` / `agent:codex`) is chosen, the originating agent is implicit and goes in the body's `## Provenance` section. The interactive skill running in Claude Code is the origin by default.

**Per-item preference capture (subtle)**:

When the user overrides the proposed assignee or disposition on a specific item, the skill records the *pattern* (not the specific item) to `.plans/qa-triage/.preferences.json`. Examples:

```json
{
  "assignment_patterns": [
    {"pattern": "package:client + PWA-Android surface", "default_assignee": "gferreira525", "confidence": 0.6},
    {"pattern": "auth architectural", "default_assignee": "afo", "no_delegation": true}
  ],
  "last_updated": "2026-05-14"
}
```

The next run reads this file at Phase 0 and uses it to *propose* better defaults — never to make decisions silently. The user still confirms. This is a subtle bias toward the user's prior choices, not a rule-based override.

**Sheet payloads**:

- `sheet-rows.csv` — one Defects row per filed item (skip `tracker-known` items). Match the Sheet's actual column order from `.config.json`. Auto-generate `Defect ID` as `D-NNN` from the highest existing ID + 1.
- `sheet-test-backfill.csv` — one row per Defects row that has a non-empty `Linked Test ID`, shaped `<tab>,<Test ID>,<Defect ID>`. Phase 6 fills the matching test row's `Defect Link` column **only** — never touches `Result`, `Severity`, `QA Owner`, or any other test column.

Severity defaults for the Defects row:
- `P0` — PostHog confirms ≥50 sessions in 30d OR the call flagged it as release-blocking.
- `P1` — confirmed bug with surface + behavior.
- `P2` — ideas, polish, non-blocking.
- `P3` — speculative or hypothetical.

Surface vocabulary on the Defects row: `Public Website | PWA iOS | PWA Android | Admin Dashboard | Cross Surface | Docs`.

## Phase 6 — Confirm & write to Linear + QA Sheet

1. **Privacy grep** across every Linear body for `replay`, `session_id`, `distinct_id`, `0x`, and any reporter identifiers seen this run. Hits → redact in place and re-confirm. The grep **does NOT apply to `sheet-rows.csv`** — the Sheet is the explicit private-internal exception (Phase 0 verified its access mode is tight).

2. Show the final draft payloads as a single review block — Linear records + Sheet rows side-by-side, with the Sheet's `PostHog Session ID` and `PostHog Replay URL` columns visibly flagged so the privacy exception is re-acknowledged before the write.

3. Ask: `Type 'confirm' to write N Linear records and append M rows to the QA Sheet, or 'edit' to revise.`

4. On `confirm`:

   **Linear writes** (via Linear MCP):
   - Issues first (Customer Needs require an `issue` parameter — Linear API rejects standalone Needs).
   - **`save_issue` `labels` is REPLACE, not append** (verified 2026-05-14). When adding a single new label to an existing Issue, always read the current label list first and pass `[...existing, newLabel]`. Passing `["task:X"]` alone will strip every other label off the Issue.
   - **Snapshot before in-place edits.** When updating Customer Need bodies or Issue descriptions in bulk on already-filed records, write a JSON dump of every record's pre-edit `{id, title, description, body, labels, priority, status}` to `.plans/qa-triage/<slug>/pre-edit-snapshot.json` first. Cheap safety net if the bulk write goes sideways.
   - Issue labels: `protocol:green-goods` + ONE `package:*` (primary surface) + `activity:qa` (bug) or `activity:maintenance` (polish) or `activity:architecture` (strategic) + `source:drive` + ONE `agent:*` (delegate-to wins) + `task:*` (be aggressive about applying — see below).
   - **`task:*` mapping** (apply when *any* of the following keywords match the item; default to applying rather than omitting):
     - `task:funding-pathway` → bugs/feedback touching `/fund`, `/cookies`, donate, endow, withdraw, vault, treasury, deposit, balance
     - `task:access-participation` → bugs/feedback touching auth (passkey, social login, sign-in-with-wallet), account recovery, sign-up, garden membership join/leave
     - `task:reputation-identity` → ENS resolution, avatar/handle display, profile views, member lists, attribution
     - `task:evidence` → work submission, photo upload, attestation/EAS, hypercerts, impact metrics
     - `task:local-onboarding` → operator onboarding, garden setup, action templates, garden settings
     - `task:evaluator-review` → admin work-approval flows, review queues, certification
     - `task:data-input` → forms in general (admin garden settings, action creation, fund inputs)
   - When two `task:*` apply, pick the most specific (e.g., `task:funding-pathway` over `task:data-input` for the endow input field).
   - Then Customer Needs, each linked to its Issue via the `issue` parameter. Customer Needs accept `body` and `issue`/`project` only — no labels per the API surface.
   - Track-only Issues are created in the same pass as the main Issues, before the Customer Needs that reference them.

   **QA-sheet writes** — use `scripts/agents/qa-sheet-append.ts` as the primary write path:

   ```bash
   bun scripts/agents/qa-sheet-append.ts \
     --defects-csv .plans/qa-triage/<slug>/sheet-rows.csv \
     --test-backfill-csv .plans/qa-triage/<slug>/sheet-test-backfill.csv \
     [--bootstrap-csv .plans/qa-triage/<slug>/schema-bootstrap.csv]
   ```

   The script POSTs the CSVs as JSON to an **Apps Script Web App** deployed on the QA workbook (URL cached at `~/.config/qa-triage/webhook.txt`, required shared secret at `~/.config/qa-triage/webhook-secret.txt`, optional local-only admin secret at `~/.config/qa-triage/webhook-admin-secret.txt`). The Apps Script runs under your Google identity and writes directly — no Google Cloud Console, no OAuth client, no service account. Canonical Apps Script source + setup steps live at `~/.config/qa-triage/setup.md` (chmod 600, never in git); repo-side pointer + bootstrap recipe at [`scripts/agents/qa-sheet-webhook-setup.md`](../../scripts/agents/qa-sheet-webhook-setup.md).

   **Fallback (guided paste)** — if the webhook isn't yet configured, the POST fails, or the user passes `--no-sheet`:
   1. Surface `sheet-rows.csv` and `sheet-test-backfill.csv` with workspace paths.
   2. If `schema-bootstrap.csv` was emitted, surface it first with instruction to paste the new columns to the right of `Notes`.
   3. Show paste instructions: *"Open the Sheet's `Defects` tab → click the first empty row → File → Import → Append to current sheet → paste `<path>`."*
   4. Wait for confirmation that the paste landed before declaring done.

5. On `--dry-run`: print the JSON Linear payloads instead of writing; still emit the Sheet CSVs. Skip Codex worktree cleanup so the run can be inspected.

## Phase 7 — Summary

Write `report.md` and print:

```markdown
## /qa-triage report — <meeting-title>

### Source
<path to notes> · <date>

### Locked Scope
- Filed as Issue + Need: [1, 3]
- Filed as track-only: [2, 7]
- Linked to existing: [5 → PRD-1234]
- Deferred: [4, 6, 8, derived 100, 101]

### Filed
| # | Type | Title | URL | Labels | Assignee |
|---|------|-------|-----|--------|----------|
| 1 | Issue | … | PRD-… | … | Afo |
| 1 | Need | … | PRD-… | … | — |
| … |

### QA Sheet
- Sheet: <title> (<file_id>)
- Defects rows drafted: <N> (<workspace>/sheet-rows.csv)
- Test-row backfills drafted: <M> (<workspace>/sheet-test-backfill.csv)
- Schema-bootstrap CSV: <emitted | not needed>
- Write path: <guided manual paste | qa-sheet-append.ts (v0.2.0)>
- Skipped (tracker-known): <list>
- Derived from QA-sheet failures: <list of Test IDs>

### Codex pass
<status: dispatched (worktree path, result file) | prompt emitted (path) | skipped | failed>

### Next step
- Spawn implementation sessions for `agent:claude`-labelled Issues, or
- Sync with the team on the deferred items, or
- Done.
```

Then run Codex worktree cleanup for the current run only if dispatched (unless `--dry-run`).

## Privacy boundary — one explicit exception

The canonical boundary from [`bug-intake.md`](../../docs/routines/bug-intake.md) and [`posthog-questions/SKILL.md`](../posthog-questions/SKILL.md) keeps replay URLs, session IDs, distinct IDs, wallet addresses, and reporter identifiers out of every shared surface.

This skill makes **one** explicit exception: the QA Sheet may carry `PostHog Session ID` and `PostHog Replay URL` columns. Conditions:

1. Sheet permissions are tight (not `anyoneWithLink`, not `public`). Phase 0 hard-aborts if not.
2. Every other surface still enforces the strict boundary. The Phase 6 privacy grep runs on Linear bodies but skips `sheet-rows.csv` by design.
3. Distinct IDs and wallet addresses remain private-only **everywhere**, including the Sheet — the exception is narrow to session ID + replay URL.

## Anti-Patterns

| Don't | Why |
|-------|-----|
| Skip Phase 4's scope-lock gate | The whole point is the explicit triage — without it, the skill silently expands scope |
| Hardcode Linear team / label / status IDs | Resolve by name at runtime; the IDs change |
| Forget `switch-project` before a PostHog call | Connector default returns zero from the wrong project — silently wrong, easy to miss |
| Write session IDs or replay URLs to Linear, Discord, PRs, or docs | The Sheet is the **only** exception; everywhere else is hard private |
| Overwrite QA-owner-managed columns on Test rows | Only `Defect Link` may be backfilled; `Result`, `Severity`, `QA Owner` are sacred |
| Edit prior-session Defects rows | Append only; manual edits to existing rows are sacred |
| Block on Codex failure | Codex is auxiliary — log it and continue with manual prompt fallback |
| Treat the Drive MCP's natural-language flatten as authoritative for Sheet column order | Cache the actual column order to `.config.json` on first read |
| Run without the Sheet permission check | Skipping that check is how session IDs leak |
| Apply multiple `agent:*` or `package:*` labels to one Issue | Linear enforces single-value-per-group on these families; the API silently drops the second label OR rejects the write entirely. Pick the most actionable label and put the secondary in the body's `## Provenance` / `## Surface` section |
| Create a Customer Need without an `issue` (or `project`) parameter | Linear API rejects with `Exactly one of projectId or issueId must be defined`. If the extracted item has no actionable Issue, create a lightweight `activity:maintenance` Backlog Issue first as the attach point |
| Request workspace-level label-group config changes from inside the skill | The single-value-per-group constraint is a workspace setting in Linear. Changing it (to multi-value) is a config decision for the workspace owner, not a skill change. Document the constraint and work within it |

## Related Skills

- [qa-triage-pulse routine](../../docs/routines/qa-triage-pulse.md) — cron'd async sibling routine that pre-stages Customer Needs every Wednesday after the 10am PST Product Sync. The skill's Phase 1 step 0 resumes from those pre-stages when present, cutting interactive triage time to ~5 minutes.
- [bug-intake routine](../../docs/routines/bug-intake.md) — cron'd async sibling routine for Discord + Telegram + Drive bug-source intake (M/W/F). Shares the Linear protocol and privacy boundary. This skill is the interactive single-source counterpart for QA-sync notes specifically.
- [`posthog-questions`](../posthog-questions/SKILL.md) — named PostHog questions this skill calls.
- [`audit-then-ship`](../audit-then-ship/SKILL.md) — source of the Phase 4 scope-lock gate language.
- [`doc-feedback`](../doc-feedback/SKILL.md) — workspace convention (`.plans/<skill>/<slug>/`) borrowed.
- [`debug`](../debug/SKILL.md) — User-Facing Bug Triage Protocol; the assistant borrows the "reproduce before forensics" framing for any item the user wants to investigate before filing.

## Key principles

- **Read-only until Phase 6** — phases 0–4 never write to Linear or the Sheet.
- **Scope lock is the contract** — recorded in `triage.md`, referenced through Phase 7.
- **Every write needs evidence** — Linear payloads ride PostHog safe-summaries when available; Sheet rows carry the same plus the privacy-excepted private fields.
- **The Sheet is the only exception** — never paint elsewhere.
- **One invocation, one product sync** — single-source by design. The async multi-source path is `bug-intake`'s job.
