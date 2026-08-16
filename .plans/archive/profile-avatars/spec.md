# App Profile Avatars Specification

> **Archived record:** implementation is closed. Operational handoffs, artifacts, and lane files were removed; preserved reports and any references below describe historical execution, not live work.

## Record

The public record is keyed by normalized `(chainId, address)` and contains `avatarUri`,
`version`, and `updatedAt`. Missing records read as version `0`. Clears persist a nullable
tombstone and increment the version.

## Authorization

Set and clear mutations sign the exact canonical message defined in PRD-762. The agent accepts
only the configured chain, canonical `ipfs://CID` values, signatures issued within five minutes,
and the current expected version. Wallet and embedded EOAs, deployed ERC-1271 accounts, and
counterfactual ERC-6492 accounts are supported.

## Browser behavior

JPEG, PNG, and WebP inputs are decoded, center-cropped, and encoded as 512 by 512 WebP files no
larger than 1 MB. Unsigned offline drafts are scoped to chain and primary address and survive
reload. Signing always happens interactively with fresh server state.

## UI behavior

The client editor opens from the `/home/profile` avatar. The admin editor opens from the same
`AccountProfilePanel` used by the desktop Profile side sheet and mobile `/profile` Account tab.
Draft previews are explicitly unpublished. Replacing or clearing a pointer discloses that old
IPFS content remains publicly addressable.
