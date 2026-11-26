# Green Goods Name Reservation at Sign-Up

**Slug**: `green-goods-name-reservation`
**Stage**: `backlog`
**Priority**: `p2`
**Created**: `2026-09-22T00:26:22Z`

## Problem

A person picks a name twice, and the second time they may not get it.

At sign-up they choose a passkey username. It is stored by the passkey server, it is how they
sign in on another device, and the app shows it as their name. Later, once they belong to a
garden, the app invites them to claim a `*.greengoods.eth` name, and that claim goes through a
different namespace with different rules. Nothing connects the two. Someone else can already
hold the username you chose as their Green Goods name, and you find out at the moment you try
to claim it — after you have been using that name for weeks.

The two namespaces also disagree about what a name may look like. The sign-up field accepts any
display name of three characters or more; the slug is `[a-z0-9-]`, 3–50 characters, with no
leading, trailing, or doubled hyphen. So a chosen username is often not a legal slug at all, and
the app has to propose something adjacent instead.

The founder's direction is that the username a person picks should become their Green Goods
name, reserved at the moment the account is created, and that an account whose wallet already
has an ENS name should simply use it.

## Desired Outcome

- The name a person picks at sign-up is theirs. Nobody else can take it while they decide
  whether to finish registering it.
- A name that cannot become a Green Goods name is refused at sign-up, when changing it is free,
  rather than at claim time, when the person has already learned their name.
- An account whose wallet already carries an ENS name is not asked to invent a second one.
- Registration stays where it is: a later, membership-gated, roughly 15–20 minute on-chain step.
  Reserving a name does not mean registering it.
- Nothing about sign-in or account recovery gets slower or less reliable.

## Scope Notes

- In scope: what a reservation is and where it is enforced; the naming rules a username must
  satisfy; collision and expiry behavior; how a reservation relates to the membership gate and
  to the existing registration path; what a wallet's existing ENS name means for the Green
  Goods name; migration for accounts that already exist.
- Out of scope: changing `greengoods.eth` ownership; replacing the CCIP L2→L1 path; the
  operator recovery surface already owned by `ens-l2-sender-admin-recovery`; the observability
  work owned by `ens-operations-optimizations`; building the identity-unification UI itself,
  which this hub only has to leave possible.

## Success Signal

A person who signs up with the name they want, and comes back a month later to finish claiming
it, gets that exact name — and a person who picks a name that is already taken learns it in the
sign-up form, not after they have started using it.
