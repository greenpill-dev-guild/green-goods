# Public Endowment Withdrawal Recovery

**Slug**: `public-endowment-withdrawal-recovery`
**Stage**: `active`
**Priority**: `p0`
**Created**: `2026-05-09T21:35:46.781Z`

## Problem

The public `/fund` surface lets people endow Garden vaults, but the current product truth still
points withdrawal management at the authenticated app/PWA Treasury path. That is not acceptable for
funders: a person who endows from the funding website must be able to return to the funding website,
connect or recover the owning account, see what they endowed, and withdraw without needing to install
or discover a separate app surface.

The card/Thirdweb lane also needs a hard product boundary. Secrets and planned integration are not
enough; card funding must not create hidden custody or stranded vault shares. The June 1 NYC sprint
is locked to vault/endow work only. Public Donate and Card Donate are deferred to separate future
non-Cookie-Jar scope. Card Endow remains in scope, but must stay hidden until recovered-wallet
ownership, vault-share verification, public visibility, and successful withdrawal proof are proven
end to end.

## Desired Outcome

- `/fund` includes a connected-account "My Endowments" panel where wallet and recovered email-wallet
  users can see and withdraw their own endowment positions.
- Endowment receipts and success states return to a public management deeplink on `/fund`, not to an
  app install prompt.
- Wallet Endow remains available while this public withdrawal management work is built.
- Card Endow remains hidden until it deposits to a user-owned email/social wallet and that position is
  visible, share-verified, and withdrawable from `/fund`.
- Public Donate is not exposed on `/fund` during this sprint; the existing low-level Cookie Jar code is
  preserved for future non-Cookie-Jar Donate planning.
- The reusable vault crowdfunding UI skill work is tracked from this hub as a follow-on planning lane:
  Green Goods is the demo fixture, while the skill itself must stay reusable for Octant and other
  public-goods communities.
- PWA Treasury remains an alternate management surface, not the required withdrawal path.

## Scope Notes

- In scope: public `/fund` endowment management UI and deeplink, shared public endowment-position data
  layer, reuse of existing vault withdraw mechanics with the safe withdrawal limit, receipt return
  path, explicit vault/endow lane availability, Card Endow receiver-account and share-verification
  gating, public funding docs/design truth cleanup, targeted tests.
- Out of scope: public Donate/Card Donate for this sprint, migrating existing positions, fiat/card
  off-ramp on withdrawal, public address lookup, new contract logic, indexer schema changes, PWA shell
  redesign, admin UI, deployment broadcasts.
- Tracking only in this pass: skill instructions, input contracts, template boundaries, and Linear
  child issues for reusable skill work. Building the skill/template is not part of this metadata
  update.

## Locked Lane Matrix

| Lane | Sprint Status | Gate |
|---|---|---|
| Wallet Endow | In scope | Direct vault deposit from the connected wallet. |
| Manage Endowments | In scope | Public `/fund?manage=endowments` withdrawal surface with no private URL data. |
| Card Endow | In scope, hidden | Recovered-wallet `receiverAddress`, vault-share verification, public visibility, and successful withdrawal proof must pass before exposure. |
| Donate | Deferred | Separate future non-Cookie-Jar scope; no public `/fund` Donate CTA in this sprint. |

## Reusable Skill Tracking

The local crowdfunding UI plan also tracks the future reusable skill that lets a community generate a
vault-centered crowdfunding page from a small set of inputs: a DesignMD file, campaign/community
context, an existing vault manifest, optional create-vault setup, and optional card-provider adapter
choices. Green Goods and the NYC vaults are the first fixture, not the boundary of the skill.

The tracking record is explicit so future implementation agents do not confuse the portable skill
work with the June 1 `/fund` sprint:

- The skill will live first in the repo's canonical skill source and mirror to the agent skill surface
  when implementation starts.
- DesignMD input is required; Green Goods Warm Earth is a fixture, not the default for every community.
- Wallet-first vault endow/deposit is the active runtime assumption.
- Stripe, Coinbase, and Thirdweb card rails are adapter slots only until separately implemented behind
  a server boundary.
- Existing vaults are the default; create-vault support is an optional operator setup module.

## Success Signal

A funder can endow from `/fund`, return later to `/fund`, connect or recover the owning account, see
the endowed position, and complete a withdrawal back to that account with test and QA evidence.
