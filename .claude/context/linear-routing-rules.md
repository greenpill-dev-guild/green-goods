# Linear Routing Rules (shared core)

Single source of truth for how repo skills route accepted findings into Linear
(workspace `greenpill-dev-guild`). Skills reference this file and keep only
their skill-specific deltas inline. Workspace shape (teams, records, label
families, routine ownership) is documented in `CLAUDE.md § Linear Workspace`;
this file is the operational contract for skills that create records.

## Invariant rules

1. **Read-only until acceptance.** Producing a report/audit/review never
   creates or mutates Linear records. Create records only after the user
   accepts a finding for tracking — and always prompt first (e.g. "Found N
   findings ready to track in Linear. Create Issues for these accepted
   findings? [y/n]"). Never auto-write.
2. **Team routing.**
   - Accepted implementation, refactor, QA, maintenance, regression, bug-fix,
     or cleanup work (an accepted delivery outcome) → Linear **Issue**,
     **Product** team, using the *Accepted Product Work* structure.
   - Accepted research questions, evidence gathering, recommendations, or
     decision support that precedes accepted product scope → Linear **Issue**,
     **Research** team, using the *Accepted Research Task* structure.
   - Raw customer or telemetry signal → Linear **Customer Need** (Product
     team), not a product Issue, until accepted.
3. **`.plans` stays the execution truth.** If a finding is mirrored from a
   `.plans/**` item, include the `.plans` link in the body and label the
   record `source:plans`. Never use GitHub Issues for backlog work.
4. **Project routing.** Attach to an active bounded project only when the
   scope clearly matches. Never route new work into completed/staging umbrella
   projects (e.g. `Green Goods`, `Coop`, `Network Website`, `Cookie Jar`) or
   any project whose status is Completed. Otherwise leave the issue
   unprojected and correctly labeled.
5. **Label namespaces.** Use only `protocol:*`, `package:*`, `activity:*`,
   `funding:*`, `source:*`, `ai:*`. Retired families (`area:*`, `work:*`,
   `task:*`, `automation:*`, `health:*`, `grant:*`) must not be reintroduced.
6. **Privacy boundary.** Keep private, security-sensitive, exploit-enabling,
   replay, session, wallet, email, and user-identifying details out of public
   Linear bodies (error message + hash + counts are OK; replay URLs, session
   IDs, distinct IDs, wallet addresses, reporter identifiers are not). Store
   sensitive context only in private notes or a handoff the user explicitly
   approves. **Comments are inside the boundary, not outside it.** The issue
   structure below sends evidence dumps to the first comment to keep bodies
   short; that is a readability move, not a privacy escape hatch, and a routine
   with a redaction step must scan the comments it posts as well as the bodies.

## Issue structure (Accepted Product Work / Accepted Research Task)

Both structures are the same shape. Research issues ask a question and end in a
decision-ready artifact; Product issues name a defect or outcome and end in
shipped work. Voice rules live in `AGENTS.md § Linear Workspace`; this section
owns the shape and the caps.

**Title** — what a person would say broke, or what should exist. A plain
sentence fragment, no trailing period.

* No prefixes. Not `plan:`, `[tracking]`, `UI:`, `QA Pass 2:`, `backlog:`,
  `P0`, `ETHOnline:`, or any lane, routine, or team tag. Labels and project
  fields already carry that; a prefix in the title only costs scan width.
* No symbol names where a human phrase exists. "Garden join fails on the
  passkey prompt", not "`buildSmartAccount` NotAllowedError on join".
* One issue per issue. A title joining two unrelated problems with "and" is two
  issues — file both.

**Body — three blocks, in this order, prose first.**

1. **The problem or the outcome.** One or two short paragraphs. Lead with what
   breaks and for whom, or what should exist and why. Define any term the
   reader would have to look up, on first use. This block is never optional.
2. **Done when.** Two to four checkable bullets. This is what keeps an issue
   dispatchable to Codex — it is the acceptance criteria, written plainly.
   Omit for a pure decision or discussion issue.
3. **One evidence or source line.** A link, plus counts where telemetry is the
   evidence. Everything else — dashboards, repro steps, file inventories,
   structured telemetry — goes in the first comment as redacted summaries and
   tables, not the description. Raw output stays a linked file either way; see
   the never-paste rule below.

**Caps.**

| | Limit |
|---|---|
| Headings | 3 (a defect usually needs 0) |
| Words | ~150 target · 300 ceiling for a defect |
| Plan mirror | 3 sentences plus the hub link |
| Telemetry in the body | one line of counts |

An umbrella tracker or roadmap issue may exceed the word ceiling when the prose
stays plain — label it `plans` **plus** `architecture` (a parent titled
`<feature> roadmap` also qualifies) and keep the three-block order. `plans`
alone does not earn the exemption: plan-hub stamps it on every mirror, lane
issues included, and those obey the ceiling.

**Never render an empty section.** If a block has nothing to say, drop it. A
heading followed by "—", "needs repro", or a paragraph explaining that the
telemetry found nothing is worse than its own absence: it costs the reader a
stop and tells them nothing. Report tooling gaps in the run summary, not the
issue.

**Never restate.** One fact has one home in the body. A summary followed by a
detail section repeating it, or a finding block duplicating the opening
paragraph, is the single most common bloat in this workspace.

**Never paste raw agent output — in the body or a comment.** Session
transcripts, tool logs, full stack traces, diff dumps, lane metadata
(`Owner/status:`, `Source plan:`, `status.json#execution_sub_lanes`), screen
codes (`W26`), and spec citations (`§5.1`) get linked as files, never pasted.
The first comment carries structured, redacted evidence — it is not an escape
hatch for the dumps this rule bans.

### Worked example

Not this:

```markdown
## Summary
[tracking] Cancel is broken in the garden edit dialog.
## Surface
Admin Dashboard (garden edit → image upload). `package:admin`.
## Suggested fix
Investigate the dialog dismiss path.
## Safe evidence
PostHog (Admin 262122): no matching exception signature. A cancel button that
fails to dismiss does not necessarily throw.
## Source
qa-triage-pulse · auto-extracted · qa-sync:2026-07-29
## Authoritative QA finding
Cancel is broken in the garden edit dialog. [...repeats the whole defect...]
```

This:

```markdown
Editing a garden and changing its image makes the edit impossible to cancel —
the dialog stops responding and the operator has to reload. Leaving the image
alone and cancelling works fine, so the image change is the trigger.

**Done when**
- Cancel dismisses the dialog after an image change, discarding the edit.
- The garden keeps its previous image.

Reported in QA sync 2026-07-29. [Notes](<drive-url>)
```

## How skills consume this

Reference this file (`.claude/context/linear-routing-rules.md`) instead of
restating the rules. Keep inline only what is genuinely skill-specific — e.g.
`audit`'s severity→record-category table, `debug`'s Customer-Need body shape.
When creating or rewriting a Linear *project* description (not an issue),
follow the companion shape in `.claude/context/linear-project-template.md`.

**Enforcement.** `.claude/scripts/lint-linear-issue.sh` runs as a `PreToolUse`
hook on `save_issue` and blocks writes that break the caps or carry banned
tokens, registered in both `.claude/settings.json` and `.codex/hooks.json`. It
checks shape only — prefixes, heading and word counts, lane metadata, empty
placeholders — never whether the prose is any good, because a wrong block costs
an agent a retry loop it cannot reason its way out of. Treat it as a backstop:
write to this structure directly rather than letting a rejection tell you.

Linear's own issue templates cannot help — `save_issue` exposes no template
parameter, so templates only reach the composer, Slack and email intake, and
`?template=` URLs. Creating them in Linear's UI is still worth doing for
teammates filing by hand; it does nothing for agents.
