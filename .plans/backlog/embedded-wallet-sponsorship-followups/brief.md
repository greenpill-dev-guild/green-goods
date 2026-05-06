# Embedded Wallet Sponsorship Follow-Ups

**Slug**: `embedded-wallet-sponsorship-followups`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-04-12T02:12:20.845Z`

## Problem

AppKit email/social auth, embedded wallet session restore, and progressive disclosure login UX already exist in the codebase, but the transaction path is incomplete. `EmbeddedSender` and `WalletSender` still fall back to unsponsored writes, the offline story for embedded users is only partially defined, and the login/auth surfaces warn about separate identities without fully explaining the consequences when users switch methods.

## Desired Outcome

- Embedded and compatible wallet users have a clear sponsored transaction path or an explicit fallback
- Offline/deferred signing behavior is honest and consistent for embedded auth
- Address continuity rules are obvious in login and auth flows
- Existing passkey auth and AppKit embedded login remain intact

## Scope Notes

- In scope: transaction sender capability follow-up, deferred-signing rules, login/auth copy cleanup, sender/auth tests
- Out of scope: cross-auth identity linking, backend account merge, contract changes, replacing the passkey flow

## Success Signal

The remaining embedded/wallet auth gaps are represented as a small, code-grounded backlog hub instead of a broad “web2 auth from scratch” scope.
