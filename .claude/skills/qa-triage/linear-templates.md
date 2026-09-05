# Linear Body Templates — `/qa-triage`

These templates mirror [`bug-intake`](../../../docs/routines/bug-intake.md) Phase 3's body shape, adapted for the interactive single-source case (no Discord ack, no daily summary — those belong to the routine).

**Drop any section you cannot fill.** A heading followed by `—`, "needs repro",
or a paragraph explaining that PostHog matched nothing costs the reader a stop
and tells them nothing; report tooling gaps in the run summary instead. The
issue body follows the length principles in
[`.claude/context/linear-routing-rules.md`](../../context/linear-routing-rules.md)
§ Issue structure — clear, simple, concise, human-friendly; as long as it needs
to be, as short as it can be — with **6-heading / 600-word backstops** that a
`PreToolUse` hook enforces. A defect usually needs zero
headings: the problem in prose, a short **Done when**, one source line.

---

## Linear API constraints (apply before drafting)

Three hard constraints Linear enforces on every payload:

1. **`ai:*` is single-value-per-Issue.** Only ONE of `ai:claude`, `ai:codex`, `ai:routine` may be applied. When both an "origin" agent and a "delegate-to" agent apply to the same Issue (e.g., Claude created it, Codex is fixing it), the **delegate-to** wins as the label; the originating agent goes in a comment, not the body (the `## Provenance` section was retired 2026-08-27). If only one role applies (no delegation), use the originating agent. **When to route to Codex:** apply `ai:codex` when the Issue clears the **Codex-ready bar** (clear behavior + named surface + suggestable fix + validation — see [`docs/routines/README.md` § Codex hand-off](../../../docs/routines/README.md)); also set the Linear **delegate** to the Codex agent (the human stays assignee/reviewer) when it clears the **autonomous-confident bar** (concrete fix + bounded non-`critical` surface + mechanical + validation). Otherwise keep `ai:routine` / the originating agent.
2. **`package:*` is single-value-per-Issue.** When a bug spans two packages (e.g., admin display + indexer enrichment, or shared hook + client view), the **primary surface** wins as the label; the secondary package(s) are named in the problem sentence (the `## Surface` block is retired) with a one-line note explaining the constraint.
3. **Customer Needs cannot be standalone.** Linear's API requires `Exactly one of projectId or issueId must be defined` — every Customer Need must link to an Issue via the `issue` parameter. There is no standalone Need disposition; use `track-only` (Customer Need + lightweight Backlog tracking Issue).

---

## QA Test ID linkage

Every Issue sourced from a `qa-session` deferred handoff, and every accepted
`[derived:test-fail]` item, must carry its exact catalog Test ID. Resolve it before drafting and add
the exact ID to the Issue's source line (`Test ID: ADM-012.`). Put the same value in the Defects row's
`Linked Test ID` field.

If a session-derived item has no exact `case:` ID, pause that item and ask the user to select the
catalog case. Do not file it with an OBS number, Defect ID, blank value, or fuzzy guess. This is the
reverse-lookup contract in [`.claude/context/qa.md`](../../context/qa.md): a case finds its open
Issue, and the Issue returns to the case definition.

---

## Customer Need body (terse — source-of-truth raw signal)

The Customer Need is the durable record of what the reporter said. Keep it minimal: verbatim + speaker + link to the Issue. The Issue holds the actionable detail — the problem in prose with **Done when** outcomes in the body, and the safe PostHog/deploy enrichment in its first comment. Avoid duplicating Issue content here — the `issue` link is the integration.

```markdown
## Source
QA Sync — <meeting-title> on <YYYY-MM-DD>. Speaker: <name | "anonymous">. [Notes](<drive-url>)

> <verbatim excerpt — scrubbed of any name not on the call's attendee list>

## Linked Issue
[PRD-XXX](<linear-url>) (<status>, <priority>) — Issue carries the actionable detail; its first comment carries the safe PostHog/deploy enrichment.
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

For a `source:qa-session` Issue, replace the QA Sync source line with:

```markdown
QA session — <session-slug>. Test ID: `<ID>`.
```

For an accepted `[derived:test-fail]` Issue, append the exact Test ID to its source line in the
same format.

The Issue is the **actionable surface**; the linked Customer Need holds the
verbatim quote and reporter context, so the Issue never repeats them.

### Evidence comment (first comment on the Issue)

When Phase 3 produced a PostHog match or a deploy correlation, the safe
enrichment goes in the Issue's **first comment**, posted right after the Issue
is created — never back into the body, and never left only in the scratch
workspace, which the run deletes on success:

```markdown
PostHog `<error-hash>` — <S> sessions / <U> users over 30d, first <date>,
last <date>, match confidence <high|medium|low>.
Deploy correlation: `<commit-sha>` deployed <timestamp> ([compare](<url>)).
```

Drop the deploy line when no deploy sits in the window, and drop the whole
comment when PostHog matched nothing. The comment obeys the same privacy
boundary as the body — error hash, counts, and commit SHAs are safe; replay
URLs, session IDs, distinct IDs, and reporter identifiers never appear — and
the Phase 6 grep covers it like any other comment. Grep the draft before
posting; a comment is public the moment it lands.

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
- `package:*` (one only) — one of `package:client`, `package:admin`, `package:shared`, `package:contracts`, `package:indexer`, `package:agent`, `package:docs`. The **primary surface** wins as the label; secondary packages are named in the problem sentence (the `## Surface` block is retired). Omit only when the surface is genuinely unknown.
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
```

This parent is filed as `Todo`, so **`Done when` is required** — without checkable outcomes a Codex hand-off stops at the readiness gate. If no outcome can be named yet, file it `Backlog` instead.

**The contributing Customer Needs are not listed in the body.** Link each one through Linear's relation surface, which renders them in the right rail and stays correct as the list grows. A markdown copy is a second home for the same fact, and an unbounded one — the body has a 600-word backstop, so a long-lived pattern would eventually make its own refresh unwritable.

**Labels**: `protocol:green-goods`, `activity:qa`, `package:<inferred>`, `ai:claude`, plus `pattern:posthog-<hash-prefix>` if the pattern label family already exists on the team — a pre-existing exception to the label-namespace list in [`linear-routing-rules.md`](../../context/linear-routing-rules.md) § Invariant rules: use it only where it already exists, never create the family. If `pattern:*` is missing, fail loud and skip the recurring-pattern parent rather than inventing a label.

**Title format**: a plain verb-led sentence naming the failure — "Fix the credential request that never resolves on garden join". The `Recurring:` prefix was retired 2026-08-27 (a `PreToolUse` hook rejects it); the `pattern:posthog-*` label is what marks this as the recurring parent.

---

## QA session report — parent Issue (`/qa-triage --call` + the `qa-call-report` routine)

One per QA call, titled exactly `QA session YYYY-MM-DD` — a second call on the same date appends
its counter, `QA session YYYY-MM-DD · 2`, which is also that call's identity for parent lookup
and reuse. That title shape (date required; only the ` · N` counter may follow it) is what earns
the word-backstop exemption in the lint hook. The report is the session's durable record in
Linear; slices attach as **sub-issues via `parentId`**, so the board shows one collapsible tree per
session and an agent with only Linear access can navigate parent → slices.

```markdown
<Two or three sentences a teammate would write: what was walked, by how many
testers, on which surfaces, and the headline — "P0 coverage is green except
review actions; two cross-surface failures trace to shared date handling.">

Build under test: client `<sha>` · admin `<sha>`
Environment: <production | beta (staging) | local — the session default; a verdict taken elsewhere carries a `[beta]`/`[prod]` note prefix>

## Results by priority
- P0: <walked>/<total> — <pass> pass · <fail> fail · <blocked> blocked · <na> n/a · <noted> noted only
- P1: <walked>/<total> — …
- P2: <walked>/<total> — …

## Results by kind
- Journey: <walked>/<total> — …
- Transaction: <walked>/<total> — …
- <one line per catalog kind, in catalog order>

## Decisions from the call
- <ruling the team aligned on, one line each — drop the section when none>

## Decisions needed
- <a product or design ruling the testing surfaced but nobody has made — one line each, with the Test IDs it blocks; mirrored in the session's decisions child (§ Product decisions child) — drop the section when none>

## Slices
Slice cap <N> this session.
- <one line per slice: what it covers and its Test IDs — Linear renders the
  sub-issue links; this list gives the reading order and the overflow context>
- already tracked: <PRD-NNN> — <one line> (an existing open Issue, related to
  this parent so the fix queue still sees it)
- standing since <date>: <a never-filed fail from an earlier walk that the gate
  accepted as a slice — one line>

## Not sliced
- <note-only follow-ups, anything past the slice cap, and `[derived:telemetry]`
  uncorrelated window errors (testers or ordinary production traffic — the
  telemetry has no tester predicate) — one line each>
- investigate: <a symptom whose cause or intent is unknown — one line; a slice
  only after someone looks>
- environment: <behaviour caused by the harness or environment, not the product —
  one line>

**Done when**
- every slice below — and every related already-tracked Issue — is Done or explicitly
  deferred, and the re-QA walk has re-recorded its Test IDs

Session <slug>. [Meeting notes](<drive-url>)
```

**Source-line variants**: with notes, `Session <slug>. [Meeting notes](<drive-url>)`; app-only
(no notes found in the discovery window), `Session <slug>. App-only run — no meeting notes
found.` Never fabricate a Drive link. **Refreshing the report later**: send the unchanged
`title` in the same `save_issue` payload — the lint gate resolves the length exemption from the
payload alone, so an `{id, description}` update without the title is rejected as oversized
(append patches under the backstop pass either way).

Both results blocks are pasted verbatim from `tmp/qa-session/<slug>/report.md`, written by
`bun run qa:report --slug <slug> --window <start>..<end>` — the pull joined to the catalog's
per-case priority and kind, never hand-counted — and cover **this session's entries only** (the
call-window rule; the store is long-lived). The generator already includes the `n/a` and
noted-without-a-verdict counts (recorded states without which the walked numerator does not
reconcile) and drops zero segments rather than rendering them. No tester attribution, wallet addresses, session IDs, or replay URLs anywhere;
per-tester detail stays in the pulled results and the private Sheet. Parent labels:
`protocol:green-goods` + `activity:qa` + `source:qa-session` + `qa-sync:<date>` + one `ai:*` —
no `package:*` (a session spans surfaces). The parent closes when its `Done when` holds — the
fix flow closes it, never the writer that filed it.

## Product decisions child — one per session, only when testing surfaced decisions

Title exactly `Product decisions from QA session YYYY-MM-DD`, a sub-issue of the session parent via
`parentId`, state `Backlog`, labels = the parent set, no `package:*`. The interactive skill assigns
the product owner; the routine leaves it unassigned. It exists so a ruling has a place to land that
outlives the parent, and so a Linear-only agent reads the open questions before touching the slices
they block.

```markdown
<One sentence: what testing surfaced that needs a product or design ruling before a fix is
honest, and which slices wait on it.>

- <Decision one, as a question a person can answer in a sentence, with the Test IDs and slice it
  blocks — "Should the cookie-jar withdraw floor stay at one cent for DAI? (`PWA-028`)">
- <Decision two …>

**Done when**
- every question above has a ruling recorded here, and design rulings are also locked in
  `.claude/skills/design/decision-log.md`

QA session — <slug>.
```

## QA slice — sub-issue (one slice = one branch = one PR)

Children of the session report via `parentId`. A slice is a root-cause cluster — same catalog
area, same suspected seam — split when it exceeds 3 Test IDs or crosses packages. Target zero
headings like any defect; the bold labels below are lines, not headings.

```markdown
<The problem cluster in prose: what fails, for whom, on which surface(s), and
why these belong together. Name each catalog case inline — "Review actions sit
below the fold (`ADM-012`, fail) and a second decision is not blocked
(`ADM-018`, fail)." Keep a scrubbed verbatim quote only when it carries intent
a paraphrase would lose.>

**Where to start**
<One or two lines mapping the feature: the owning module/component paths and
the seam the failures share. A starting map, not a certified diagnosis.>

**Verify on**
<local | device | production — from the member cases' `requiresDevice` and
`requiresProduction` flags; `local` is the dev:prod stack on a laptop, `device` an
installed phone, `production` the deployed origin. The fix loop takes `local` first.>

**Done when**
- <each Test ID's expected result holds and is re-recorded as pass in the QA app>
- <second observable outcome when the slice has two halves>

Fix posture: `.claude/context/qa.md § Fix posture` (via `AGENTS.md § Linear-Spawned Issue Contract`).
Validation: `<command>`. QA session — <slug>. Test IDs: `<ID>, <ID>`.
```

**Evidence comment (slice)**: window-scoped enrichment — PostHog safe summary, Sentry issue link
and top frame, deploy correlation — goes in the slice's first comment per § Evidence comment
above, never the body. Evidence pages a tester linked from a note (a Notion or Drive page beside
an issue number) go in the same comment as links, never re-typed; the page stays private and the
link carries no session or replay identifier. Replay URLs, session IDs, and distinct IDs never
reach Linear; the parent's recipe line points a human at the recordings view instead. A slice the
gate accepted from standing state opens its body with `Standing since <date>.`

**State + priority**: verdict-backed (a tester recorded fail/blocked in the QA app during the
session window, exact Test IDs) → `Todo`; priority High for a P0-case fail, Medium for P1, Low
otherwise — Urgent only when the call flagged it release-blocking. The seeded priority is a
queue-ordering default (walk priority × verdict), **not a severity judgment** — the fix session
re-judges it at take-up, and Sheet severity stays independently assigned
(`.claude/context/qa.md` § Verdict and severity rules). Reconstructed from meeting notes alone
(no app verdict) → `Backlog`, priority unset. **Labels**: the parent set plus ONE `package:*` for the slice's
primary surface (secondary packages named in the prose, as always).

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

When this tracking Issue comes from `source:qa-session`, use the QA session source line and exact
Test ID defined above. Track-only status does not weaken the linkage rule.

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
| Verdict-backed cluster (call report) | QA slice sub-issue of the session report | `Todo` + derived priority | No — the report is the record |
| Notes-only cluster (call report) | QA slice sub-issue of the session report | `Backlog` | No |
| Decision needed (call report) | Line under the parent's `Decisions needed` + the session's decisions child | `Backlog` | No |
| Investigate (call report) | `Not sliced · investigate` line in the parent; no Issue until someone looks | — | No |
| Catalog feedback (call report) | Never a slice — `tmp/qa-triage/<slug>/catalog-feedback.md` (skill) or one `Catalog feedback` comment on the parent (routine) | — | No |
| Never-filed standing fail accepted at the gate (call report) | QA slice sub-issue opening with `Standing since <date>.` | `Todo` + derived priority | No |

The default for ambiguous items is **track-only** — create a Customer Need linked to a lightweight Backlog tracking Issue. The Issue exists only because Linear requires a link target; it is not committed work until a human promotes it.
