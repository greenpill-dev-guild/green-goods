# Codex Prompt Template — `/qa-triage`

The skill renders this template into the Codex worktree at `/tmp/gg-codex-qa-<slug>/qa-prompt.md`. Substitute `{notes_path}`, `{meeting_title}`, `{meeting_date}`, and `{slug}` before dispatch.

When Codex auto-dispatch fails or `--no-codex` is set, the skill copies this rendered prompt to `.plans/qa-triage/<slug>/codex-prompt.md` and surfaces the path for manual copy-paste.

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

## Merging Codex's output into Phase 3

When Codex's result file lands at `/tmp/gg-codex-qa-{slug}/codex-result.md`, the main session:

1. Parses the JSON array.
2. For each Codex item, dedupes against Claude's `extraction.md` by `verbatim` substring overlap (a 30-char span match is enough — the verbatim quotes are deliberately not paraphrased).
3. New items get appended to `extraction.md` with a `[codex]` prefix on the item number (e.g., `1c.`, `2c.`).
4. Phase 3 enrichment runs on the merged set.
5. The Phase 7 report logs how many Codex items deduped vs added net new.

If Codex returns malformed JSON or an empty array, log to `report.md`'s `⚠ Codex failures` block and continue with Claude's extraction only. Never block.
