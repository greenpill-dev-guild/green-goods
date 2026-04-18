# Autonomy Harness Rollout Spec

## Summary

This hub operationalizes the April 18 autonomy research map. The current phase is not a broad new
implementation wave; it is the control-surface move that turns the research into a live queue,
captures completed Tier 0 unblockers, records the partial items and blockers, and sets the rule
for future cleanup: dead barrels and leaf helpers can be removed with reachability proof, but full
legacy views require route and feature-parity comparison before deletion.

## Users

- Primary: Afo, working interactively with Codex / Claude on the autonomy rollout
- Secondary: recurring automations and future specialist agents that need machine-readable state

## Functional Requirements

1. The autonomy rollout must exist as a valid `.plans/active/<feature-slug>/` hub with real
   `brief.md`, `spec.md`, `plan.todo.md`, `eval.md`, `status.json`, and handoff files.
2. The hub must map the existing research into the five authoritative plan-hub lanes without adding
   new top-level schema.
3. The hub must record current execution truth:
   - Tier 0 completed items
   - partial items
   - known blockers
   - Loop A cleanup results and the restored `GreenWillPanel.tsx` exception
4. The hub must preserve the idea document as the research map while making the active hub the live
   queue for execution state.
5. Full-view cleanup decisions must require both route-unreachability and live-surface parity review.
6. The hub and adjacent repo-truth docs must state that targeted `bun run test -- <file>` and
   `bun run test` are the fast iterative gates, while coverage stays scheduled or pre-merge.
7. The hub and adjacent repo-truth docs must state that `.plans/` is the durable repo truth and that
   any `.claude/agent-memory` pilot remains environment-local until freshness, expiry, and ownership
   rules exist.

## Non-Functional Constraints

- Package boundaries: keep this move inside `.plans/`, docs metadata, and plan-hub state; no new
  package or lane schema
- Performance: use light validation (`node scripts/plan-hub.mjs validate` plus targeted checks)
- Security: do not bypass `varlock` / 1Password env gates; record them as blockers
- Offline / sync: not applicable for this hub move
- Localization: no product-copy change; docs-only text here stays outside app i18n surfaces

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| UI / design specialist rollout | `ui` | Intentionally blocked until a pilot surface and D.6 verification path are chosen |
| Tier 0 unblockers, cleanup loops, docs / harness truth | `state_api` | Current active lane |
| Solidity / deployment work | `contracts` | `n/a` in the current phase |
| QA | `qa_pass_1`, `qa_pass_2` | Remain sequential and blocked until the state lane reaches a stable checkpoint |

## Risks

- Risk: deleting an unrouted full view that still has richer behavior than the live folded surface
- Mitigation: require route + parity review before deletion; restore preserved dormant surfaces when needed
- Risk: stale execution truth between the research map and the active hub
- Mitigation: keep the idea doc as research material and point all live lane state to this hub
- Risk: false confidence from env-gated or hanging validations
- Mitigation: record blocked validations explicitly and prefer the lightest honest check per surface
- Risk: tool-local memory drifting away from the active hub and becoming accidental repo truth
- Mitigation: keep `.plans/` authoritative and treat memory/checkpoint files as environment-local
