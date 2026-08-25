# Cosmo-Local Credit Voucher Interoperability

**Slug**: `cosmo-local-credit-interop`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-08-25`
**Posture**: scoping and architecture only. **No implementation is authorized by this hub.**
**Linear**: [RESR-73](https://linear.app/greenpill-dev-guild/issue/RESR-73) design record ·
[RESR-74](https://linear.app/greenpill-dev-guild/issue/RESR-74) Slice 0 due diligence ·
[GROW-43](https://linear.app/greenpill-dev-guild/issue/GROW-43) hackathon entry
**Related hubs**: [`commitment-pooling`](../../active/commitment-pooling/),
[`commitment-credit-follow-on`](../../active/commitment-credit-follow-on/),
[`community-interface`](../../active/community-interface/),
[`celo-garden-account-safe-ownership`](../../active/celo-garden-account-safe-ownership/)

## Problem

Green Goods records contribution and never lets it move. A gardener's confirmed work — teaching a
session, cooking for the hub, running a workshop — becomes an attested record that is visible only
inside Green Goods and usable by no one, including the person who did it.

Two consequences follow.

**Inside a hub**, contribution that already happens informally stays incoherent. It may be
*recognized* — someone says thanks — but it is not *valued*, and it is not valued **against other
things**, so it cannot be reciprocated fairly, aggregated, or compared. Unpaid care and teaching
labor is the part that disappears most reliably.

**Outside a hub**, funders cannot see any of it without a Green Goods login. There is no
machine-readable surface a bank, council, or foundation can inspect with its own tools, so a
place-based organisation with a strong delivery record still reads as unbanked and uncollateralised.

Grassroots Economics' Cosmo-Local Credit network solves the second half — a deployed clearing
network for redeemable commitments on Gnosis — and has no source of truth for whether a commitment
was actually kept. Green Goods is that source of truth and has no exchange layer. The two halves
fit.

## Desired Outcome

**Should become possible**

- A gardener's confirmed contribution mints a Gnosis-native voucher they can transfer to someone
  else, who can use it.
- A garden gets an effective credit line — how much of its voucher a pool will absorb — set by its
  delivery record rather than by collateral it does not have.
- Value moves between gardens without converting to cash.
- A funder inspects a garden's pool from outside Green Goods, with their own tools, against a
  machine-readable profile.

**Should become easier or safer**

- Green Goods inherits a reviewed, deployed exchange layer (pool, router, quoters, limiter) instead
  of building and auditing an AMM.
- Contribution weighting becomes an explicit, frozen, published governance act instead of an
  implicit hierarchy.

**Should not change**

- `CommitmentRegistry` stays non-transferable and authoritative for promises. Vouchers are
  settlement instruments, never ownership of a promise.
- No custody in `CommitmentPoolingModule` or `CommitmentRegistry`.
- No per-person score, ordered participant comparison, or protocol-consumed individual standing.
- No bridged value. Vouchers are Gnosis-native; only authorization crosses.
- Clean-room boundary: no AGPL source is read, imported, or vendored.

## Scope Notes

**In scope for this hub**: architecture, the CPP crosswalk, the tension analysis, the slice
sequence, evidence gates, and the resource record.

**Out of scope for this hub**: every line of implementation, any deployment, any mainnet
transaction, any partnership commitment, any custody or authority change, and any Linear execution
issue. Those require their own scope lock and explicit human dispatch.

## Success Signal

One Green Goods garden's confirmed contributions mint a Gnosis-native voucher that is listed,
priced, and exchangeable in a Cosmo-Local Credit pool, and the pool is discoverable from outside
Green Goods through a machine-readable profile whose fulfilment figures trace back to counterparty
confirmations on Arbitrum.

The falsifiable version, which the pilot must actually answer: **do vouchers move through a third
party, or does everything settle bilaterally?** If it is all bilateral, the finding is that the
token was not needed — and per `commitment-pooling/pilot-evidence-spec.md` §8 that is a valid
result, not a failure.
