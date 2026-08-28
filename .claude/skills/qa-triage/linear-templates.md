# Linear Body Templates — `/qa-triage`

These templates mirror [`bug-intake`](../../../docs/routines/bug-intake.md) Phase 3's body shape, adapted for the interactive single-source case (no Discord ack, no daily summary — those belong to the routine).

**Drop any section you cannot fill.** A heading followed by `—`, "needs repro",
or a paragraph explaining that PostHog matched nothing costs the reader a stop
and tells them nothing; report tooling gaps in the run summary instead. The
issue body obeys the caps in
[`.claude/context/linear-routing-rules.md`](../../context/linear-routing-rules.md)
§ Issue structure — **3 headings, ~150 words, 300 ceiling** — and a
`PreToolUse` hook blocks writes that break them. A defect usually needs zero
headings: the problem in prose, a short **Done when**, one source line.

---

## Linear API constraints (apply before drafting)

Three hard constraints Linear enforces on every payload:

1. **`ai:*` is single-value-per-Issue.** Only ONE of `ai:claude`, `ai:codex`, `ai:routine` may be applied. When both an "origin" agent and a "delegate-to" agent apply to the same Issue (e.g., Claude created it, Codex is fixing it), the **delegate-to** wins as the label; the originating agent goes in a comment, not the body (the `## Provenance` section was retired 2026-08-27). If only one role applies (no delegation), use the originating agent. **When to route to Codex:** apply `ai:codex` when the Issue clears the **Codex-ready bar** (clear behavior + named surface + suggestable fix + validation — see [`docs/routines/README.md` § Codex hand-off](../../../docs/routines/README.md)); also set the Linear **delegate** to the Codex agent (the human stays assignee/reviewer) when it clears the **autonomous-confident bar** (concrete fix + bounded non-`critical` surface + mechanical + validation). Otherwise keep `ai:routine` / the originating agent.
2. **`package:*` is single-value-per-Issue.** When a bug spans two packages (e.g., admin display + indexer enrichment, or shared hook + client view), the **primary surface** wins as the label; the secondary package(s) are named in the problem sentence (the `## Surface` block is retired) with a one-line note explaining the constraint.
3. **Customer Needs cannot be standalone.** Linear's API requires `Exactly one of projectId or issueId must be defined` — every Customer Need must link to an Issue via the `issue` parameter. There is no standalone Need disposition; use `track-only` (Customer Need + lightweight Backlog tracking Issue).

---

## Customer Need body (terse — source-of-truth raw signal)

The Customer Need is the durable record of what the reporter said. Keep it minimal: verbatim + speaker + link to the Issue. The Issue body holds the actionable detail (Reproduction / Expected / Actual / Suggested fix / PostHog evidence / Deploy correlation). Avoid duplicating Issue content here — the `issue` link is the integration.

```markdown
## Source
QA Sync — <meeting-title> on <YYYY-MM-DD>. Speaker: <name | "anonymous">. [Notes](<drive-url>)

> <verbatim excerpt — scrubbed of any name not on the call's attendee list>

## Linked Issue
[PRD-XXX](<linear-url>) (<status>, <priority>) — Issue carries the actionable detail, repro steps, PostHog evidence, and suggested fix.
```

That's it. Two paragraphs, max. No `## Need statement` (the verbatim quote IS the need statement). No `## Reporter context` beyond the Speaker line (other attendees are on the Drive notes one click away). No PostHog evidence or Deploy correlation block (those live on the Issue). The Customer Need is the raw signal anchor; the Issue is where work happens.

**Labels (Customer Need)**: the Linear API surface for `save_customer_need` accepts `body`, `customer`, `issue`, `project`, `priority` — **no `labels` field**. Labels live exclusively on the linked Issue. The fields `protocol:green-goods`, `source:drive`, `ai:claude` (formerly listed here) belong on the linked Issue's label set.

**Required link**: every Customer Need must carry an `issue` (or `project`) parameter. Linear's API rejects with `Exactly one of projectId or issueId must be defined` otherwise. There is no standalone Need path — use the track-only pattern below for items that should be recorded without claiming committed fix work.

**Workflow state**: Customer Needs have no workflow state — they're raw-signal records that live alongside the Issue they're linked to.

---

## Issue body (only when the item crosses both bars: actionable description + named surface)

```markdown
<What breaks, for whom, and where — one or two short paragraphs of plain
prose. Fold the surface and the trigger into the sentence rather than giving
each its own heading: "Editing a garden and changing its image makes the edit
impossible to cancel — the operator has to reload. Leaving the image alone and
cancelling works fine, so the image change is the trigger.">

**Done when**
- <observable, checkable outcome>
- <second outcome, if the fix has two halves>

<One source line. Add a single counts line only when telemetry is the
evidence: "PostHog: 31 occurrences across 12 sessions, 4 users, first seen
2026-08-07.">
QA Sync — <meeting-title> on <YYYY-MM-DD>. [Notes](<drive-url>)
```

The Issue is the **actionable surface**; the linked Customer Need holds the
verbatim quote and reporter context, so the Issue never repeats them.

**What is deliberately not in this template**, because every instance of it in
the 2026-08-27 board audit made the issue worse:

* **No `## Reproduction` / `## Expected` / `## Actual` trio for a defect a
  sentence already explains.** Keep numbered repro steps only when the path is
  genuinely non-obvious — then they are the body's one heading.
* **No "we found nothing" evidence block.** If PostHog did not match, say
  nothing here and note the gap in the run summary. Absence of a signature is
  not evidence, and it never changes what the reader does next.
* **No `## Deploy correlation` section.** When a deploy *is* the suspect, that
  is one sentence in the problem paragraph ("started with the 2026-08-24
  deploy") — not a block.
* **No `## Provenance` section.** Labels carry origin and delegate. If both
  genuinely apply and `ai:*` can only hold one, put the other in a comment.
* **No second copy of the finding.** Do not append an "Authoritative QA
  finding" block restating the defect the body already described.

> **Link asymmetry is intentional.** The Customer Need's `## Linked Issue` carries a clickable `[PRD-XXX](https://linear.app/.../PRD-XXX)` URL because Linear Issues expose stable web URLs. The Issue's source line, by contrast, refers to "the linked Customer Need" without a clickable URL — Linear's `save_customer_need` API returns `url: null` and Customer Needs are surfaced from the linked Issue's right rail rather than a standalone page. Do not "fix" this by hand-building a Customer Need URL pattern; the asymmetry is a Linear-platform property, not a template bug.

**Secondary packages go in the problem sentence, not a `## Surface` block** — that heading is retired along with the rest of the section scaffolding. When a bug spans more than one package, name the second one in prose:

> Approving work fails on the admin members panel. The display side is `package:admin`; the enrichment it reads comes from `package:indexer`, and only `package:admin` is on the label set because Linear allows one `package:*` per issue.

**Labels (Issue)** — Linear enforces single-value-per-group on `ai:*` and `package:*`; the rules below assume one value per family:

- `protocol:green-goods` — always.
- `package:*` (one only) — one of `package:client`, `package:admin`, `package:shared`, `package:contracts`, `package:indexer`, `package:agent`, `package:docs`. The **primary surface** wins as the label; secondary packages are named in the body's `## Surface` block. Omit only when the surface is genuinely unknown.
- `activity:qa` — confirmed bug or behavioral defect.
- `activity:maintenance` — cleanup or polish that isn't a user-visible defect.
- `activity:architecture` — strategic / architectural work (e.g., cross-device account recovery, auth-flow rework).
- `source:drive` — provenance still matters for triage.
- `ai:*` (one only) — `ai:claude` (interactive Claude Code), `ai:codex` (delegated to Codex), `ai:routine` (cron'd routine writes). When both an origin and a delegate-to apply, the **delegate-to** wins as the label; the originating agent goes in a comment, not the body (the `## Provenance` section was retired 2026-08-27). The interactive `qa-triage` skill defaults to `ai:claude` unless the user picks Codex delegation in the assignee dialog.

**Workflow state**:
- `Todo` when surface + behavior are clear and a fix path is suggestable.
- `Backlog` when the fix is exploratory.
- Never `In Progress`, `In Review`, `Done`, or `Cancelled` — humans drive those transitions.

---

## Recurring-pattern parent Issue (when PostHog confirms ≥50 sessions in 30d)

When Phase 3 surfaces a `[derived:recurring]` item and the user approves it in Phase 4, file the parent Issue with the shape below.

```markdown
<What keeps failing, for whom, and on which surface — two or three plain
sentences naming the redacted top-line message.>

Seen <S> sessions and <U> users over 30 days, first <YYYY-MM-DD>, last
<YYYY-MM-DD>. Error hash `<posthog-error-hash>`.

**Done when**
- <the observable recovery — the failing path succeeds again, or the error is
  understood and deliberately accepted>

## Linked Customer Needs
<bullet list of Linear URLs for every Customer Need this run associates with this hash>
```

This parent is filed as `Todo`, so **`Done when` is required** — without checkable outcomes a Codex hand-off stops at the readiness gate. If no outcome can be named yet, file it `Backlog` instead.

**Labels**: `protocol:green-goods`, `activity:qa`, `package:<inferred>`, `ai:claude`, plus `pattern:posthog-<hash-prefix>` if the pattern label family exists on the team. If `pattern:*` is missing, fail loud and skip the recurring-pattern parent rather than inventing a label.

**Title format**: a plain verb-led sentence naming the failure — "Fix the credential request that never resolves on garden join". The `Recurring:` prefix was retired 2026-08-27 (a `PreToolUse` hook rejects it); the `pattern:posthog-*` label is what marks this as the recurring parent.

---

## Quoting from notes

When pulling verbatim from Gemini notes, scrub anything that names a person not already on the meeting's attendee list. The attendee list is part of the body's `Reporter context` section — names there are intentional and already visible to anyone in the source channel. Names elsewhere in the notes (mentioned in passing, third-party references) should be scrubbed to `<person>` or paraphrased.

The verbatim block is **public** in the Linear body. Private context (the reporter's wallet, their distinct ID, their replay URL) stays out — those fields belong only in the QA Sheet's PostHog columns under the explicit private-internal exception.

---

## Track-only pattern

Linear's API requires every Customer Need to link to an Issue (or Project). Items the skill would have classified as track-only — feedback, ideas, strategic gaps, clarifications — still get an Issue, just a lightweight one with no fix urgency.

- **Label**: `activity:maintenance` (default for UX polish, copy fixes, low-urgency feature gaps) **or** `activity:architecture` (for strategic items tied to a larger rework — e.g., cross-device account recovery).
- **Priority**: Low (P3) or Medium (P2). Never P0/P1 — those are real bugs and use the main pattern instead.
- **Status**: `Backlog`. The tracking Issue isn't claimed as committed work; it's a tracking surface for the Customer Need to attach to.
- **Title**: a plain sentence, same as any other issue. **The `[tracking]`
  prefix is retired** (2026-08-27) — the `maintenance` label plus the `Backlog`
  state already say this is uncommitted signal, and the prefix cost scan width
  on every board view. Write `Bring back the Positions section on the public
  site`, not `[tracking] Positions UI (missing)`. A `PreToolUse` hook rejects
  the prefix. Promotion to real work is now purely a label/state/priority
  change, with no title edit.
- **Body**: shorter than a bug Issue — the ask in prose, then one source line.
  No Reproduction / Expected / Actual, no Surface heading.
- **Body template** for a tracking Issue:

```markdown
<One short paragraph: what the person wants or what is missing, and why it
matters to them. Name the surface inside the sentence.>

<What it would take, in one sentence — "needs a design call" or "needs a
product call" is a legitimate answer.>

QA Sync — <meeting-title> on <YYYY-MM-DD>. Speaker: <name>. [Notes](<drive-url>)
```

The Customer Need then links to this Issue via the `issue` parameter and carries the full verbatim quote + Reporter context in its body.

---

## Disposition resolution

Linear's API constraint that Customer Needs must link to an Issue eliminates the standalone Need column. Every accepted item gets an Issue — main or lightweight track-only.

| Item shape | Issue type | Issue status | Customer Need |
|---|---|---|---|
| Clear bug + named surface + suggestable fix | Main (`activity:qa`) | `Todo` | Yes, linked |
| Bug with no repro or no clear surface | Main (`activity:qa`) | `Backlog` | Yes, linked |
| Idea / feature request / UX polish | Attach (`activity:maintenance`) | `Backlog` | Yes, linked |
| Steward pain — "this is awkward" | Attach (`activity:maintenance`) | `Backlog` | Yes, linked |
| Strategic gap tied to architecture rework | Attach (`activity:architecture`) | `Backlog` | Yes, linked |
| Question / "me too" / no actionable content | Skip both | — | No |
| Duplicate of existing record | No new Issue | — | Comment on existing if user wants the verbatim preserved |
| `[derived:posthog]` accepted in Phase 4 | Main (`activity:qa`) | `Todo` | Yes, linked (telemetry-only body) |
| `[derived:test-fail]` accepted in Phase 4 | Main (`activity:qa`) | `Todo` | Yes, linked (Test ID reference) |
| `[derived:recurring]` accepted in Phase 4 | linked to parent Issue | yes (recurring-pattern parent) |

The default for ambiguous items is **track-only** — create a Customer Need linked to a lightweight Backlog tracking Issue. The Issue exists only because Linear requires a link target; it is not committed work until a human promotes it.
