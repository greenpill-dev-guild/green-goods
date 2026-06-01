# NYC Vault Crowdfunding

**Slug**: `nyc-vault-crowdfunding`
**Stage**: `active`
**Priority**: `p0`
**Created**: `2026-05-09T21:35:46.781Z`

## Problem

The public `/fund` surface lets people endow Garden vaults, but the current product truth still
points withdrawal management at the authenticated app/PWA Treasury path. That is not acceptable for
funders: a person who endows from the funding website must be able to return to the funding website,
connect or recover the owning account, see what they endowed, and withdraw without needing to install
or discover a separate app surface.

The June 1 Green Goods demo is now locked to a concrete public surface: one shareable `/fund` link
for the two deployed NYC Ethereum Octant vaults. That demo must support Wallet Endow and Thirdweb
Card Endow. Public Donate and Card Donate remain deferred out of sprint scope.

The card/Thirdweb lane also needs a hard product boundary. Secrets and planned integration are not
enough; card funding must not create hidden custody or stranded vault shares. The sprint-critical
Card Endow path must deposit vault shares to the user-owned or recovered wallet account, not a
provider-owned account, and must not launch until ownership, vault-share verification, public
visibility, and successful withdrawal proof are proven end to end.

## Desired Outcome

- `/fund` exposes a shareable public demo link for the two deployed NYC Ethereum Octant vaults.
- Wallet Endow works for both NYC vaults from the public demo surface.
- Thirdweb Card Endow works for both NYC vaults after the recovered-wallet ownership and
  share-verification gates pass.
- `/fund` includes a connected-account "My Endowments" panel where wallet and recovered email-wallet
  users can see and withdraw their own endowment positions.
- Endowment receipts and success states return to a public management deeplink on `/fund`, not to an
  app install prompt.
- Wallet Endow remains available while this public withdrawal management work is built.
- Card Endow remains hidden during implementation until it deposits to a user-owned email/social
  wallet and that position is visible, share-verified, and withdrawable from `/fund`; after that gate,
  it is part of the June 1 demo surface.
- Public Donate is not exposed on `/fund` during this sprint; the existing low-level Cookie Jar code is
  preserved for future non-Cookie-Jar Donate planning.
- The reusable vault crowdfunding UI skill work is tracked from this hub as a follow-on planning lane:
  Green Goods is the demo fixture, while the skill itself must stay reusable for Octant and other
  public-goods communities.
- PWA Treasury remains an alternate management surface, not the required withdrawal path.

## Scope Notes

- In scope: public `/fund` endowment management UI and deeplink, the two deployed NYC Ethereum
  Octant vault demo configuration, Wallet Endow for both vaults, Thirdweb Card Endow for both vaults
  behind recovered-wallet custody proof, shared public endowment-position data layer, reuse of
  existing vault withdraw mechanics with the safe withdrawal limit, receipt return path, explicit
  vault/endow lane availability, Card Endow receiver-account and share-verification gating, public
  funding docs/design truth cleanup, targeted tests.
- Out of scope: public Donate/Card Donate for this sprint, migrating existing positions, fiat/card
  off-ramp on withdrawal, public address lookup, new contract logic, indexer schema changes, PWA shell
  redesign, admin UI, deployment broadcasts.
- Tracking only in this pass: skill instructions, input contracts, template boundaries, and Linear
  child issues for reusable skill work. Building the skill/template is not part of this metadata
  update.

## Locked Lane Matrix

| Lane | Sprint Status | Gate |
|---|---|---|
| Wallet Endow | In scope for June 1 demo | Direct vault deposit from the connected wallet into each deployed NYC Ethereum Octant vault. |
| Manage Endowments | In scope | Public `/fund?manage=endowments` withdrawal surface with no private URL data. |
| Thirdweb Card Endow | In scope for June 1 demo, hidden until proof passes | Recovered-wallet `receiverAddress`, vault-share verification, public visibility, and successful withdrawal proof must pass before exposure. |
| Donate | Deferred | Separate future non-Cookie-Jar scope; no public `/fund` Donate CTA in this sprint. |
| Card Donate | Deferred | Separate future non-Cookie-Jar scope; Thirdweb Card Endow proof must not imply Card Donate support. |

## Implementation Phases

1. Scope/plan lock + Linear sync.
2. Wallet Endow public demo path for the two deployed NYC Ethereum Octant vaults.
3. Thirdweb Card Endow demo path for the same two vaults, preserving user custody.
4. Ownership/share verification gate: recovered wallet owns the vault shares and the proof is
   recorded before Card Endow exposure.
5. Public Manage Endowments / withdrawal proof through `/fund?manage=endowments`.
6. Demo QA pass across wallet, card, ownership, manage, privacy, desktop, and mobile proof.
7. Reusable skill planning handoff after Green Goods demo validation.

Check in with the human after phases 2, 3, 5, and 6 before continuing into the next implementation
phase.

## Reusable Skill Tracking

The local crowdfunding UI plan also tracks the future reusable skill, but that work starts only after
the Green Goods demo is validated. The simplest reusable skill output is frontend UI for existing
Ethereum Octant vaults using standard RPC plus wallet connection. Green Goods and the NYC vaults are
the first fixture, not the hardcoded default.

Advanced reusable-skill modules are follow-on work: backend/API card-provider modules with Thirdweb
first, future Stripe/Coinbase adapters, and optional create-vault support through an Octant
factory/API path. Secrets, provider setup, webhook verification, receipt policy, and redacted logs are
backend concerns, not generated client-only skill output.

The tracking record is explicit so future implementation agents do not confuse the portable skill
work with the June 1 `/fund` sprint:

- The skill will live first in the repo's canonical skill source and mirror to the agent skill surface
  when implementation starts after demo validation.
- DesignMD input is required; Green Goods Warm Earth is a fixture, not the default for every community.
- Wallet-first vault endow/deposit is the active runtime assumption.
- Thirdweb, Stripe, and Coinbase card rails are backend adapter modules; Thirdweb is demo-critical for
  Green Goods, while the portable skill module remains a later reusable implementation.
- Existing vaults are the default; create-vault support is an optional operator setup module.

## Success Signal

A funder can use the shareable public `/fund` demo link to Wallet Endow or Thirdweb Card Endow either
of the two deployed NYC Ethereum Octant vaults, return later to `/fund`, connect or recover the owning
account, see the endowed position, and complete a withdrawal back to that account with test, browser,
and QA evidence.
