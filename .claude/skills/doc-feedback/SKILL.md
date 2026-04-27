---
name: doc-feedback
user-invocable: true
description: Process review feedback on any Green Goods Google Doc downloaded as `.docx` — `docs/` drafts, research notes, grant proposals, product feedback. Parses comments and tracked-changes into a triage-able markdown record, then walks through addressing each item with a scope-lock gate between phases and an in-repo or out-of-repo address mode (auto-inferred from doc title/filename). Use when the team has finished reviewing a doc and you have (or can produce) a `.docx` export.
argument-hint: "[<docx-path>] [--mode in-repo|out-of-repo] [--parse-only|--triage|--address]"
version: "1.1.0"
status: active
packages: ["all"]
dependencies: []
last_updated: "2026-04-26"
last_verified: "2026-04-26"
---

# Doc Feedback Skill

External-review intake for any Green Goods Google Doc — `docs/` drafts, research notes, grant proposals (NLnet, Octant, Mirror), product-feedback intake, ADR drafts, strategy memos.

The recurring pattern: a doc gets shared in Google Docs, the team leaves comments and tracked-change suggestions, and the writer needs to walk back through and address each item. The `.docx` export is the only feedback channel that survives offline — Google's connector tools don't expose comments.

The address phase splits into two modes because the destination of addressed work varies — sometimes edits land in repo files (`docs/`, `.plans/`), sometimes they're replies/edits to be pasted back into the original Google Doc or an external portal. The skill infers the mode from the doc and confirms with you before editing.

## Activation

Use when:

- the team has finished commenting on a Google Doc and you have a `.docx` export
- you say "address the doc comments", "process the docx feedback", "apply the team's review on X"
- a `.docx` shows up under `~/Downloads/` after a review pass

Skip when:

- review feedback lives in a GitHub PR (use `/review` instead)
- review is verbal or in chat (capture as ADR or session note instead)
- the doc has zero open comments and zero tracked changes (parse confirms — then stop)

## Invocation

```text
/doc-feedback                            # locate a .docx, parse, triage gate, address
/doc-feedback <path>                     # explicit input path
/doc-feedback --parse-only               # phase 1 only — write feedback.md and stop
/doc-feedback --triage                   # resume at triage gate (already parsed)
/doc-feedback --address                  # resume at address phase (triage approved)
/doc-feedback --mode in-repo             # force in-repo address mode (skip inference)
/doc-feedback --mode out-of-repo         # force out-of-repo address mode (skip inference)
```

The path may be absolute, relative, or a `~/Downloads/...` reference. If omitted, hunt the newest `.docx` in `~/Downloads/` whose name plausibly matches recent work and confirm before parsing.

## Execution Model

- **Phased with a scope-lock gate**: parse → user-approved triage → address. Never edit files in phase 1 or 2.
- **Source-of-truth is the parsed `feedback.md`** under `.plans/doc-feedback/<slug>/`, not the `.docx`. The `.docx` lives where it was downloaded (usually `~/Downloads/`); do **not** copy it into the repo.
- **One comment at a time** in phase 3 — read the target file, edit, tick the checklist, move on. No batch sweeps.
- **Do not auto-commit**. Surface a suggested commit grouping at the end; let the user run `/ship`.

## Phases

### Phase 1 — Parse

1. Resolve the `.docx` path. If ambiguous, list candidates and ask.
2. Pick `<slug>` = lowercase-hyphenated doc title (or `.docx` filename stem if title is generic). Preserve hyphens, drop punctuation.
3. Run the parser:

   ```sh
   bun scripts/harness/parse-docx-feedback.ts <docx-path> \
     --out .plans/doc-feedback/<slug>/feedback.md
   ```

4. Read `feedback.md` and surface a one-line summary: doc title (or filename), comment count, inserted-run count, deleted-run count.

If `--parse-only`, stop here and report the path.

### Phase 2 — Triage gate

Two steps. Surface both before letting the user answer.

#### Step 1 — Infer address mode

Address mode determines where edits land in Phase 3:

- **in-repo** — edits go into repo files (`docs/`, `.plans/<feature>/`, `.plans/adr/`, etc.)
- **out-of-repo** — produce `.plans/doc-feedback/<slug>/responses.md` with copy-pasteable replies/edits for the original Google Doc, Mirror, NLnet portal, etc. No repo files touched.

Inference rules, applied in order — first match wins:

1. CLI `--mode in-repo` or `--mode out-of-repo` → that mode, skip the rest
2. Doc title or filename contains a `docs/` path component, or `ADR`, or matches an existing `.plans/<feature>/` slug → **in-repo**
3. Filename matches `*proposal*`, `*grant*`, `*nlnet*`, `*octant*`, `*mirror*`, `*feedback*`, `*research*`, `*memo*` → **out-of-repo**
4. Otherwise: ask once.

Surface the inferred mode (e.g. *"Inferring **out-of-repo** mode from filename `nlnet-evidence-commons.docx`"*) and let the user override before continuing. Don't silent-default.

#### Step 2 — Triage list

Produce a numbered list, one row per **open comment** plus one block summarising tracked-change suggestions. For each comment:

- `N. [^cid]` — comment id from `feedback.md`
- 1-line distillation of the comment body
- **Anchor**: the quoted text being commented on (truncated)
- **Suspected target** (in-repo mode only): best-guess file path under `docs/` or other repo location, or `?` if not inferable. Skip this column in out-of-repo mode.

Then ask: **"Which numbers to address, defer, or decline?"** Wait for explicit selection. Do **not** edit anything until the user answers.

Write the user's selection into `.plans/doc-feedback/<slug>/checklist.md` as:

```markdown
- [ ] [^cid] one-line title — `target/file.mdx` — accept|defer|decline   # in-repo
- [ ] [^cid] one-line title — gdoc reply — accept|defer|decline          # out-of-repo
```

### Phase 3 — Address

Behavior branches on the address mode locked in Phase 2.

#### in-repo mode

For each accepted item, in order:

1. Read the target file.
2. Make the smallest edit that resolves the comment. If the comment is a question, answer it inline or in the linked context — don't add a comment to the file.
3. For tracked-change suggestions in the body (`{++inserted++}` / `{--deleted--}`), treat each segment as a proposal: apply if the user accepted that range during triage, otherwise leave alone.
4. Tick the matching `checklist.md` line.
5. Move to the next item.

When all accepted items are addressed:

- Run touched-package verification: `bun lint && bun run test` scoped to whichever packages were edited.
- Surface a suggested commit grouping (e.g. "all `docs/concepts/*` edits → `docs(concepts): apply review`").
- Do **not** run `/ship` yourself — let the user.

#### out-of-repo mode

The output is a single markdown file the user copies from. **No repo files are edited.**

Append one entry per accepted item to `.plans/doc-feedback/<slug>/responses.md`:

```markdown
## [^cid] — to <author>

> <quoted anchor text from the original comment>

**Reply / proposed edit:**

<the response or edited paragraph, in plain markdown that pastes cleanly into a Google Doc reply or a Mirror/portal text field>

**Apply notes:** <where in the doc to paste it, or "reply to comment thread", or "replace anchor text with the edit above">

---
```

Then tick the matching `checklist.md` line and move on.

When all accepted items are addressed:

- Surface "ready to paste from `responses.md`" with the file path.
- For grant portals (NLnet, Octant): note that comment replies usually go in the GDoc, but proposed-edit blocks may need to be pasted into the portal's revision field separately. Don't assume a single destination.
- Suggest archiving `<slug>/` to `.plans/doc-feedback/done/<slug>/` after the user confirms they've pasted the responses.

## Output Contract

| Phase | Output |
|-------|--------|
| 1     | One-line summary + path to `feedback.md` |
| 2     | Inferred address mode (with reason) + numbered triage list, ending with the accept/defer/decline question. No edits. |
| 3 (in-repo)     | Per-item: file edited + brief change summary + checklist tick. End with totals + touched-package verification + suggested commit grouping. |
| 3 (out-of-repo) | Per-item: appended block in `responses.md` + checklist tick. End with totals + path to `responses.md` + paste-destination notes. |

## Conventions

- **Workspace**: `.plans/doc-feedback/<slug>/` — contains `feedback.md` (parser output) and `checklist.md` (triage decisions). Both checked into git as a record of what came in and how it was processed.
- **Slug collisions**: same slug on a re-review → suffix with `-yyyy-mm-dd` (the date of the .docx, not today).
- **Resolved comments**: Google Docs drops resolved comments on `.docx` export — what you parse is the open set, by definition. Don't waste cycles inferring resolved-status.
- **Reply threads**: Word's flat format means replies appear as separate `<w:comment>` entries in arrival order, sharing no thread id. Treat each as standalone unless the body clearly references another.
- **Multi-paragraph anchors**: a `[^N:` and its closing `]` may span paragraphs. Read the whole quoted-anchor block in `feedback.md` for context.
- **Don't commit the `.docx`**: keep it in `~/Downloads/` or wherever it landed. The parsed `feedback.md` is the durable record.

## Failure Modes

- **`.docx` not a real docx** → `unzip -p` fails on `word/document.xml`. Confirm the file is the Word export, not PDF or `.gdoc` shortcut.
- **No `word/comments.xml`** → no comments existed, only tracked changes. Parser handles this; surface "no comments, N tracked-change runs" and pivot to suggestion-only triage.
- **Comment anchor text doesn't match `docs/` content** → the doc has drifted from the repo. Flag as a research item; don't guess at a target file.
- **Parser regex breaks on unusual XML** → Word XML for headings/runs is stable but new constructs (e.g. `<w:sdt>` content controls) may show up. If a paragraph renders empty in `feedback.md`, escalate the parser fix rather than working around it.

## Related Skills

- `/review` — for in-repo PR diffs (different surface)
- `/ship` — pre-merge gate to run after addressing
- `plan` — if the feedback expands into multi-package work, hand off to a feature plan
