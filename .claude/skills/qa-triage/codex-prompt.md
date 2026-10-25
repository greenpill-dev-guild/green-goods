# Codex Prompt Template — `/qa-triage`

Render the template as `tmp/qa-triage/<slug>/codex-prompt.md` before dispatch. Set `{notes_path}` to `qa-notes.md`, relative to the child working root, and substitute `{meeting_title}`, `{meeting_date}`, and `{slug}`. Write the companion schema beside it.

When Codex auto-dispatch fails or `--no-codex` is set, the skill copies this rendered prompt to `tmp/qa-triage/<slug>/codex-prompt.md` and surfaces the path for manual copy-paste.

---

## Dispatch mechanics (Phase 2)

Pattern source: this repository's QA-triage skill and the rendered prompt below. Do not depend on maintainer-specific paths or private memory files.

```bash
set -euo pipefail
CODEX="$(.claude/scripts/resolve-codex-binary.sh)"
RUN_DIR="$(pwd)/tmp/qa-triage/<slug>"
EXTRACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/gg-codex-qa.XXXXXX")"
printf '%s\n' "$EXTRACT_DIR" > "$RUN_DIR/codex-scratch-path.txt"

# Copy contents, including a symlinked notes source, into the isolated working root.
# Render codex-prompt.md beforehand with {notes_path} set to qa-notes.md.
cp -L -- "$RUN_DIR/notes.md" "$EXTRACT_DIR/qa-notes.md"
cp -- "$RUN_DIR/schema.json" "$EXTRACT_DIR/schema.json"
cp -- "$RUN_DIR/codex-prompt.md" "$EXTRACT_DIR/qa-prompt.md"

CODEX_ENV=(
  "HOME=$HOME"
  "PATH=$PATH"
  "TMPDIR=${TMPDIR:-/tmp}"
  "SHELL=${SHELL:-/bin/zsh}"
  "LANG=${LANG:-C.UTF-8}"
)
[ -n "${CODEX_HOME:-}" ] && CODEX_ENV+=("CODEX_HOME=$CODEX_HOME")

# The CLI writes the final result for the parent; model-generated shell work is read-only.
# The scratch directory has no Git checkout. Closed stdin avoids waiting for more input.
env -i "${CODEX_ENV[@]}" \
  "$CODEX" exec -s read-only --ephemeral --skip-git-repo-check -C "$EXTRACT_DIR" \
  -o "$RUN_DIR/codex-result.md" \
  --output-schema "$EXTRACT_DIR/schema.json" \
  "$(cat "$EXTRACT_DIR/qa-prompt.md")" < /dev/null
```

Fire via `Bash` with `run_in_background: true`, keeping the `< /dev/null` redirect. The clean
environment intentionally excludes parent service credentials and any root `.env`, while preserving
a configured `CODEX_HOME` so the CLI retains its own authentication, configuration, and installed
skills. A machine-level privacy profile can be layered with `-p <name>` only if that profile still
loads (`codex exec -p <name> --version` is a cheap check). This extraction pass needs only the
rendered notes and schema. The shared resolver honors a valid `CODEX` override, then checks the
installed ChatGPT.app and Codex.app bundles before falling back to `codex` on `PATH`. The child receives only the three copied inputs; this flow creates no branch or worktree.
Fallbacks and Phase 7 cleanup rules stay in the skill workflow references.

Verify flags against `codex exec --help` before changing this snippet; the CLI renames them between
releases and a rejected flag fails the run before any model call.

### Scratch ownership and completion

Record the current child's directory in `codex-scratch-path.txt`; never infer ownership from a
glob or a slug. Keep that directory on failure, dry run, or while the child is running. After its
result is handled and the confirmed writes succeed, remove only the recorded current-run scratch.
Prior Git worktrees belong to their original runs and require a separately authorized cleanup.

---

## Template (copy the rendered prompt into scratch)

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
- `PWA` — the client app as one merged surface: desktop PWA shell or device-unspecified observations (catalog v2's active tab; use the platform values below only when the notes name a device)
- `PWA iOS` — installed PWA on iOS Safari
- `PWA Android` — installed PWA on Android Chrome
- `Admin Dashboard` — admin cockpit (Hub, MainSheet, AdminDialog overlays, AdminSideSheet, FabButton, /hub/*, /garden/*, /community/*)
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

If a note explicitly references a Test ID from the QA workbook or repo catalog (pattern: `PUB-NNN`, `PWA-NNN`, `PWA-IOS-NNN`, `PWA-AND-NNN`, `PWA-ROLE-NNN`, `ADM-NNN`, `XPLAT-NNN`, `DOCS-NNN`), include it in the `linked_test_id` field. Otherwise leave that field empty.

## Output

Produce a single JSON object conforming to `schema.json`: `{"items": [ ...one record per item... ]}`. No prose, no commentary. The main session will diff the `items` array against its own extraction and merge new findings.

Be more aggressive than the main session — false positives are cheap (the human triages them out); missed findings are expensive (they fall through the cracks until the next sync).
```

---

## Companion JSON schema (`schema.json`)

Write this to `tmp/qa-triage/{slug}/schema.json`; dispatch copies it into the child scratch directory.

`--output-schema` is enforced by OpenAI's strict structured-output mode, which rejects two things a
plain JSON Schema allows: a top-level array (the root must be an object) and a `required` list that
omits any declared property. That is why the records are wrapped in an `items` array and every
property is required; optional fields stay optional by allowing `null`.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "additionalProperties": false,
  "required": ["items"],
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": [
          "item_type",
          "one_line",
          "surface",
          "verbatim",
          "speaker",
          "linked_test_id",
          "severity_hint",
          "expected",
          "actual",
          "repro_steps",
          "suggested_fix"
        ],
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
              "PWA",
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
            "description": "Matching Test ID from the QA workbook or repo catalog if mentioned (e.g., ADM-006 or DOCS-003), else null"
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
        }
      }
    }
  }
}
```

---

## Idempotent completion handler

When Codex's result file lands at `tmp/qa-triage/{slug}/codex-result.md`, handle it through this contract whether Phase 3 is still running or has already completed:

1. Parse the result as JSON and take its `items` array (a bare top-level array from a pre-2026-08 run is accepted as the same thing); validate the records against `schema.json`. If the completed dispatch has no result, malformed JSON, or an empty `items` array, record the failure in `report.md`'s `⚠ Codex failures` block and continue with Claude's extraction only.
2. Compute a SHA-256 digest of the result file. If `tmp/qa-triage/{slug}/codex-merge.json` already records that digest as `handled`, return without changing any artifact.
3. Compute a stable key for each record from its canonical `item_type`, `surface`, whitespace-normalized `verbatim`, and `linked_test_id`. Deduplicate first by a stable key already recorded in `codex-merge.json`, then against `extraction.md` by verbatim substring overlap (a 30-character span is enough because quotes are deliberately not paraphrased).
4. Preserve every prior key-to-item-number assignment in the ledger. Assign each net-new record the next unused `[codex]` item number (for example, `1c.`, `2c.`), add it once to `extraction.md`, and update the ledger atomically after the artifact writes succeed.
5. Run Phase 3 enrichment only for net-new item keys. In `cross-ref.md`, replace an existing block with the same item number/key or append it when absent; never append a duplicate block.
6. Record the result digest, key-to-number map, deduped count, net-new count, `handled` status, and handling timestamp in `codex-merge.json`. The Phase 7 report reads these counts instead of recomputing them.

Invoke the handler on the background-completion notification, before the first Phase 4 triage gate, and immediately before Phase 7 finalization. A result that adds items after Phase 3 reopens enrichment only for those items. If Phase 4 was already presented or locked, present an additive gate for the new numbers and append that decision to `triage.md`; do not rewrite prior choices or silently add the items to Phase 5.

If the finalization checkpoint finds the dispatch still running, do not poll indefinitely and do not clean up its scratch directory. Keep the run pending and re-enter this handler on the completion notification. Dispatch failure and invalid completed output remain non-blocking fallbacks.
