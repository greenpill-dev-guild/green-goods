# Linear payloads — Product Sync 2026-05-20 (fixture dry-run)

Mode: `--fixture --dry-run`. No Linear writes. The payloads below would be submitted via `save_issue` + `save_customer_need` on a real run.

Freshness note (2026-06-02): this file is fixture-only and is not an accepted Linear or QA Sheet record. `PRD-XXX` links are placeholders. Historical `task:*` label examples from the dry-run are stale and are not part of the current canonical label scheme.

## Assignee dialog (bulk-default + exceptions-only)

```
Default assignee for all 5 new Issues (items 2, 3, 4, 5, 6): (a) Afo, (b) agent:claude, (c) unassigned, (d) other engineer (name).

Proposed exceptions (where the bulk default seems wrong given context):
  • item 6 (action templates idea): default Afo accepted — no engineering scoping needed yet
  • item 4 (docs typo): could be agent:claude (one-line fix); proposed agent:claude

Per-item overrides? Reply: 4:agent:claude or `confirm` to accept the default for everything.
```

Auto-accepting: default = Afo; exception: item 4 → `agent:claude` (one-line docs fix).

## Per-item payloads

### Item 2 — Admin Hub work queue doesn't refresh after approval

**Issue** (title: `Hub work queue doesn't refresh after approval — operator must hard-refresh`):

```markdown
## Summary
After an operator approves work in the Hub, the queue row stays `Pending` until the page is hard-refreshed. Modal closes correctly; only the queue's pending-state didn't get invalidated. Slows down heavy-approval days.

## Surface
Admin Dashboard — Hub work queue

## Reproduction
1. Open admin.greengoods.app/hub.
2. Approve a piece of pending work via the inline action.
3. Modal closes.
4. Queue row still says `Pending` until cmd-R.

## Expected
TanStack Query invalidation on the work-queue list after approval mutation succeeds; row transitions to `Approved` (or removes from the pending bucket) without manual refresh.

## Actual
Row stuck on Pending until reload.

## PostHog evidence (safe summary)
No telemetry match this run (notes asserted "every time, not just sometimes" — implies signal exists; consider re-querying with the correct snippet next pass).

## Suggested fix
Check the approve-work mutation's `onSuccess` for missing `queryClient.invalidateQueries(['work-queue', gardenAddress])`. Likely a one-line fix in the admin work-approval hook.

## Source
QA Sync — Product Sync on 2026-05-20. Speaker named on the linked Customer Need. [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)
```

- **Labels**: `protocol:green-goods`, `package:admin`, `activity:qa`, `source:drive`, `agent:claude`, `task:evaluator-review`
- **Priority**: P1 (High) — confirmed bug, slows operator flow
- **Status**: Todo
- **Assignee**: Afo
- **Linked-Test-ID**: `ADM-007` (verbatim from notes; backfill row in `sheet-test-backfill.csv`)

**Customer Need** (linked via `issue: PRD-XXX`):

```markdown
## Source
QA Sync — Product Sync on 2026-05-20. Speaker: Lena (operator pilot, Hilltop Garden). [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)

> "I approve the work, the modal closes, but the row still says Pending until I cmd-R."

## Linked Issue
[PRD-XXX](https://linear.app/greenpill-dev-guild/issue/PRD-XXX) (Todo, High)
```

---

### Item 3 — Radio buttons missing selected state on /fund

**Issue** (title: `Radio buttons on /fund have no visible selected state — works but invisible`):

```markdown
## Summary
On the Fund dialog's amount-selection radio group, clicking a radio doesn't show any visible selected state. The form submits the correct value, but the user has no visual confirmation of which amount they picked. Affects both the public website `/fund` route and the installed PWA.

## Surface
Cross Surface — Public Website (`/fund`) + PWA (same `<RadioGroup>` component, shared package)

## Reproduction
1. Open greengoods.app/fund.
2. Click any contribution amount radio.
3. Observe: no border, ring, or fill change. The radio dot itself doesn't appear filled.

## Expected
Selected radio shows `ring-2 ring-primary` (or equivalent Warm Earth token) and a filled dot.

## Actual
No visual feedback. Form submits the right value, so the underlying state is correct.

## PostHog evidence (safe summary)
- Error hash: `9c2e1b40`
- Affected sessions (7d): 6
- Affected users (7d): 4
- First seen: 2026-05-19T14:18:00Z
- App surface: client
- Match confidence: medium

## Deploy correlation (gated on PostHog match)
{Vercel correlation would run on a live invocation against the [first_seen - 24h, first_seen + 1h] window. Dry-run: not executed.}

## Suggested fix
The Warm Earth token rollout (~mid-May) may have dropped the `ring-2 ring-primary` utility on the radio input. Check `<RadioGroup>` primitive in shared and any radio-specific override in client's `<FundAmountRadio>` component.

## Source
QA Sync — Product Sync on 2026-05-20. Speaker named on the linked Customer Need. [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)
```

- **Labels**: `protocol:green-goods`, `package:client`, `activity:qa`, `source:drive`, `agent:claude`, `task:funding-pathway`
- **Priority**: P1 (High) — user-visible defect on a funding-critical flow
- **Status**: Todo
- **Assignee**: Afo
- **Linked-Test-ID**: `XPLAT-001` (verbatim from notes)

**Customer Need**:

```markdown
## Source
QA Sync — Product Sync on 2026-05-20. Speaker: Afo. [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)

> "I'm clicking the radios and nothing changes visually. The form still works though."

## Linked Issue
[PRD-XXX](https://linear.app/greenpill-dev-guild/issue/PRD-XXX) (Todo, High)
```

---

### Item 4 — Docs glossary typo "gardner" → "gardener"

**Issue** (title: `Fix glossary typo: 'gardner' → 'gardener' on Operator entry`):

```markdown
## Summary
The community glossary's `Operator` entry currently defines the role as "the gardner responsible for…" — should be `gardener`. Minor but visible on day-one onboarding reads.

## Surface
Docs — community glossary (`packages/docs` or wherever glossary lives)

## Suggested fix
Single-character delete in the glossary entry. Verify no other "gardner" occurrences via grep.

## Source
QA Sync — Product Sync on 2026-05-20. Speaker named on the linked Customer Need. [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)
```

- **Labels**: `protocol:green-goods`, `package:docs`, `activity:maintenance`, `source:drive`, `agent:claude` (one-line fix — Claude can do this)
- **Priority**: P3 (Low) — copy fix
- **Status**: Backlog
- **Assignee**: Afo (override pending — could also delegate fully to agent:claude)
- **Linked-Test-ID**: none

**Customer Need**:

```markdown
## Source
QA Sync — Product Sync on 2026-05-20. Speaker: Lena. [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)

> "Just spell-check; the glossary says 'gardner' on the Operator entry."

## Linked Issue
[PRD-XXX](https://linear.app/greenpill-dev-guild/issue/PRD-XXX) (Backlog, Low)
```

---

### Item 5 — Admin Members tab shows raw address instead of ENS

**Issue** (title: `Admin Members tab shows raw address for ENS-mapped wallet — admin display or indexer enrichment regression`):

```markdown
## Summary
On the admin Members tab at Hilltop, one member with a known ENS handle (resolves on the public profile) shows as a raw `0x71C7…91aF` address. The render path lives in admin; the resolved-handle field could come from indexer enrichment — fix may span both packages.

## Surface
Admin Dashboard (members panel)
Investigation likely spans `package:admin` (display path) and `package:indexer` (ENS enrichment field); only `package:admin` is on the label set per Linear's single-value-per-group constraint on `package:*`.

## Reproduction
1. Open admin.greengoods.app for Hilltop Garden.
2. Navigate to Members tab.
3. Observe the affected member's row — raw `0x` instead of resolved ENS.
4. Open the same member's public profile (greengoods.app/<handle>) — ENS resolves correctly.

## Expected
Admin Members tab matches public profile resolution: ENS name shown when present, raw address as fallback only.

## Actual
Raw address rendered; public profile resolves the handle. Asymmetric resolution path.

## PostHog evidence (safe summary)
Not enrichable from the verbatim quote alone; could query admin project for `ensResolution` failures next pass.

## Suggested fix
1. Check whether the admin Members view reads ENS from the indexer's enriched member record or resolves client-side. If client-side, the resolution path may be wired differently from the public profile.
2. If indexer-sourced, confirm the indexer's `Member` entity carries an `ensName` field and that it's being read.

## Source
QA Sync — Product Sync on 2026-05-20. Speaker named on the linked Customer Need. [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)
```

- **Labels**: `protocol:green-goods`, `package:admin`, `activity:qa`, `source:drive`, `agent:claude`, `task:reputation-identity`
- **Priority**: P2 (Medium) — visible but narrow
- **Status**: Todo
- **Assignee**: Afo
- **Linked-Test-ID**: none
- **Linear relation**: `relatesTo: PRD-516` (the existing ENS regression bug — this is a narrower instance)

**Customer Need**:

```markdown
## Source
QA Sync — Product Sync on 2026-05-20. Speaker: Gui (Guilherme Ferreira). [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)

> "Members tab is showing the raw address. ENS resolves fine on the public profile, so it's the admin display path or the indexer enrichment."

## Linked Issue
[PRD-XXX](https://linear.app/greenpill-dev-guild/issue/PRD-XXX) (Todo, Medium)
```

---

### Item 6 — Action templates (idea) — `[tracking]` attach-Issue

**Issue** (title: `[tracking] Action templates — let operators duplicate previous actions as templates`):

```markdown
## Summary
Operators currently re-fill the action creation form every time. Idea: let an operator pick a past successful action and use it as a template for the next one. Not in scope for v1.1; tracked here to anchor the Customer Need.

## Surface
Admin Dashboard — action creation flow

## Suggested fix
Needs product call. Surface a "Duplicate as template" CTA in past-actions list; pre-fill the create-action form on selection.

## Source
QA Sync — Product Sync on 2026-05-20. Speaker named on the linked Customer Need. [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)
```

- **Labels**: `protocol:green-goods`, `package:admin`, `activity:maintenance`, `source:drive`, `agent:claude`, `task:local-onboarding`
- **Priority**: P3 (Low) — idea, not blocking
- **Status**: Backlog
- **Assignee**: Afo

**Customer Need**:

```markdown
## Source
QA Sync — Product Sync on 2026-05-20. Speaker: Afo. [Notes](https://docs.google.com/document/d/SYNTHETIC-FIXTURE-PATH/edit)

> "Operators have to re-fill the form every time — would be useful to duplicate a previous successful action as a template."

## Linked Issue
[PRD-XXX](https://linear.app/greenpill-dev-guild/issue/PRD-XXX) (Backlog, Low)
```

---

## Item 1 — duplicate handling (no new Issue, no Need)

Per scope lock: `1:duplicate-of-PRD-501`. Action on a real run:

- Append Linear comment on PRD-501 with today's verbatim quote + speaker (Gui) + sync date.
- Skip Defects row.
- Skip new Customer Need (the duplicate has its own existing Need).
