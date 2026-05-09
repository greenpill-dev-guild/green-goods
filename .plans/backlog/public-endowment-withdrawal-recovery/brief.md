# Public Endowment Withdrawal Recovery

**Slug**: `public-endowment-withdrawal-recovery`
**Stage**: `backlog`
**Priority**: `p0`
**Created**: `2026-05-09T21:35:46.781Z`

## Problem

The public `/fund` surface lets people endow Garden vaults, but the current product truth still
points withdrawal management at the authenticated app/PWA Treasury path. That is not acceptable for
funders: a person who endows from the funding website must be able to return to the funding website,
connect or recover the owning account, see what they endowed, and withdraw without needing to install
or discover a separate app surface.

The card/Thirdweb lane also needs a hard product boundary. Secrets and planned integration are not
enough; card funding must not create hidden custody or stranded vault shares. Card Donate can recover
first once checkout and webhook proof are real. Card Endow must stay gated until ownership and
withdrawal are proven end to end.

## Desired Outcome

- `/fund` includes a connected-account "My Endowments" panel where wallet and recovered email-wallet
  users can see and withdraw their own endowment positions.
- Wallet Endow remains available while this public withdrawal management work is built.
- Card Donate has a clear recovery path through real Thirdweb checkout/webhook proof.
- Card Endow remains hidden until it deposits to a user-owned email/social wallet and that position is
  visible and withdrawable from `/fund`.
- PWA Treasury remains an alternate management surface, not the required withdrawal path.

## Scope Notes

- In scope: public `/fund` endowment management UI, shared public endowment-position data layer,
  reuse of existing vault withdraw mechanics, receipt return path, Thirdweb/card Donate proof path,
  card Endow gating, public funding docs/design truth cleanup, targeted tests.
- Out of scope: migrating existing positions, fiat/card off-ramp on withdrawal, public address lookup,
  new contract logic, indexer schema changes, PWA shell redesign, admin UI, deployment broadcasts.

## Success Signal

A funder can endow from `/fund`, return later to `/fund`, connect or recover the owning account, see
the endowed position, and complete a withdrawal back to that account with test and QA evidence.
