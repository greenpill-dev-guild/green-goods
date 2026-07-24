# Commitment Pooling Handoffs

These files are the lane-level dispatch surfaces for .plans/active/commitment-pooling/.

## Source order

1. status.json is machine truth for owner, lane state, dependencies, and dispatchability. Read `execution_sub_lanes` before trusting a machine-lane status: a ready machine lane can contain a blocked sub-lane (`contracts` ready does not make `settlement` dispatchable), and the blocked aggregate `ui` lane does not imply any sub-lane is dispatchable. Docs remains explicitly blocked through source convergence.
2. `contract-spec.md`, `settlement-spec.md`, `uiux-spec.md`, `diagrams.md`, `wireframes.md`, and `acceptance-matrix.md` define active behavior and final copy/state/public-claim proof. The CreditRegister design is a separate blocked backlog hub at `.plans/backlog/commitment-credit-follow-on/`.
3. plan.todo.md defines sequencing.
4. A handoff narrows one lane; it never overrides a blocked status or expands scope.
5. human-release-ops.md owns separately authorized broadcast, Garden-ID cutover, and live settlement exit evidence; human-settlement-evidence.md owns the September measurement-definition gate; implementation handoffs own only code, tests, artifacts, and dry runs.

## Required handoff contract

Every handoff records:

- Status: lane, owner, branch signal, current gate, and Linear context.
- Inputs: frozen specifications, upstream artifacts, and dependency evidence.
- Outputs: concrete deliverables owned by the lane.
- Acceptance: observable behavior and integration contracts.
- RED / GREEN: the first failing proof and the same proof passing, or an explicit proof limit for non-behavioral work.
- Exact Bun commands: runnable from the repository root unless another working directory is named.
- Out of scope: boundaries that may not be pulled into the lane.
- Unblock evidence: exact evidence required before status.json may advance.

Detailed proof is written here first and then recorded in status.json with the plan-hub record-tdd command. A handoff is not a branch-creation instruction.

There are thirteen agent handoffs plus two human handoffs. Human handoffs are authorization/evidence boundaries, not machine lanes.

## Linear boundary

linear.laneSyncMode is lane_issues (register #37, amended by register #39, 2026-07-20; supersedes register #31 and Decision Log #20). Each execution sub-lane carries a thin Linear issue: PRD-721 contracts · PRD-722 indexer · PRD-723 state/API · PRD-724 client UI · PRD-725 admin UI · PRD-726 editorial · PRD-727 docs · PRD-728 docs-guides · PRD-729 QA pass 1 · PRD-730 QA pass 2 · PRD-731 release ops · PRD-735 settlement evidence. PRD-650 is the parent of PRD-721–730 and PRD-735; PRD-731 is parentless. PRD-686 tracks settlement implementation and PRD-682 tracks Community. Linear owns status, dates, assignee, and dependencies; these handoffs own content, and a lane issue body must never restate handoff scope. Only ready agent-owned lanes receive `agent:*`; blocked, human, and follow-on records do not. Historical child IDs (PRD-671–681) remain labels, not dispatch targets. Handoffs still never create or dispatch Linear issues themselves — Afo does.

## Shared safety rules

- Preserve contract -> indexer -> shared -> client/admin/docs ordering.
- Use Bun wrappers; never raw forge.
- Hooks live in @green-goods/shared.
- Every user-facing string lands in en, es, and pt.
- Envio indexes Green Goods protocol events only, never EAS or raw Celo token transfers.
- Visible UI requires authenticated Brave proof; member PWA flows also require a real-device pass.
- Settlement confirmation is acknowledgment-only. Dispatched or Celo-executed/acknowledgment-pending is not arrived; only an authenticated success acknowledgment for the subject's current execution key and attempt produces Confirmed.
- No bridged G$, garden-held member-claim path, transferable voucher activation, credit scoring, or leaderboard behavior.
