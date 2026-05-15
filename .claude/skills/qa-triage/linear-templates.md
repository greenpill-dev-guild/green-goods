# Linear Body Templates — `/qa-triage`

These templates mirror [`bug-intake`](../../docs/routines/bug-intake.md) Phase 3's body shape, adapted for the interactive single-source case (no Discord ack, no daily summary — those belong to the routine).

Render every field. Empty fields become `—` rather than the section being dropped; readers should be able to scan the body shape across records and immediately see what's known vs not.

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

**Labels (Customer Need)**: the Linear API surface for `save_customer_need` accepts `body`, `customer`, `issue`, `project`, `priority` — **no `labels` field**. Labels live exclusively on the linked Issue. The fields `protocol:green-goods`, `source:drive`, `agent:claude` (formerly listed here) belong on the linked Issue's label set.

**Required link**: every Customer Need must carry an `issue` (or `project`) parameter. Linear's API rejects with `Exactly one of projectId or issueId must be defined` otherwise. There is no standalone-Need path — see "Attach-Issue pattern (for former Need-only items)" below.

**Workflow state**: Customer Needs have no workflow state — they're raw-signal records that live alongside the Issue they're linked to.

---

## Issue body (only when the item crosses both bars: actionable description + named surface)

```markdown
## Summary
<one-paragraph behavior — what's broken, who hits it, where>

## Surface
<client-pwa | client-website | admin | docs>
<route or component if known>

## Reproduction
<steps from the notes verbatim where possible; "needs repro" if absent>

## Expected
<expected behavior from the notes; "needs definition" if absent>

## Actual
<observed behavior from the notes>

## PostHog evidence (safe summary)
- Error hash: `<hash>` (if matched)
- Affected sessions (7d): <N>
- Affected users (7d): <N>
- First seen / Last seen: <UTC>
- App surface: <client | admin>
- Match confidence: <high | medium | low>

## Deploy correlation (gated on PostHog match)
{same shape as the Customer Need block; omit entirely if no deploy in the [first_seen - 24h, first_seen + 1h] window. When present, this often *is* the answer to "Suggested fix" — revert or fix forward the named commit.}

## Suggested fix
<one sentence from the notes or extraction; "needs investigation" if absent. When a Deploy-correlation block is present, default to "investigate the linked diff" unless the notes named a different fix path.>

## Provenance
{include only when the `agent:*` label can't carry both an origin and a delegate}
- Created by: <agent:claude | agent:routine>
- Delegated to: <agent:codex | agent:claude>
- The label set carries the delegate-to agent (Linear enforces single-value-per-group on `agent:*`); the originating agent is captured here.

## Source
QA Sync — <meeting-title> on <YYYY-MM-DD>. Speaker named on the linked Customer Need.
[Customer Need](<linear-need-url>) carries the verbatim quote + reporter context. [Notes](<drive-url>).
```

The Issue body is the **actionable surface** — it has Reproduction, Expected, Actual, Suggested fix, PostHog evidence, Deploy correlation. **It does NOT duplicate the verbatim quote or the reporter list** — those live on the linked Customer Need. The Issue's `## Source` line references "the linked Customer Need" by phrase; the Customer Need links back via its `## Linked Issue` line carrying a real PRD URL. Each record has one job; the integration is the link.

> **Link asymmetry is intentional.** The Customer Need's `## Linked Issue` carries a clickable `[PRD-XXX](https://linear.app/.../PRD-XXX)` URL because Linear Issues expose stable web URLs. The Issue's `## Source` block, by contrast, refers to "the linked Customer Need" without a clickable URL — Linear's `save_customer_need` API returns `url: null` and Customer Needs are surfaced from the linked Issue's right rail rather than a standalone page. Do not "fix" this by hand-building a Customer Need URL pattern; the asymmetry is a Linear-platform property, not a template bug.

The `## Surface` block above supports a **secondary-package note** when a bug spans more than one package. Example:

```markdown
## Surface
Admin Dashboard (members panel)
Investigation likely spans `package:admin` (display) and `package:indexer` (enrichment); only `package:admin` is on the label set per Linear's single-value-per-group constraint on `package:*`.
```

**Labels (Issue)** — Linear enforces single-value-per-group on `agent:*` and `package:*`; the rules below assume one value per family:

- `protocol:green-goods` — always.
- `package:*` (one only) — one of `package:client`, `package:admin`, `package:shared`, `package:contracts`, `package:indexer`, `package:agent`, `package:docs`. The **primary surface** wins as the label; secondary packages are named in the body's `## Surface` block. Omit only when the surface is genuinely unknown.
- `activity:qa` — confirmed bug or behavioral defect.
- `activity:maintenance` — cleanup or polish that isn't a user-visible defect.
- `activity:architecture` — strategic / architectural work (e.g., cross-device account recovery, auth-flow rework).
- `source:drive` — provenance still matters for triage.
- `agent:*` (one only) — `agent:claude` (interactive Claude Code), `agent:codex` (delegated to Codex), `agent:routine` (cron'd routine writes). When both an origin and a delegate-to apply, the **delegate-to** wins as the label; the originating agent goes in the body's `## Provenance` section. The interactive `qa-triage` skill defaults to `agent:claude` unless the user picks Codex delegation in the assignee dialog.
- `task:*` — apply only when the work clearly falls inside one of the canonical task pathways (`task:evidence`, `task:funding-pathway`, `task:access-participation`, `task:reputation-identity`, `task:data-input`, `task:local-onboarding`, `task:evaluator-review`). Omit if unsure.

**Workflow state**:
- `Todo` when surface + behavior are clear and a fix path is suggestable.
- `Backlog` when the fix is exploratory.
- Never `In Progress`, `In Review`, `Done`, or `Cancelled` — humans drive those transitions.

---

## Recurring-pattern parent Issue (when PostHog confirms ≥50 sessions in 30d)

When Phase 3 surfaces a `[derived:recurring]` item and the user approves it in Phase 4, file the parent Issue with the shape below.

```markdown
## Recurring pattern

- Error hash: `<posthog-error-hash>`
- Top-line message: `<redacted-error-message>`
- Distinct sessions (last 30d): <S>
- Distinct users (last 30d): <U>
- First seen: <YYYY-MM-DDTHH:MM:SSZ>
- Last seen: <YYYY-MM-DDTHH:MM:SSZ>
- App surface: <client | admin>

## Linked Customer Needs
<bullet list of Linear URLs for every Customer Need this run associates with this hash>
```

**Labels**: `protocol:green-goods`, `activity:qa`, `package:<inferred>`, `agent:claude`, plus `pattern:posthog-<hash-prefix>` if the pattern label family exists on the team. If `pattern:*` is missing, fail loud and skip the recurring-pattern parent rather than inventing a label.

**Title format**: `Recurring: <top-line-error-message-redacted>` — verb-led when possible.

---

## Quoting from notes

When pulling verbatim from Gemini notes, scrub anything that names a person not already on the meeting's attendee list. The attendee list is part of the body's `Reporter context` section — names there are intentional and already visible to anyone in the source channel. Names elsewhere in the notes (mentioned in passing, third-party references) should be scrubbed to `<person>` or paraphrased.

The verbatim block is **public** in the Linear body. Private context (the reporter's wallet, their distinct ID, their replay URL) stays out — those fields belong only in the QA Sheet's PostHog columns under the explicit private-internal exception.

---

## Attach-Issue pattern (for former Need-only items)

Linear's API requires every Customer Need to link to an Issue (or Project). Items the skill would have classified as "Need only" — feedback, ideas, strategic gaps, clarifications — still get an Issue, just a lightweight one with no fix urgency.

- **Label**: `activity:maintenance` (default for UX polish, copy fixes, low-urgency feature gaps) **or** `activity:architecture` (for strategic items tied to a larger rework — e.g., cross-device account recovery).
- **Priority**: Low (P3) or Medium (P2). Never P0/P1 — those are real bugs and use the main pattern instead.
- **Status**: `Backlog`. The attach-Issue isn't claimed as committed work; it's a tracking surface for the Customer Need to attach to.
- **Title**: prefix with `[tracking]` so the attach-Issue is visually distinct from real planned work in Linear list views. Example: `[tracking] Positions UI on public site (missing)`, `[tracking] Donate vs Endow copy needs clarification`, `[tracking] Cross-device account recovery (strategic)`. The `[tracking]` token signals: this is raw signal tracked as an Issue for API reasons (Customer Needs require an Issue link), not committed work. When the interactive `/qa-triage` skill promotes one of these to real work, the user removes the `[tracking]` prefix as part of the promotion (along with relabeling `activity:maintenance` → `activity:qa`, moving `Backlog` → `Todo`, setting priority, assigning).
- **Body**: shorter than a bug Issue. Summary + Surface + Suggested fix + Source. Skip Reproduction / Expected / Actual blocks.
- **Body templates** for an attach-Issue:

```markdown
## Summary
<one-paragraph distillation of the feedback / idea / strategic gap>

## Surface
<route, component, or area>

## Suggested fix
<one sentence; "needs design call" or "needs product call" is acceptable here>

## Source
QA Sync — <meeting-title> on <YYYY-MM-DD>. Speaker: <name>. [Notes](<drive-url>)
```

The Customer Need then links to this Issue via the `issue` parameter and carries the full verbatim quote + Reporter context in its body.

---

## Disposition resolution

Linear's API constraint that Customer Needs must link to an Issue eliminates the "no Issue" column. Every accepted item gets an Issue — main or lightweight attach.

| Item shape | Issue type | Issue status | Customer Need |
|---|---|---|---|
| Clear bug + named surface + suggestable fix | Main (`activity:qa`) | `Todo` | Yes, linked |
| Bug with no repro or no clear surface | Main (`activity:qa`) | `Backlog` | Yes, linked |
| Idea / feature request / UX polish | Attach (`activity:maintenance`) | `Backlog` | Yes, linked |
| Operator pain — "this is awkward" | Attach (`activity:maintenance`) | `Backlog` | Yes, linked |
| Strategic gap tied to architecture rework | Attach (`activity:architecture`) | `Backlog` | Yes, linked |
| Question / "me too" / no actionable content | Skip both | — | No |
| Duplicate of existing record | No new Issue | — | Comment on existing if user wants the verbatim preserved |
| `[derived:posthog]` accepted in Phase 4 | Main (`activity:qa`) | `Todo` | Yes, linked (telemetry-only body) |
| `[derived:test-fail]` accepted in Phase 4 | Main (`activity:qa`) | `Todo` | Yes, linked (Test ID reference) |
| `[derived:recurring]` accepted in Phase 4 | linked to parent Issue | yes (recurring-pattern parent) |

The default for ambiguous items is **Customer Need only** — let human triage promote to Issue when appropriate. Avoid creating Issues that will sit idle in `Backlog` without enough detail to triage.
