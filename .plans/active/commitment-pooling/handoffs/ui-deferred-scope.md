# UI Deferred Scope Handoff

**Status:** todo
**Owner:** Afo (triage)
**Opened:** 2026-09-27

The hub closed `ui_client`, `ui_admin` and `editorial` on 2026-09-27 to match their Linear issues,
PRD-724 to PRD-726. Each lane left scope unbuilt, and some of it has shipped since. This lane holds
that scope so it is not lost when the hub closes. Before closeout, mark each item as built since,
moved to a named issue or lane, or dropped.

## Where the items are listed

- Client: the "Not built" rows of "Built / not built — D1 client loop" in
  [claude-ui-client.md](claude-ui-client.md), plus the settlement, consideration and saved-Offer
  bullets under that table.
- Admin: the "not built" rows of "D1 built / not built" in [claude-ui-admin.md](claude-ui-admin.md),
  including the D2 capture and assessment screens and the hypercert allocation step.
- Editorial: the NOT MET rows of "Unblock evidence" in [claude-editorial.md](claude-editorial.md).
- Plan: the workstream rows in [plan.todo.md](../plan.todo.md) that point to `ui_deferred_scope`.

## Already routed

- Exchange-pair screens (W28–W31): the follow-on `exchange_architecture` entry in `status.json`.
- D2 close-the-season: assigned to the readiness plan's fix window and re-QA run
  ([qa-readiness-plan.md](../qa-readiness-plan.md)). Ending a season (End and Archive) has merged;
  recording an external payout is still a gap there (§ 6.6, § 7) and stays pending until it is
  built and walked.
- Live Gardener Celo wallet evidence: [codex-gardener-celo-wallets.md](codex-gardener-celo-wallets.md)
  and release ops.
