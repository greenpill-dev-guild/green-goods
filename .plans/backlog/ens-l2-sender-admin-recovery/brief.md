# ENS L2 Sender Admin Recovery

**Slug**: `ens-l2-sender-admin-recovery`
**Stage**: `backlog`
**Priority**: `p1`
**Created**: `2026-04-26T01:43:40Z`

## Problem

The current ENS architecture gives the Ethereum receiver owner admin recovery tools, but the Arbitrum sender is also a gatekeeper for username claims and has no equivalent admin recovery surface. That means operators can remove or register a `*.greengoods.eth` record on L1, but they cannot clear stale L2 sender state such as `ownerToSlug`, `slugOwner`, or `slugNameType` for a user who needs recovery.

This is especially visible for passkey users. First-time sponsored claims work on the current sender. The gap is username change/release and lost-passkey recovery, where L2 state can block the next claim even if L1 ENS records are fixed by an operator.

## Desired Outcome

- Operators have a safe, auditable way to release or repair user ENS state on the Arbitrum sender.
- Passkey users can recover from lost devices, accidental account loss, or username-change requests without requiring ad hoc contract work.
- L1 receiver and L2 sender recovery behavior stays consistent so support actions do not create split-brain ENS state.

## Ship-Now Product Updates

These are the current-contract updates to make before the sender recovery work lands:

- Treat the profile release path for legacy passkey users as a support request, not a broken self-service transaction.
- Rename the disabled release CTA to a clear request flow such as `Request username change`.
- Capture current slug, current smart-account address, desired slug, contact path, and reason.
- Route requests to an operator queue/runbook.
- For users who still control the current passkey, fund the smart account and have them call existing `releaseName()`.
- For users who lost the passkey, explain that they can claim a new username immediately, while exact-name recovery requires operator handling.

## Scope Notes

- In scope: L2 sender recovery functions, migration path, admin/operator runbooks, tests, and UI/state hooks needed to expose the recovery status cleanly.
- Out of scope: replacing CCIP, changing `greengoods.eth` ownership, or delaying first-time username claims.
- Do not remove the current production gate until the deployed sender actually supports the recovery path.

## Success Signal

An operator can recover a user from stale L2 ENS state without redeploying the whole protocol, and the app can tell passkey users exactly what will happen when they request a username change or recovery.
