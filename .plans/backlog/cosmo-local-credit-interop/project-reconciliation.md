# Cosmo-Local project reconciliation

**Date:** 2026-10-09 · **Branch:** `codex/cosmo-local-planning` · **Base:** `06a31dbf5`.
The user explicitly authorized branch creation, the project split, issue-gap and stale-record cleanup,
and a Claude Fable research/pitch handover. No runtime implementation or publication was performed.

## Project ownership

[Commitment Pooling](https://linear.app/greenpill-dev-guild/project/commitment-pooling-4bc53572f354)
is Completed as the foundation project. Its original 96 issues included 25 nonterminal issues.
After the split, 69 Done or Canceled issues remain. No unfinished issue was marked Done by the move.
Historical Done issue descriptions remain intact; the closeout is recorded on PRD-650.

[Cosmo-Local Integration](https://linear.app/greenpill-dev-guild/project/cosmo-local-integration-6273120022c7)
now owns the integration and remaining operational evidence. It contains 26 issues: 23 existing
records plus three gap records. Twenty of the existing records were open in Commitment Pooling,
two were completed CLC context/research records, and RESR-93 was previously unprojected.

| Milestone | Existing records moved | New gap records |
|---|---|---|
| Scope and Design | RESR-73, COM-3, COM-15, COM-35, RESR-74 (Done), GROW-32 (Done), RESR-93 | COM-46, RESR-94 |
| Build | PRD-857, PRD-1096, PRD-1097, PRD-1004, COM-36, COM-40 | — |
| Release | GROW-43, MAR-32, COM-28, PRD-731, PRD-732, PRD-1100, COM-11 | PRD-1197 |
| Follow On / Hardening | PRD-651, PRD-727, PRD-728 | — |

The project has 24 nonterminal and two Done issues. Milestone targets are 21 October for scope and
build, 28 October for release, and 18 November for the existing follow-on documentation/walkthrough
schedule. The hackathon decision is 22 October. The target is not a promise that parked federation
will ship by November.

## Work kept separate

Five open issues were removed from Commitment Pooling and remain unprojected with their existing
owners, parent relationships and history:

- PRD-697 and PRD-787: the separate Commitment Credit lending companion.
- RESR-83 and RESR-84: Capsula research, not a prerequisite imposed on the CLC demonstration.
- COM-42: broader Brazil and South Africa lead check-ins, not confirmed CLC pilot participation.

[Garden Fiat Contributions](https://linear.app/greenpill-dev-guild/project/garden-fiat-contributions-3675da59ceb3)
retains all 12 of its issues. Its overview, RESR-82, PRD-1031 and GROW-43 now identify the hackathon
stretch without promoting implementation or approving a provider, real payment or spending budget.

## Corrected gaps and stale records

- PRD-1197 owns the active go/no-go, previously mixed into the parked PRD-651 roadmap. It depends
  on rehearsal PRD-1096 and issuer terms COM-46, and blocks live release PRD-1100.
- COM-46 covers both issuers' terms, capacity, earning/purchase rules, confirmation, discharge,
  repair and consent before the participant pilot. COM-28 now depends on terms and rehearsal,
  rather than the whole PRD-857 parent; this avoids terms depending on their own finished pilot.
- RESR-94 covers the diaspora research and claim ledger needed by MAR-32.
- PRD-857, PRD-1096, PRD-1097, RESR-73, MAR-32 and GROW-43 distinguish earned from purchased
  issuance, declarations from receipts, and token activity from service delivery.
- PRD-651 moved to Backlog with its cycle and due date cleared; its broader gates remain intact.
- Stale COM-35, COM-36 and COM-11 dates were cleared. Replacement dates need owner confirmation.
  COM-11's old cycle was cleared. No replacement completion dates were fabricated.
- COM-11 no longer depends on the unrelated Needs app PRD-691; its actual settlement prerequisite
  remains. PRD-727 no longer blocks already-Done QA PRD-730; it still precedes walkthrough PRD-728.
- PRD-731 now asks for current-build receipts and reconciliation of Done QA records rather than
  claiming QA Pass 2 has not begun. Operational evidence remains open.
- Onboarding/workshop/season bodies now distinguish historical activities, draft budgets, consent
  and missing receipts. PRD-697/787 point to the existing backlog hub rather than the stale active path.
- Old project descriptions and milestones now describe foundation history and successor ownership;
  the outdated 13 October go/no-go is retired. Completion was recorded on 9 October. The closed
  project retains October month-level target precision; its final historical milestone matches
  31 October and explicitly records the actual 9 October transfer.

## Plan truth and permissions

The current CLC brief, spec, plan and evaluation replace the retired August model. Dated research
and embedded Linear attachments remain historical evidence. The predecessor design is retained in
Git history. The PWA mirror now belongs to Cosmo-Local while retaining its own design gate.

The Commitment Pooling source hub is intentionally not archived: unresolved release, documentation,
settlement and other lane evidence still belongs there. Its existing lane objects and workflow
state remain unchanged. Project completion is a bounded backlog decision, not lane certification.
The same preservation applies to CLC, PWA and Commitment Credit execution states.

New Linear source links point to existing main-branch hub directories. These local planning edits
are not yet committed or pushed, so the updated content must be read from this checkout until a
separately authorized publication. No remote link to an unpublished branch is presented as evidence.

Unrelated local changes to `.claude/settings.json` and `.plans/ideas/green-goods-os/` were preserved.

## Validation and task record

Validation observed on 9 October:

- `node scripts/harness/plan-hub.mjs validate`: passed, 27 feature hubs.
- `git diff --check`: passed.
- Scoped JSON formatting completed; semantic comparison against HEAD confirmed all four affected
  hubs retain identical lane/execution objects and overall workflow states.
- 49 relative Markdown file links checked; no missing target.
- Complete Linear inventories read back: old project 69 terminal issues, new project 26 issues,
  fiat project 12 issues, no additional pages. Old project status is Completed.
- Verified rehearsal + terms → go/no-go → conditional release, and terms + rehearsal → participant
  pilot; the terms issue has no pilot dependency. Verified removed stale Needs/QA edges and the
  five independently tracked issues. RESR-73 retains all four embedded historical attachments.
- New gap issues have Afo as accountable owner. Dates cleared or retained match the record above.

Runtime code was unchanged; no new runtime-test or rendered-browser claim is made. The earlier
review's 275-test receipt remains dated foundation evidence only.

Task record: Cosmo-Local project split and Fable handover | Type: planning | Outcome: complete
Agent/model: Codex / model not exposed | Coverage: this branch and project-reconciliation segment

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | unknown → 2026-10-09T19:04:55Z | Inspected live projects, issue scope and applicable planning rules |
| Implement | 2026-10-09T19:04:55Z → 2026-10-09T19:27:46Z | Branch, authorized plan edits and Linear scope reconciliation |
| Verify | 2026-10-09T19:27:46Z → 2026-10-09T19:29:59Z | Local checks and final Linear readback above; dependency correction re-read |

Human corrections: none observed in this segment; attention: unknown.
