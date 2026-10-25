# QA scope lock, filing, and completion

Load when a numbered proposal is ready or a run resumes at Phase 4 or later.
For `--call`, apply the call-mode gate and payload deltas.

## Phase 4 — Triage gate (REQUIRED USER GATE)

This is a hard scope-lock gate: numbered findings → explicit user lock → act only on locked items. Present the numbered list (extracted items + derived items) with proposed dispositions and ask, verbatim:

> Which items should I file? Reply with numbers (e.g., `1, 3, 5`), `all`, or `none`. For each, append a tag if you want to override: `1:track-only` (Customer Need + lightweight Backlog tracking Issue; on a sync item with no outside report, it says you know of one, and I'll ask for the reporter's role), `2:issue-only` (the Issue alone, no Customer Need; an existing Need stays until you remove it), `3:defer` (skip this run), `5:duplicate-of-PRD-1234`. Anything outside the listed numbers is out of scope for this run.

Record the reply in `triage.md`:

```markdown
## Scope Lock

- Approved as Issue + Customer Need: [1, 3]
- Approved as track-only: [2, 7]
- Approved as issue-only: [9]
- Linked to existing record: [5 → PRD-1234]
- Deferred / out of scope: [4, 6, 8, derived 100, 101]
```

Hard rules:
- Informal reply ("yeah just go") → re-ask once with the exact prompt.
- "Use your judgment" → all severity-HIGH items (PostHog match ≥50 sessions, OR call's explicit release-blocker framing). Re-confirm.
- Do not advance without a recorded scope lock.

## Phase 5 — Draft Linear payloads + Sheet rows + assignee dialog

For each locked item, draft payloads using [`linear-templates.md`](../linear-templates.md).

For a `source:qa-session` input, resolve every locked item's exact catalog Test ID from its
`case:` field before drafting. If an item has no exact ID, pause that item and ask the user to
select the case; do not invent or fuzzy-guess one. Put the ID in the Issue source line and the
Sheet's `Linked Test ID` field. Apply the same source-line rule to every accepted
`[derived:test-fail]` item. See [`.claude/context/qa.md § Test ID linkage`](../../../context/qa.md#test-id-linkage).

### Linear API constraints

Three hard constraints shape every payload — full detail, including the Codex-ready and autonomous-confident delegation bars, lives in [linear-templates.md § Linear API constraints](../linear-templates.md):

1. **`ai:*` is single-value-per-Issue** — the delegate-to agent wins the label; the originating agent goes in a comment, not the body (the `## Provenance` section was retired 2026-08-27).
2. **`package:*` is single-value-per-Issue** — the primary surface wins; secondary packages are named in the problem sentence (the `## Surface` block is retired).
3. **Customer Needs cannot be standalone** — every Need links to an Issue via the `issue` parameter; `track-only` = Need + lightweight Backlog tracking Issue, and `issue-only` = the item's Issue with no Need.

### Disposition rules (no standalone Need path)

On sync notes, the Phase 2 rule decides the last column: an item with no outside report and no PostHog match gets no Customer Need, whatever its row. The one correction is the Phase 4 gate: a `track-only` tag on such an item records that the user knows of an outside report the notes missed. Before writing that Need, ask the user for the reporter's role (such as "a steward" or "a funder", never a name) and, if they have them, the reporter's words. The Need's body carries that role and those words, scrubbed of anything identifying, and says the gate confirmed it; a teammate's quote never stands in for the reporter's, and the reporter's identity stays out of Linear under the [privacy boundary](../../../context/linear-routing-rules.md) (§ Invariant rules). If the user cannot describe an outside reporter, the item stays issue-only.

| Item shape | Issue created | Customer Need created |
|---|---|---|
| Clear actionable bug (named surface + suggestable fix) | **Main Issue** — `activity:build` + `Todo` + priority by severity | Yes, linked via `issue` |
| Bug with no repro or no clear surface | **Backlog Issue** — `activity:build` + `Backlog` | Yes, linked via `issue` |
| Idea / feedback / UX polish from users or telemetry, or a strategic gap | **Track-only Issue** — `activity:maintenance` (`activity:design` for visual polish, `activity:architecture` for strategic items) + `Backlog` + priority Low/Medium | Yes, linked via `issue` |
| The team's own work: an engineering chore, a tooling or process change, an idea the team raised for itself | **Issue-only**: the same lightweight Issue, `activity:maintenance` + `Backlog` + priority Low/Medium | No: a Customer Need records customer or telemetry signal |
| Question / "me too" / no actionable content | Skip both | Skip both |
| Duplicate of existing record | No new Issue; link via `relatedTo` | Optional — comment on existing if user wants the verbatim quote preserved; a sync item with no outside signal comments on the Issue, never the Need |

Title shape for track-only and issue-only Issues: a plain action-verb-led sentence, no prefix — "Bring back the Positions section on the public site", not "[tracking] Positions UI missing". The `[tracking]` prefix is retired (2026-08-27); the `maintenance` label plus `Backlog` state carry that meaning, and a `PreToolUse` hook rejects the prefix. Body: shorter than a bug Issue — the ask in prose, then one source line. Full contract: [`.claude/context/linear-routing-rules.md`](../../../context/linear-routing-rules.md) § Issue structure.

**Assignee dialog (bulk-default + exceptions-only review)**:

Single bulk prompt up front, then surface only the items where the proposed assignee differs from the default — never ask 27 separate questions.

> Default assignee for all N filed Issues: (a) Afo, (b) Claude (unlabeled), (c) unassigned, (d) other engineer (name).
> Per-item overrides? Reply with bullets like `5:gferreira525, 12-15:claude, 18:unassigned` or `confirm` to accept the default for everything.

Then, before writing, the assistant surfaces a **proposed exceptions list** for the user to ratify — items where the bulk default seems wrong given context (e.g., an admin bug when the default is Gui, a PWA architectural bug when the default is Claude). The user sees only items that need a decision, not the whole list.

Recall `ai:*` is single-value: when Codex delegation (`ai:codex`) is chosen, the originating agent is implicit and goes in a comment when it matters — never in the body, whose `## Provenance` section was retired 2026-08-27. The interactive skill running in Claude Code is the origin by default.

**Per-item preference capture (subtle)**:

When the user overrides the proposed assignee or disposition on a specific item, the skill records the *pattern* (not the specific item) to `~/.config/qa-triage/preferences.json`. Examples:

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

- `sheet-rows.csv` — one Defects row per filed item (skip `tracker-known` items). Match the Sheet's actual column order from `~/.config/qa-triage/cache.json`. Auto-generate `Defect ID` as `D-NNN` from the highest existing ID + 1.
- `sheet-test-backfill.csv` — one row per Defects row whose non-empty `Linked Test ID` exactly matches an ID in the live Sheet `test_catalog` cached during Phase 0, shaped `<tab>,<Test ID>,<Defect ID>`. Keep the Test ID on the Defects row but emit no backfill when the ID is absent from that cache; this covers `DOCS-*` and other repo-catalog-only cases until their rows exist in the live Sheet. Phase 6 fills the matching test row's `Defect Link` column **only** — never touches `Result`, `Severity`, `QA Owner`, or any other test column.

Severity defaults for the Defects row:
- `P0` — PostHog confirms ≥50 sessions in 30d OR the call flagged it as release-blocking.
- `P1` — confirmed bug with surface + behavior.
- `P2` — ideas, polish, non-blocking.
- `P3` — speculative or hypothetical.

Surface vocabulary on the Defects row: `Public Website | PWA iOS | PWA Android | Admin Dashboard | Cross Surface | Docs`.

## Phase 6 — Confirm & write to Linear + QA Sheet

1. **Privacy grep** across every Linear body **and every comment this run drafted or posted** for `replay`, `session_id`, `distinct_id`, `0x`, and any reporter identifiers seen this run. Evidence that moves out of a description and into the first comment stays inside the privacy boundary (`.claude/context/linear-routing-rules.md` § Invariant rules) — a grep that skips comments is not a redaction gate. Hits → redact in place and re-confirm. The grep **does NOT apply to `sheet-rows.csv`** — the Sheet is the explicit private-internal exception (Phase 0 verified its access mode is tight).

2. Show the final draft payloads as a single review block — Linear records + Sheet rows side-by-side, with the Sheet's `PostHog Session ID` and `PostHog Replay URL` columns visibly flagged so the privacy exception is re-acknowledged before the write.

3. Ask: `Type 'confirm' to write N Linear records and append M rows to the QA Sheet, or 'edit' to revise.`

4. On `confirm`:

   **Linear writes** (via Linear MCP):
   - Issues first (Customer Needs require an `issue` parameter — Linear API rejects standalone Needs).
   - **`save_issue` `labels` is REPLACE, not append.** When adding a single new label to an existing Issue, always read the current label list first and pass `[...existing, newLabel]`. Passing `["build"]` alone will strip every other label off the Issue.
   - **Snapshot before in-place edits.** When updating Customer Need bodies or Issue descriptions in bulk on already-filed records, write a JSON dump of every record's pre-edit `{id, title, description, body, labels, priority, status}` to `tmp/qa-triage/<slug>/pre-edit-snapshot.json` first. Cheap safety net if the bulk write goes sideways.
   - Issue labels: `protocol:green-goods` + ONE `package:*` (primary surface) + ONE activity — `activity:build` (bug), `activity:design` (visual polish), `activity:maintenance` (hygiene), or `activity:architecture` (strategic); never `activity:qa`, which marks the validation pass itself and not the defects it found — + the source label matching the resolved input (`source:drive` for Drive/Downloads notes; `source:qa-session` for qa-session handoff extracts; keep `source:sync-triage-pulse` on records resumed from a `session:<date>` pre-stage — never stamp Drive provenance on a live-session input or strip the pulse's provenance on resume) + ONE `ai:*` (delegate-to wins). Translate every one to its **bare child name** before calling `save_issue` (`["green-goods", "pwa", "build", "drive"]`): the API rejects the `group:child` display form, and one unresolvable entry rejects the whole array and files nothing.
   - Then Customer Needs for the items that carry one under § Disposition rules, each linked to its Issue via the `issue` parameter. Customer Needs accept `body`, `customer`, `issue` or `project`, `priority` and `source`; the API has no labels field.
   - Track-only and issue-only Issues are created in the same pass as the main Issues, before the Customer Needs that reference them.

   **QA-sheet writes** — use `scripts/agents/qa-sheet-append.ts` as the primary write path:

   ```bash
   bun scripts/agents/qa-sheet-append.ts \
     --defects-csv tmp/qa-triage/<slug>/sheet-rows.csv \
     --test-backfill-csv tmp/qa-triage/<slug>/sheet-test-backfill.csv \
     [--bootstrap-csv tmp/qa-triage/<slug>/schema-bootstrap.csv]
   ```

   The script POSTs the CSVs as JSON to an **Apps Script Web App** deployed on the QA workbook (URL cached at `~/.config/qa-triage/webhook.txt`, required shared secret at `~/.config/qa-triage/webhook-secret.txt`, optional local-only admin secret at `~/.config/qa-triage/webhook-admin-secret.txt`). The Apps Script runs under your Google identity and writes directly — no Google Cloud Console, no OAuth client, no service account. Canonical Apps Script source + setup steps live at `~/.config/qa-triage/setup.md` (chmod 600, never in git); repo-side pointer + bootstrap recipe at [`scripts/agents/qa-sheet-webhook-setup.md`](../../../../scripts/agents/qa-sheet-webhook-setup.md).

   **Fallback (guided paste)** — if the webhook isn't yet configured, the POST fails, or the user passes `--no-sheet`:
   1. Surface `sheet-rows.csv` and `sheet-test-backfill.csv` with workspace paths.
   2. If `schema-bootstrap.csv` was emitted, surface it first with instruction to paste the new columns to the right of `Notes`.
   3. Show paste instructions: *"Open the Sheet's `Defects` tab → click the first empty row → File → Import → Append to current sheet → paste `<path>`."*
   4. Wait for confirmation that the paste landed before declaring done.

5. On `--dry-run`: print the JSON Linear payloads instead of writing; still emit the Sheet CSVs. Skip Codex scratch cleanup so the run can be inspected.

## Phase 7 — Summary

Write `report.md` and print:

```markdown
## /qa-triage report — <meeting-title>

### Source
<path to notes> · <date>

### Locked Scope
- Filed as Issue + Need: [1, 3]
- Filed as track-only: [2, 7]
- Filed as issue-only: [9]
- Need removal pending: [11 → <Need link>]
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
<status: dispatched (scratch path, result file) | prompt emitted (path) | skipped | failed>

### Next step
- Offer the accepted Issues for a separately authorized implementation session, or
- Sync with the team on the deferred items, or
- Done.
```

After the child has completed and its result has been handled, remove only the scratch
directory recorded for this run in `codex-scratch-path.txt` (unless `--dry-run`). Keep it on
failure or while pending; never glob temporary directories for cleanup. After all confirmed Linear and Sheet writes succeed — and, in call mode, after
`catalog-feedback.md` has been copied into its plan hub — remove only
`tmp/qa-triage/<slug>/`; for dry runs, failed writes, or incomplete runs, keep it and
surface the resume path.

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
| Hand `codex exec` a `--full-auto` flag or a bare-array output schema | codex 0.149+ rejects the flag outright, and strict structured output rejects a top-level array or a `required` list that omits a property; use the snippet and the object-wrapped schema in `codex-prompt.md` |
| Treat the Drive MCP's natural-language flatten as authoritative for Sheet column order | Cache the actual column order to `~/.config/qa-triage/cache.json` on first read |
| Run without the Sheet permission check | Skipping that check is how session IDs leak |
| Apply multiple `ai:*` or `package:*` labels to one Issue | Linear enforces single-value-per-group on these families; the API silently drops the second label OR rejects the write entirely. Pick the most actionable label; name the secondary package in the problem sentence, and put a delegation note in a comment. The `## Provenance` and `## Surface` sections were retired 2026-08-27 |
| Create a Customer Need without an `issue` (or `project`) parameter | Linear API rejects with `Exactly one of projectId or issueId must be defined`. If the extracted item has no actionable Issue, create a lightweight `activity:maintenance` Backlog Issue first as the attach point |
| Request workspace-level label-group config changes from inside the skill | The single-value-per-group constraint is a workspace setting in Linear. Changing it (to multi-value) is a config decision for the workspace owner, not a skill change. Document the constraint and work within it |
| Double-file a session by running `--call` after the `qa-call-report` routine (or vice versa) | The routine owns unattended session writes; `--call` is its interactive sibling. One writer per session — and if both ran, the Phase 3b dedupe must link, not re-file |
