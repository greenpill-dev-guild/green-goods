# Codex Prompt Template — `/qa-triage`

The skill renders this template into the Codex worktree at `/tmp/gg-codex-qa-<slug>/qa-prompt.md`. Substitute `{notes_path}`, `{meeting_title}`, `{meeting_date}`, and `{slug}` before dispatch.

When Codex auto-dispatch fails or `--no-codex` is set, the skill copies this rendered prompt to `tmp/qa-triage/<slug>/codex-prompt.md` and surfaces the path for manual copy-paste.

---

## Dispatch mechanics (Phase 2)

Pattern source: this repository's QA-triage skill and the rendered prompt below. Do not depend on maintainer-specific paths or private memory files.

```bash
CODEX="$(.claude/scripts/resolve-codex-binary.sh)"
WORKTREE=/tmp/gg-codex-qa-<slug>
BRANCH=codex/qa-triage/<slug>
NOTES_SOURCE="$(pwd)/tmp/qa-triage/<slug>/notes.md"

git worktree add "$WORKTREE" -b "$BRANCH" "$(git branch --show-current)"

# Keep every delegated input inside the checkout passed to `-C`. `notes.md` may be a
# symlink in the primary workspace, so copy its contents rather than recreating the link.
NOTES_COPY="$WORKTREE/qa-notes.md"
cp -- "$NOTES_SOURCE" "$NOTES_COPY"

# Render the template below with {notes_path} set to the absolute $NOTES_COPY path,
# and copy schema.json into the worktree, then:
CODEX_ENV=(
  "HOME=$HOME"
  "PATH=$PATH"
  "TMPDIR=${TMPDIR:-/tmp}"
  "SHELL=${SHELL:-/bin/zsh}"
  "LANG=${LANG:-C.UTF-8}"
)
[ -n "${CODEX_HOME:-}" ] && CODEX_ENV+=("CODEX_HOME=$CODEX_HOME")

env -i "${CODEX_ENV[@]}" \
  "$CODEX" exec --full-auto -C "$WORKTREE" \
  -o "$WORKTREE/codex-result.md" \
  --output-schema "$WORKTREE/schema.json" \
  "$(cat "$WORKTREE/qa-prompt.md")"
```

Fire via `Bash` with `run_in_background: true`. The clean environment intentionally excludes
parent service credentials and any root `.env`, while preserving a configured `CODEX_HOME` so the
CLI retains its own authentication, configuration, and installed skills. This extraction pass needs
only the rendered notes and schema. Fallbacks and Phase 7 cleanup rules stay in `SKILL.md`.
The shared resolver honors a valid `CODEX` override, then checks the installed ChatGPT.app and
Codex.app bundles before falling back to `codex` on `PATH`.

### Orphan worktree sweep (Phase 0 step 3a)

```bash
for wt in /tmp/gg-codex-qa-*; do
  [ -d "$wt" ] || continue
  slug=$(basename "$wt" | sed 's/^gg-codex-qa-//')
  # Skip the current run's own worktree
  [ "$slug" = "<current-slug>" ] && continue
  printf '%s\n' "$wt"
done
```

---

## Template (render this into the worktree)

```markdown
You are a parallel extraction pass on QA meeting notes for the Green Goods project. The main Claude Code session has already produced its own extraction; your output is a cross-check, not a primary record.

## Source

Read the notes at: {notes_path}

This is a Gemini-generated transcript from the meeting "{meeting_title}" on {meeting_date}.

## Your task

Extract every item from the notes that could become a bug ticket, an idea, a piece of user feedback, or an unanswered question. Be more thorough than Claude — flag items even if you're not sure they're real, because the human will triage anyway.

For every item, fill the JSON schema at `schema.json` strictly. One item per JSON record.

## Surface vocabulary (use these exact strings)

- `Public Website` — client editorial routes (/, /gardens, /fund, /impact, /actions, /cookies on the public site)
- `PWA iOS` — installed PWA on iOS Safari
- `PWA Android` — installed PWA on Android Chrome
- `Admin Dashboard` — admin cockpit (Hub, MainSheet, LeftSheet, RightSheet, AdminFab, /hub/*, /garden/*, /community/*)
- `Cross Surface` — multi-surface or visual/copy/error regressions that aren't tied to one surface
- `Docs` — Docusaurus documentation site
- `unknown` — cannot infer from the notes

## Item types (use these exact strings)

- `bug` — broken behavior, regression, crash, layout defect, accessibility blocker
- `idea` — feature request, "wouldn't it be nice if", aspirational
- `feedback` — qualitative reaction ("this feels slow", "the copy is confusing"), no clear fix
- `question` — unanswered question raised on the call, no clear actor

## Severity hints

If the notes contain phrases like "blocks release", "P0", "broken for everyone", "we can't ship", flag as severity hint `P0`. Otherwise leave severity blank — the human triages.

## Quote-anchored extraction

For every item, include the verbatim quote from the notes that grounds the extraction. Do not paraphrase. If the speaker is named on the meeting's attendee list, include the speaker; otherwise mark as `anonymous`.

## Test ID matching

If a note explicitly references a Test ID from the QA workbook (pattern: `PUB-NNN`, `PWA-IOS-NNN`, `PWA-AND-NNN`, `ADM-NNN`, `XPLAT-NNN`, `PWA-ROLE-NNN`), include it in the `linked_test_id` field. Otherwise leave that field empty.

## Output

Produce a single JSON array conforming to `schema.json`. No prose, no commentary. The main session will diff your array against its own extraction and merge new findings.

Be more aggressive than the main session — false positives are cheap (the human triages them out); missed findings are expensive (they fall through the cracks until the next sync).
```

---

## Companion JSON schema (`schema.json`)

The skill writes this to the worktree at `/tmp/gg-codex-qa-{slug}/schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "items": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "item_type": {
        "type": "string",
        "enum": ["bug", "idea", "feedback", "question"]
      },
      "one_line": {
        "type": "string",
        "description": "One-line description of the item, ≤120 chars"
      },
      "surface": {
        "type": "string",
        "enum": [
          "Public Website",
          "PWA iOS",
          "PWA Android",
          "Admin Dashboard",
          "Cross Surface",
          "Docs",
          "unknown"
        ]
      },
      "verbatim": {
        "type": "string",
        "description": "Exact quote from the notes that anchors this extraction"
      },
      "speaker": {
        "type": "string",
        "description": "Speaker name from the attendee list, or 'anonymous'"
      },
      "linked_test_id": {
        "type": ["string", "null"],
        "description": "Matching Test ID from the QA workbook if mentioned (e.g., ADM-006), else null"
      },
      "severity_hint": {
        "type": ["string", "null"],
        "enum": ["P0", "P1", "P2", "P3", null]
      },
      "expected": {
        "type": ["string", "null"],
        "description": "Expected behavior if stated in the notes"
      },
      "actual": {
        "type": ["string", "null"],
        "description": "Observed behavior if stated in the notes"
      },
      "repro_steps": {
        "type": ["string", "null"],
        "description": "Reproduction steps if stated in the notes"
      },
      "suggested_fix": {
        "type": ["string", "null"],
        "description": "Suggested fix from the discussion if stated"
      }
    },
    "required": ["item_type", "one_line", "surface", "verbatim"]
  }
}
```

---

## Idempotent completion handler

When Codex's result file lands at `/tmp/gg-codex-qa-{slug}/codex-result.md`, handle it through this contract whether Phase 3 is still running or has already completed:

1. Parse and validate the JSON array against `schema.json`. If the completed dispatch has no result, malformed JSON, or an empty array, record the failure in `report.md`'s `⚠ Codex failures` block and continue with Claude's extraction only.
2. Compute a SHA-256 digest of the result file. If `tmp/qa-triage/{slug}/codex-merge.json` already records that digest as `handled`, return without changing any artifact.
3. Compute a stable key for each record from its canonical `item_type`, `surface`, whitespace-normalized `verbatim`, and `linked_test_id`. Deduplicate first by a stable key already recorded in `codex-merge.json`, then against `extraction.md` by verbatim substring overlap (a 30-character span is enough because quotes are deliberately not paraphrased).
4. Preserve every prior key-to-item-number assignment in the ledger. Assign each net-new record the next unused `[codex]` item number (for example, `1c.`, `2c.`), add it once to `extraction.md`, and update the ledger atomically after the artifact writes succeed.
5. Run Phase 3 enrichment only for net-new item keys. In `cross-ref.md`, replace an existing block with the same item number/key or append it when absent; never append a duplicate block.
6. Record the result digest, key-to-number map, deduped count, net-new count, `handled` status, and handling timestamp in `codex-merge.json`. The Phase 7 report reads these counts instead of recomputing them.

Invoke the handler on the background-completion notification, before the first Phase 4 triage gate, and immediately before Phase 7 finalization. A result that adds items after Phase 3 reopens enrichment only for those items. If Phase 4 was already presented or locked, present an additive gate for the new numbers and append that decision to `triage.md`; do not rewrite prior choices or silently add the items to Phase 5.

If the finalization checkpoint finds the dispatch still running, do not poll indefinitely and do not clean up its worktree. Keep the run pending and re-enter this handler on the completion notification. Dispatch failure and invalid completed output remain non-blocking fallbacks.
