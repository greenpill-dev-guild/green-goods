# Research threads and weekly plan Plan

**Feature Slug**: `research-threads`
**Stage**: `ideas`
**Status**: `DRAFT · brief in PR #1504; spec, plan and eval written 2026-11-06; implementation waits for Afo's acceptance of the spec, then the hub moves to active`
**Created**: `2026-11-06`
**Last Updated**: `2026-11-06`
**Supersedes**: [research-intake-loops](../../active/research-intake-loops/plan.todo.md), which closes as `superseded` in the PR that lands step 2

## Decision Log

| # | Decision | Rationale |
|---|---|---|
| 1 | Threads by relationship and question in one Linear document on the Research team; tracks stay the agenda's frame. | Cross-track connections were cut from every digest; Customers already map call-note speakers to organisations (Afo, 2026-11-06). |
| 2 | Monday plan on Opus plus the Saturday close on Fable. | A plan for the coming week is the missing product; one Fable run a week protects the allowance (Afo, 2026-11-06). |
| 3 | The research routine owns partnership and contact signal. | The deferred owner has not run since September (Afo, 2026-11-06). |
| 4 | Drafts allowed, never sent; two a week. | Briefs move research and were all manual (Afo, 2026-11-06). |
| 5 | Intake plumbing retired; links filed onto threads. | One sharer; the loop asked Afo about his own links (Afo, 2026-11-06). |
| 6 | Research issues stay where routing puts them. | Afo's choice over a standing Research project (2026-11-06). |
| 7 | Asks become Customer Needs on the partner's Customer. | The bug-intake pattern; per-organisation timeline (Afo, 2026-11-06). |
| 8 | Agenda edits through a monthly delegated review Afo approves. | Zero human ticks in six weeks; the delegated review produced v6 in a day (Afo, 2026-11-06). |
| 9 | The brief lives at the top of the threads document; one pointer line in `#research` with identifiers only. | A document nobody opens is the current failure; no new channel (Afo, 2026-11-06). |
| 10 | Readers are Afo and Matt; Matt mentioned on his lines. | Afo's choice over the full panel (2026-11-06). |
| 11 | Private surfaces may name organisations and the people met, never personal matters; the public post keeps the anonymised rule. | "Write to this person" needs names; a shared workspace needs the exclusions (Afo, 2026-11-06). |
| 12 | The five open questions run as defaults D1 to D5 in the spec until Afo answers them. | Keeps implementation unblocked; each is a one-line change. |

## Research / Plan Gate

- [x] Record research evidence in `spec.md`
- [x] Identify the existing repo pattern to mirror (pending-edits document; bug-intake Customer Needs; the Growth radar; the v5.1 checked-write and fail-closed rules)
- [x] List human judgment points before implementation
- [x] Define what is out of scope
- [x] Choose the lightest honest validation commands (see Validation below)

## Requirements Coverage

| Requirement | Lane | Planned Step | Status |
|---|---|---|---|
| R1 to R5 threads document | none (routine spec) | Step 2 | pending |
| R6 to R9 calls, Customers, Needs | none (routine spec) | Step 2 | pending |
| R10 to R15 Monday run and drafts | none (new routine spec) | Step 3 | pending |
| R16 to R19 Saturday v6 deltas, closure, caps | none (routine spec) | Step 2 | pending |
| R20 delegated review | none (skill) | Step 5 | pending |
| R21 to R24 privacy, retries, delivery, models | none (routine specs, README) | Steps 2 to 4 | pending |
| Monday trigger, display name, panel line | human | Step 6 | pending |
| First live runs and acceptance evidence | human | Step 7 | pending |

## Repository guidance compliance

- Routines open no PRs and never edit the agenda; the agenda stays human-owned in substance
  through the delegated review.
- `docs/routines/*.md` frontmatter documents the live trigger; the Monday trigger is re-emitted
  in the same change that adds its spec.
- No partner individuals are named in the repository; identity mappings live in Linear.
- `.plans/**/status.json` stays Biome-formatted; the hub moves stages through
  `scripts/harness/plan-hub.mjs`.

## Impact Analysis

### Files to Modify

- `docs/routines/research-synthesis.md`: Phases 1b, 1c, 2, 4, 5, 6; delete 5a and 5b; scope
  contract and out-of-scope table; caps; a `v5.1 → v6` migration section with the one-time
  closure; frontmatter status.
- `docs/routines/README.md`: portfolio rows, connector matrix, channel mapping, notification
  policy, scope discipline, model tier.
- `.claude/skills/research-agenda/SKILL.md` and its README: `review` mode as the delegated
  review (R20).
- `.claude/context/linear-routing-rules.md`: one clause on the Customer Need line for partner
  research asks (R8), with link, routing and consistency proof.
- `.plans/active/research-intake-loops/plan.todo.md` and `status.json`: closeout record
  (superseded), in the same PR as step 2.

### Files to Create

- `docs/routines/research-week.md`: the Monday routine (R10 to R15), with its pointer prompt.

## Test Strategy

- Unit and integration: none; no package code changes.
- E2E / Playwright: none.
- Manual checks: AC-1 to AC-13 in [eval.md](eval.md), recorded from the first two Saturday runs
  and the first two Monday runs.
- TDD proof: `not_applicable` for every lane, recorded in `status.json`.

## Implementation Steps

### Step 1: Accept the spec and promote the hub

Afo accepts [spec.md](spec.md) on PR #1504, answering any of D1 to D5 he wants changed. Then
`node scripts/harness/plan-hub.mjs move --feature research-threads --to active`, with the
`**Stage**` and `**Status**` headers updated and a `status.json` history entry.
Verification: `plan-hub.mjs validate` passes and the hub lists under `active`.

### Step 2: Saturday spec v6

Rewrite the owning sections of `docs/routines/research-synthesis.md` per R1 to R9 and R16 to
R19, R21 to R24: the threads document contract and rewrite rules, the widened call-note read and
the new out-of-scope table, the thread ledger in Phase 2, the Customer and Need writes and the
status pointer in Phase 4, the deletion of Phases 5a and 5b, the memo's new shape, the caps, and a
migration section that names the one-time closure of the sixteen ❔ shares. In the same PR, add
the routing contract's clause for research asks on Customer Needs (R8) and write the closeout
record of `research-intake-loops` (plan skill steps 1 to 5, resolution `superseded`).
Verification: `check-guidance-links.mjs`, `plan-hub.mjs validate`, and a read-through of the spec
against R1 to R9 and R16 to R19 by Afo.

### Step 3: Monday spec v1

Create `docs/routines/research-week.md` per R10 to R15 and R21 to R24: frontmatter (cron
`0 13 * * 1`, model `claude-opus-5-5`, connectors, env vars, budget), preflights, inputs, the
brief shape and selection order, the drafts rule, the pointer line, failure behaviour, the
`Run notes` record, and the pointer prompt for the trigger.
Verification: the file passes `check-guidance-links.mjs`; its pointer prompt names the file path
on `develop`.

### Step 4: README

Update `docs/routines/README.md`: the `research-synthesis` row (v6), a new `research-week` row,
the connector matrix (Monday: Drive, Linear, Discord REST), the channel mapping for `#research`
(Saturday digest and Monday pointer), the notification policy (Monday never mentions; the only
Linear mention is Matt), the scope-discipline paragraph on Drive reads (partner syncs and coffee
meets now read; the two privacy tiers), and the model-tier note.
Verification: `check-guidance-links.mjs`; the rows match the two specs' frontmatter.

### Step 5: Delegated review mode

Rewrite the `review` mode of `.claude/skills/research-agenda/SKILL.md` per R20 and update its
README: rule-based classification, the numbered round for stage, horizon, order, question and
implementable-when changes, the `## Delegated review · {date}` section, the edition bump through
`apply`, and the hand-off of commit and PR to the session. Add to the Saturday spec that the
pending-edits refresh carries those sections forward.
Verification: a dry run (`--dry-run`) on a scratch copy of the agenda and a throwaway document,
recorded in [eval.md](eval.md) AC-12.

### Step 6: One-offs Afo owns

Create the Monday trigger on `claude-opus-5-5` in the green-goods environment with the pointer
prompt, the Drive and Linear connectors and the two env vars; confirm Matt's Linear display name
for the mention; say whether the agenda's panel line changes (D1); pin the threads document on the
Research team page beside the agenda.
Verification: the trigger's next fire shows in the routines UI; the README row records the
trigger id.

### Step 7: First live runs

Read the first Saturday v6 run (the Saturday after step 2 merges) and the first Monday run: the
threads document, the Customers and Needs written, the status pointers, the public post, the
brief, the drafts and the pointer line. Record AC-1 to AC-11 and AC-13 in [eval.md](eval.md);
schedule the second Saturday for AC-2 and AC-4; archive `research-intake-loops` after the human
merge of step 2 (plan skill step 6).
Verification: every acceptance check carries where it was observed; failures become spec fixes in
a follow-up PR, not silent reruns.

## Validation

- `node scripts/harness/plan-hub.mjs validate`
- `node scripts/quality/check-guidance-links.mjs`
- `node scripts/dev/ci-local.js --intent push --reuse-passing-receipts` on each PR
- The first live runs, recorded in [eval.md](eval.md)
