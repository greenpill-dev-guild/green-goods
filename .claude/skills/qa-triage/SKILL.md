---
name: qa-triage
user-invocable: true
description: Turn Build Sync or Engineering Sync notes, or a qa-session deferred handoff, into scope-locked Linear records and private QA Sheet rows. Fires on a QA call/sync/meeting, Build Sync, Engineering Sync, Product Sync (legacy name), or a request to file or triage recent meeting bugs. Pulls notes from Drive (Downloads fallback), enriches against PostHog and existing Linear/Sheet records, requires exact Test IDs for qa-session issues, then writes only after confirmation. For a live or dictated walkthrough, use qa-session instead.
argument-hint: "[<notes-path|slug|session:YYYY-MM-DD>] [--call [<date>]] [--dry-run] [--no-codex] [--no-sheet] [--fixture]"
---

# QA Triage

Turn one QA call, Build Sync, Engineering Sync, or deferred `qa-session` handoff into a
numbered proposal, then confirmed Linear records and private QA Sheet rows. This skill owns
intake and filing; fixes return to `debug` or a separately authorized implementation task.

The [QA contract](../../context/qa.md) owns Test IDs and evidence privacy. The
[Linear contract](../../context/linear-routing-rules.md) owns record routing and write authority.
The [bug-intake routine](../../../docs/routines/bug-intake.md) is the unattended multi-source sibling.

## Select the mode

| Input | Starting point |
|---|---|
| No argument | Discover recent notes; offer a recent routine pre-stage when present. |
| Notes path | Use the supplied source. A deferred `qa-session` extract carries exact `case:` IDs. |
| Local slug | Resume `tmp/qa-triage/<slug>/notes.md` and its recorded phase/state. |
| `session:<YYYY-MM-DD>` | Load [intake Phase 1 step 0](./references/intake.md#phase-1--discover-read-only), then resume the routine-pre-staged batch at Phase 4 with its existing provenance and record shapes. |
| `--call [<date>]` | Load [call-mode.md](./references/call-mode.md) before intake: join the QA run and meeting window, classify observations, and propose slices. |
| `--fixture` | Load the fixture section in [intake.md](./references/intake.md#fixture-mode---fixture); use synthetic inputs without live probes or auxiliary extraction. |

Flags compose with the selected mode: `--dry-run` prints payloads and retains scratch without
external writes; `--no-codex` skips auxiliary extraction; `--no-sheet` skips the Sheet branch.
For a live or dictated walkthrough, use [qa-session](../qa-session/SKILL.md).

## Phase 0–3 — Intake and enrichment

Load [intake.md](./references/intake.md) when discovering notes, parsing a source, or enriching
an incomplete run. It owns service readiness, private Sheet permissions, workspace files,
source confirmation, extraction, deduplication, and telemetry. Load `sheet-schema.md` only
for Sheet schema work and [codex-prompt.md](./codex-prompt.md) only for auxiliary dispatch,
schema, or completion handling.

Complete this phase when `extraction.md` and `cross-ref.md` contain the numbered findings,
evidence, known duplicates, and unavailable checks. Missing enrichment is an explicit limitation;
it does not establish a match. A routine-pre-staged batch skips fresh extraction/enrichment.

Auxiliary extraction uses copied inputs in an owned temporary directory. It creates no Git
branch or worktree. Run it only when delegation is allowed; otherwise retain the manual prompt
and record the fallback. Inspect pending state before dispatching on resume.

## Phase 4–5 — Scope lock and payloads

Load [filing.md](./references/filing.md) once a proposal is ready, including on a routine-pre-stage
resume. Present the numbered findings and proposed dispositions. Record the user's accepted
numbers and overrides in `triage.md`; only that set advances. Call mode uses its slice-specific
reply grammar. Reuse a decision already made in this run; newly returned auxiliary items get
an additive gate without rewriting prior choices.

Draft accepted payloads with [linear-templates.md](./linear-templates.md), review assignees,
and prepare Sheet CSVs only when that branch applies. Deferred `qa-session` findings require
exact catalog Test IDs; pause an item with a missing ID for human selection.

## Phase 6–7 — Confirm, write, and finish

Follow the filing reference's privacy scan and final payload confirmation before external writes.
Scan comments as well as bodies. Session IDs and replay URLs belong only in the permission-checked
private Sheet. Preserve prior Sheet rows and QA-owned Test columns; only `Defect Link` is backfilled.

On confirmation, write accepted records and rows; on `--dry-run`, emit the proposed payloads
without writing services. Complete only after confirmed writes succeed or the dry-run outputs
are ready, auxiliary results are handled, and `report.md` states what was filed, deferred,
skipped, failed, or remains pending. A running auxiliary child keeps the run pending.

Remove only the current run's recorded scratch after successful completion. Retain dry-run,
failed, and incomplete workspaces with their resume path. In call mode, preserve de-attributed
catalog feedback in its owning Plan Hub before cleanup. This workflow never cleans legacy Git
worktrees or starts implementation sessions automatically.
