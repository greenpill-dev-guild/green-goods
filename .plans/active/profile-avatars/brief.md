# App Profile Avatars

**Slug**: `profile-avatars`  
**Stage**: `active`  
**Priority**: `p1`  
**Created**: `2026-07-29`  
**Linear Issue**: [PRD-762](https://linear.app/greenpill-dev-guild/issue/PRD-762/app-profile-avatars-signed-offchain-address-to-ipfs-pointer)  
**Linear Project**: `Commitment Pooling`  
**Linear Source**: `source:plans`

## Outcome

Green Goods stores one mutable, signed offchain avatar pointer per chain and primary account.
Client and admin users can upload, replace, clear, and recover an unsigned offline avatar draft.
Every authenticated identity surface resolves the image as app avatar, then ENS, then its local
fallback.

## Boundaries

In scope: shared protocol and browser state, agent SQLite/API verification, client Profile UI,
admin Profile UI, translations, tests, and authenticated Brave proof.

Out of scope: contracts, ENS writes, indexer behavior, deployment broadcasts, new dependencies,
and environment changes.
