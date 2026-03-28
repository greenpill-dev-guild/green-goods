# Legacy Plan Status Review

**Date**: 2026-03-26
**Scope**: legacy flat plan files previously stored in `.plans/` and `.plans/_backlog/`
**Excluded**: imported `.claude/plans/*` archive hubs, which are internal agent-system plans rather than the old operational feature-plan surface

## Summary

The legacy flat plan surface has been migrated into foldered hubs under `.plans/{active,backlog,archive}/`.

Status buckets after review:

- **Implemented / effectively done**: 3
- **In progress**: 6
- **To do / not started**: 6
- **Reference / input artifacts**: 2

## Implemented / Effectively Done

These appear complete enough to archive, with the noted caveats.

| Feature | Current Hub | Legacy Status | Notes |
|---|---|---|---|
| Impact Funders Leaderboard + AAVE Strategy Rate Display | `.plans/archive/impact-funders-and-strategy-rates/` | `IMPLEMENTED` | Shipped feature plan |
| Vault-Strategy Auto-Allocate Fix | `.plans/archive/vault-strategy-autoallocate-fix/` | `COMPLETE` | Completed technical fix |
| ENS NameWrapper Fix — Subdomain Registration on Garden Creation | `.plans/archive/ens-namewrapper-fix/` | `ACTIVE — code complete, awaiting deployment` | Implementation appears done; operational deployment step still pending |

## In Progress

These should remain live candidates for active planning, but each hub still needs lane classification before automations should touch it.

| Feature | Current Hub | Legacy Status | Notes |
|---|---|---|---|
| Documentation Gaps — Remaining Work | `.plans/active/docs-overhaul-remaining/` | `IN PROGRESS` | Good candidate for the new docs review loop |
| Fix Garden Domain UI & Data Issues | `.plans/active/fix-garden-domain-ui/` | `ACTIVE` | Focused product/UI fix |
| Harness Design Patterns — GAN-Inspired Agent Architecture | `.plans/active/harness-design-patterns/` | `ACTIVE` | Internal agent-system implementation plan |
| Test Quality Remediation | `.plans/active/test-quality-remediation/` | `ACTIVE` | Ongoing quality work |
| Web2-Friendly Auth & Universal Gas Sponsorship | `.plans/active/web2-auth-and-gas-sponsorship/` | `ACTIVE` | Large cross-cutting feature |
| Yield & Split Management UI | `.plans/active/yield-split-ui/` | `ACTIVE` | Depends on contract-side groundwork already being in place |

## To Do / Not Started

These are backlog items, drafts, prompts, or plans that do not look actively in flight.

| Feature | Current Hub | Legacy Status | Notes |
|---|---|---|---|
| Local-First Evolution: From Offline-First PWA to True Local-First | `.plans/backlog/2026-02-19-local-first-evolution/` | no explicit status in migrated source header | Treat as backlog until requirements are normalized |
| Local-First Extended Tooling: Media, AI, and Alternative Stacks | `.plans/backlog/2026-02-19-local-first-extended-tooling/` | no explicit status in migrated source header | Vision/backlog item |
| Contract Upgrade Prompts | `.plans/backlog/contract-upgrade-prompts/` | no explicit status in migrated source header | Prompt/reference material, not implementation-ready |
| Signal Pool → Yield Wiring: Implementation Prompt | `.plans/backlog/signal-pool-yield-wiring-implementation/` | no explicit status in migrated source header | Needs conversion into a real plan if still relevant |
| Signal Pool → Yield Wiring Supplement | `.plans/backlog/signal-pool-yield-wiring/` | `DRAFT — REVIEWED` | Backlog work gated on deployment and yield flow |
| Yield & Split UI — Team Implementation Prompt | `.plans/backlog/yield-split-ui-team-prompt/` | no explicit status in migrated source header | Prompt artifact, not a lane-ready feature hub |

## Reference / Input Artifacts

These were useful legacy inputs, but they should not be treated as active implementation plans.

| Feature | Current Hub | Legacy Status | Notes |
|---|---|---|---|
| Meeting Notes Extraction — March 2026 | `.plans/archive/meeting-notes-extraction-march-2026/` | `REFERENCE` in legacy source | Source material, not execution work |
| Meeting Notes — Phase 3: Features | `.plans/archive/meeting-notes-phase3-features/` | `READY` | Idea extraction output; should be split into real feature hubs if still relevant |

## Recommended Next Moves

1. Keep the three completed items archived as historical record.
2. Normalize the six in-progress hubs by replacing generated `spec.md` placeholders with real requirements and by setting lane statuses in `status.json`.
3. Treat the six backlog items as queue candidates, but only after converting prompt-style artifacts into lane-ready plans.
4. Do not let automations act on the two meeting-note artifacts directly. Spin out dedicated hubs for any items you still want to build.
5. Review the imported `.claude/plans/*` archive hubs separately. They are centralized now, but they should not be mixed into product delivery status reporting unless explicitly promoted.
