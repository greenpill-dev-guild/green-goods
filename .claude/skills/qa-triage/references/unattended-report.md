# Unattended QA session report

Load this file after [call-mode.md](./call-mode.md) when nobody will confirm the run's proposals
before it writes: an agent closing an automated QA pass, such as a Codex automation or a scheduled
local job. Call mode's sources, join, clustering and templates still apply. Both of the skill's
gates change, so the run never waits for a reply: [Without a gate](#without-a-gate) replaces the
Phase 4 scope lock, and the [privacy sweep](#privacy-sweep) and [write order](#write-order) replace
the Phase 6 payload review and its `confirm`. This file also adds the checks and failure handling a
run needs when nobody is watching. These rules ran as the `qa-call-report` cloud routine until
2026-11-07.

## Limits

- Write only to Linear: the session parent, its full-report document, the decisions child, slices,
  and comments on existing Issues. Never write QA Sheet rows, Customer Needs, GitHub Issues,
  branches or pull requests, and post nowhere else; the [summary](#summary) stays in the run's own
  output.
- Skip the QA Sheet entirely: intake Phase 0 steps 4 to 6 (find the Sheet, check its sharing, read
  it), the Phase 3c and 3d Sheet scans, and the Phase 6 rows with their guided-paste fallback. The
  Sheet's state can neither stop nor change an unattended run.
- One writer per session. When `/qa-triage --call` or an earlier run already filed the session,
  reuse its parent and add only what is missing.
- Never set `In Progress` or an assignee, and never set `Done` on a record with open work. The one
  exception is an all-pass parent (see [Write order](#write-order)).
- Decisions in the report are not design policy. Locking one into the design decision log is a
  human step.
- Label each record by who started the run, per
  [routing rule 5](../../../context/linear-routing-rules.md#invariant-rules). A scheduled
  automation, such as a Codex automation or a cron job, writes as a routine and adds `ai:routine`.
  A run a person started carries no `ai:*` label, like any interactive write.

## Before the run

- Check the checkout, not the branch name: `scripts/agents/qa-state-pull.ts`,
  `scripts/agents/qa-report.ts` and the root `qa pull` and `qa report` actions must exist. If one
  is missing, report the checkout problem and stop.
- `bun run qa pull` reads the QA app's private shards with `BLOB_READ_WRITE_TOKEN` from the process
  environment. The runner supplies it from the host's secret store, never from a file in the
  repository. Without it, report the failure; never write a notes-only report in its place.
- Resolve the Product team, its workflow states, the release project and the active bounded
  projects by name, never by a hardcoded ID. Resolve the label families `protocol:green-goods`,
  `package:*` and `activity:qa`, plus `ai:routine` for a scheduled run, and resolve or create
  `source:qa-session` and `session:<YYYY-MM-DD>`. Any other missing label stops the run with a
  failure report.
- Send labels to `save_issue` as bare child names, such as
  `["green-goods", "qa", "qa-session", "2026-09-02"]`, adding `"routine"` for a scheduled run. The
  `group:child` display form is rejected, and one unresolvable entry files nothing.

## Sources

- **Notes, when there was a call.** Query Drive for `(title contains 'QA' or title contains 'Build
  Sync') and title contains 'Notes by Gemini' and modifiedTime > '<session date at 00:00 UTC, RFC
  3339>' and mimeType = 'application/vnd.google-apps.document'`, where the session date is the
  `--call <date>` argument, or today without one, so a late run still finds that day's call. The
  connector accepts only `title`, `fullText`, `mimeType` and `modifiedTime` terms; a `name` term
  reads as zero matches and would silently drop the call's decisions. Keep the documents whose
  header date is the session date, take the newest whose title names Green Goods or the QA call,
  and list the others in the summary. Reject a document whose main topic is proposals, grants,
  roadmaps or partnerships. When the query finds nothing but exactly one parent for that date links
  a notes document in its source line, use that document.
- **Session identity, before the first pull.** A parent titled `QA session <date>` or
  `QA session <date> · N` is this session when its source line links the same notes document or,
  in an app-only run, when its `Run:` line names the same QA run and the window on its source line
  overlaps this run's. Both live on the parent itself, so a parent whose earlier run stopped before
  the report was attached is still found. Continue that session under its slug and title.
  Otherwise start a new one: the date's first session takes the slug `<date>` and the title
  `QA session <date>`, and each later one the next counter N, the slug `<date>-N` and the title
  `QA session <date> · N`. Every pull, `tmp/` path and record title then uses that slug, so two
  calls on one day never share a parent or a workspace.
- **No notes.** Continue app-only: the report says no meeting notes were found, names the query
  window, and drops the `Decisions from the call` section. An automated pass with no call is
  app-only.
- **Session window.** Use [call mode's rule](./call-mode.md#session-window). An automated pass with
  no call uses the start and end it recorded for its own walk.
- **Snapshot timing.** A pull taken before the padded window closes cannot hold later entries, and
  `qa report` then clamps the window to the pull time and says so in its header. Pull again after
  the window closes, into `tmp/qa-session/<slug>-final` with the same `--run`, and run `qa report`
  with the same `--out`. Never `--force` over an existing pull.
- **A malformed shard stops the run.** Report it as an opaque reference, such as `shard 2 of 3
  failed validation`, never by path or raw parse error, because both contain the tester's wallet
  address. Do not fall back to notes-only.
- **No in-window entries.** Run notes-only: every slice lands in `Backlog`, and the report says the
  app carried no session entries.
- **A skipped `N/A`.** When a note beside an in-window `N/A` says the case was skipped, pass those
  IDs to `qa report --skipped <ID,ID>`, name them on the parent's environment line, and ask in the
  summary for the tester to clear them before the next pull.

## Without a gate

| Call mode, where a person confirms | Unattended |
|---|---|
| A note item without an exact Test ID becomes a fuzzy proposal | Never guess an ID. The item becomes a note-only follow-up under `Not sliced`; `decision` and `environment` observations need no ID |
| A title-similar note and app entry may merge | Keep them separate; a wrong merge attaches the quote to the wrong case |
| A match to an existing Issue is proposed by title and surface | Match only on an exact key ([Dedupe](#dedupe)); an uncertain match stays in this record with `possible duplicate of <key>` |
| A tester's "major regression", "major blocker" or "completely broken" proposes Urgent | Keep the derived priority and add an `Urgent proposed` line to the slice's first comment and the summary |
| The gate may accept a never-filed standing fail from outside the window | Standing entries are never slices; at most one context line |
| A reply such as `I1:slice` promotes an investigate or `[derived:telemetry]` line | Never promote; nobody recorded it |
| The gate may raise the Todo queue budget | The budget stays at 8 |
| Catalog feedback is copied into the owning plan hub at close | One de-attributed `Catalog feedback` comment on the parent |
| The decisions child is assigned to the product owner | Leave it unassigned |
| Sheet Defects rows are offered per slice | Never write the Sheet |

## Dedupe

- **The parent.** The `session:<date>` label only narrows the candidates, because the sync pulse
  puts it on ordinary Backlog Issues too. Reuse requires the exact title the
  [session identity](#sources) step chose and no `package:*` label. A reused parent in `Done` that
  is about to gain a slice, a related Issue, a decisions child or an `investigate` line goes back to
  `Todo` first, and the summary says so, because its `Done when` no longer holds. A `Canceled` parent was a person's
  decision: stop and report instead of adding to it. Route a reused parent whose project is
  missing, Completed or Canceled to the release project; then add the missing children and one
  comment with the new context. Never create a second parent for the session, and never attach
  slices to an Issue that fails this shape test.
- **Findings.** Search the open Product Issues labelled `activity:build` or any `session:*`, plus
  every Issue created on the team since the window opened, whatever its labels. A match needs the
  same Test ID in the Issue's source line or in a comment the QA pipeline posted, or the same
  PostHog error hash. Wording or surface alone never matches. On a match, comment on the existing
  Issue with the date and the new evidence after the privacy sweep, link it to the parent with
  `relatedTo`, give it a project by
  [Project routing](../../../../docs/routines/README.md#project-routing) when it has none or a
  closed one, and list it under Slices as `already tracked: <key>`.

## Privacy sweep

Before every write, search each body and comment for `replay`, `session_id`, `distinct_id`, `0x`
and every tester or reporter identifier seen in the run. The parent and its comments carry
aggregate coverage only, with no tester attribution. The attached full report keeps team display
names and their notes; redact `0x` strings, replay and session identifiers, and any name from
outside the team. A hit found after a write is an exposure: redact it in place and report it as a
failure.

## Write order

1. **Parent**, per [linear-templates.md § QA session report](../linear-templates.md), in `Todo`
   with no `package:*` label. An app-only run uses the template's app-only source line, never an
   invented Drive link, and ends it with the session window, `Window <start>..<end>.`, so a rerun
   can find the session. An all-pass session, with no fail or blocked verdict in the window, no
   slice, no related Issue and no decisions child, is created in `Done`, because nothing
   downstream would ever close it. A session with only decision or investigate lines is not
   all-pass. A failed parent write stops the run: children without a parent are orphans.
2. **Full report document**, per the template's § Full report document. Retry a failed create
   once. If it fails again, stop before writing any child: keep the pull's `tmp/qa-session/` folder
   for a rerun (which can also pull the closed run again), and report the parent's identifier and
   the failure. Never paste the report into a comment instead, because Linear comments carry no
   attribution ([QA contract](../../../context/qa.md)). Once the document exists, link it from the
   parent's lede, sending the title again; retry a failed patch once, then report it.
3. **Decisions child**, when `Decisions needed` has lines: `Backlog`, unassigned.
4. **Slices**, as sub-issues through `parentId`, each with one `package:*` label. Decide slice
   state for the whole run, because the pulled state does not record whether a person or an agent
   entered a verdict. A run that closes a team call, whose verdicts the testers recorded, files a
   slice backed by an in-window fail or blocked verdict in `Todo`, as call mode derives it: the
   tester's verdict is the first human check and the fix session is the second. Any other run,
   including an automated pass or one the runner cannot classify, files every slice in `Backlog`
   with its derived priority for a person to promote. A notes-only slice lands in `Backlog` with no
   priority. Apply the Todo budget after deriving states; overflow lands in `Backlog` at the same
   priority. Retry a failed slice write once, then report it.

## Summary

End with one summary in the run's own output, such as the automation's log or inbox item. It goes
nowhere else: the Linear record is the run's only external write.

```text
**🧪 QA session · {YYYY-MM-DD}**

{One lede sentence: what the session covered and which slice to take first.}

- **{slice title}** · {priority} → <{linear-url}>   (up to three lines)

Report: <{parent-url}> · {N} slices ({T} Todo · {B} Backlog){ · M follow-ups not sliced}
{⚠ failures and enrichment flags, such as posthog: degraded}
```

Leave count tables to the report. The lede may quote the `P0:` line of `report.public.md`; never
quote `report.md`, whose notes are attributed. A run that wrote nothing because something broke
still reports, failure first.
