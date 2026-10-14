# Green Goods Name Reservation at Sign-Up Spec

## Summary

Make the name a person chooses when their passkey account is created the name they will hold as
`<name>.greengoods.eth`. Today those are two unrelated namespaces with different rules, different
authorities, and no link between them, so a chosen username can already belong to someone else as
a Green Goods name. This spec settles what a reservation is, where it can actually be enforced,
what happens to names that cannot become slugs, and how a reservation relates to the membership
gate and the existing registration path. Registration itself does not move: it stays a later,
membership-gated, cross-chain step.

## Users

- Primary: a person creating a passkey account, who should get the name they pick.
- Secondary: a wallet user who already has a mainnet ENS name and should not be asked to invent a
  second identity; gardeners who already signed up under the current rules; stewards and the
  public, who read these names on work, gardens, and the public site.

## The two namespaces today

| | Passkey username | Green Goods name (slug) |
|---|---|---|
| Chosen at | Sign-up, before the WebAuthn ceremony | Profile, after joining a garden |
| Authority | Pimlico passkey server, per chain + API key | L2 `GreenGoodsENS` cache; L1 `GreenGoodsENSReceiver` is the source of truth (`ENS.sol:46-47`) |
| Rules | `trim().length >= 3`, nothing else (`useLoginScreenController.ts:247`, `Auth.tsx:410-413`) | 3–50 chars, `[a-z0-9-]`, no leading, trailing, or doubled hyphen (`ens.ts:32-49`) |
| Uniqueness | Client check-then-act, and only when the passkey server is enabled (`authServices.ts:145-153`) | On-chain `NameTaken` (`ENS.sol:287`) |
| Bound to the account? | No. The address comes from the passkey credential (`auth-passkey-adapters.ts:132-138`) | Yes, one name per address (`ownerToSlug`, `AlreadyHasName`, `ENS.sol:296`) |
| Stored | `localStorage` key `greengoods_username` (`session.ts:37`) plus the passkey server | On-chain only; not indexed, not in the agent |
| Purpose | A lookup handle for recovery on another device (`views/Login/index.tsx:113-117`) | Public identity |

The consequence is the reported problem: a person signs up as `maya`, uses that name for weeks,
and finds at claim time that `maya.greengoods.eth` belongs to someone else. Nothing is wrong in
either system; they simply do not know about each other.

## Functional Requirements

1. A name accepted at sign-up must be a name that can become a Green Goods name: it satisfies
   `validateSlug`, it is not already registered on either chain, and it is not held by another
   account's reservation.
2. A reservation holds a name for the account that made it, across every path this app controls,
   until the account registers it or the reservation ends.
3. A reservation is not a registration. It does not mint a subname, does not require protocol
   membership, and does not spend gas.
4. Registering a reserved name is the existing claim, unchanged: membership-gated, sponsored for
   passkey accounts, roughly 15–20 minutes to become active.
5. A reservation ends on a stated, visible condition. It must not hold a name forever for an
   account that never joins a garden.
6. An account whose wallet already resolves a mainnet ENS name is treated as already named and is
   not nudged to claim a second one.
7. Accounts that already exist keep working. No existing username is invalidated, and no existing
   registration changes.
8. Every name shown for an account resolves by one documented rule, on the PWA, the admin cockpit,
   and the public site.

## Research Evidence

### Source files, tests, or docs reviewed

- Sign-up and auth: `packages/client/src/views/Login/index.tsx`,
  `packages/shared/src/hooks/client-ui/auth/useLoginScreenController.ts`,
  `packages/shared/src/providers/Auth.tsx`, `packages/shared/src/workflows/authServices.ts`,
  `packages/shared/src/workflows/authMachine.ts`,
  `packages/shared/src/workflows/auth-passkey-adapters.ts`,
  `packages/shared/src/config/passkeyServer.ts`, `packages/shared/src/modules/auth/session.ts`
- Naming: `packages/shared/src/utils/blockchain/ens.ts`,
  `packages/shared/src/hooks/ens/{useENSClaim,useSlugAvailability,useSlugForm,availability,useENSRegistrationStatus,useENSReleaseName,useGreenGoodsEnsName,useProtocolMemberStatus}.ts`,
  `packages/client/src/views/Profile/{ENSSection,ENSUsernameChangeRequest}.tsx`,
  `packages/client/src/routes/ENSClaimReminder.tsx`
- Contracts: `packages/contracts/src/registries/ENS.sol`,
  `packages/contracts/src/registries/ENSReceiver.sol`, `packages/contracts/src/tokens/Garden.sol`,
  `packages/contracts/src/modules/Hats.sol`,
  `packages/contracts/test/unit/GreenGoodsENS.t.sol`
- Ontology and neighbours: `packages/shared/src/ontology/green-goods-ontology.json`,
  `packages/indexer/schema.graphql`, `.plans/backlog/ens-l2-sender-admin-recovery/`,
  `.plans/backlog/ens-operations-optimizations/`

### Evidence confirmed

- **No reservation concept exists anywhere.** `GreenGoodsENS` holds exactly four mappings —
  `slugOwner`, `slugNameType`, `ownerToSlug`, `slugReleasedAt` (`ENS.sol:48-51`). A claim writes
  final ownership synchronously on L2 (`_cacheRegistration`, `ENS.sol:286-303`) before CCIP
  delivers anything. `available()` flips to false at that moment. There is no hold, pre-claim,
  commit-reveal, queue, or expiry.
- **Registration is membership-gated in the contract, not only in the UI.** Both `claimName` and
  `claimNameSponsored` open with
  `if (!HATS.isWearerOfHat(msg.sender, protocolHatId)) revert NotProtocolMember();`
  (`ENS.sol:118`, `:128`). The protocol hat is auto-minted on any garden role grant
  (`Hats.sol:659-665`). So a name cannot be registered before the person joins a garden, by the
  app or by anyone else.
- **The deployed Arbitrum sender is a direct contract, not an upgradeable proxy**
  (`.plans/backlog/ens-l2-sender-admin-recovery/spec.md:36`), deployed at
  `0x4fAD8Db8e04005884D484eC730aDae10d7A2e491` (`deployments/42161-latest.json:18`). Any on-chain
  reservation means a new sender plus a state migration, and its mappings are not enumerable
  on-chain, so the migration needs an event or L1-receiver manifest.
- **Availability is two on-chain reads and nothing else.** `isSlugAvailableAcrossChains`
  (`availability.ts:70-103`) reads `available(slug)` on the L2 sender, then on the L1 receiver. No
  indexer entity, no agent route: a search of `packages/agent/src` and the indexer config for ENS
  returns nothing, and the indexer's `Gardener.ensName` / `passkeyCredentialId` fields
  (`schema.graphql:1533-1536`) are never populated by any handler.
- **Username uniqueness is best-effort and conditional.** `registerWithServer` reads
  `getCredentials({ context })` and throws when it returns anything (`authServices.ts:145-153`).
  This is check-then-act, so two concurrent registrations can both pass; the scope is one Pimlico
  endpoint (chain + API key); and when the passkey server is disabled — the dev default,
  `passkeyServer.ts:42-48` — `createLocalPasskey` runs with no lookup at all.
- **The username is not bound to the account.** The Kernel address is derived from the passkey
  credential (`auth-passkey-adapters.ts:132-138`); renaming does not move the account, and two
  people on one name get two different accounts. The username's load-bearing job is finding your
  credential on another device.
- **Username rules are far looser than slug rules.** Only `length >= 3` is enforced, in three
  places (`useLoginScreenController.ts:170-179`, `Auth.tsx:410-413`,
  `passkeyServer.ts:54-64`). No maximum, no character set, no reserved words. The server path
  lowercases and strips a leading `@`; the local path stores the raw trimmed string, so existing
  usernames differ in casing by which path created them.
- **`user_<digits>` is no longer generated.** It was removed in `d284749a7` (2026-01-18); the
  absent-name value is now the empty string, deliberately (`Auth.tsx:436-441`). Only the legacy
  detector survives, now module-private behind `chosenPasskeyUsername` (`text.ts:61-78`).
- **Slug rules are already duplicated in four places**, named in the comment at `ens.ts:28-30`:
  `ENS.sol:_validateSlug`, `ENSReceiver.sol:_isValidSlug`, `useSlugForm.ts:slugSchema`, and
  `ens.ts:validateSlug`. A sign-up check must reuse `validateSlug`, not add a fifth copy.
- **There is no reserved-name list.** Nothing protects `admin`, `support`, `greengoods`, or any
  garden's name. Anything matching the charset is first-come.
- **Gardens and gardeners share one namespace.** `NameType { Gardener, Garden }`
  (ontology `ens-name-type`; `ENS.sol`). Garden names are registered by `GardenToken` at mint
  through the authorized-caller path (`Garden.sol:405-418`) and **cannot be released**
  (`CannotReleaseGardenName`). A gardener reservation can therefore block a future garden name,
  permanently and in the other direction.
- **Release has a 30-day cooldown that blocks everyone**, including the previous owner
  (`ENS.sol:55-56`, `:291-294`, proven by `GreenGoodsENS.t.sol:393-407`), and it exists only on
  L2 — the L1 receiver's `available()` has no cooldown term. There is no first-in-line after it
  expires.
- **Passkey users on Arbitrum cannot release a name today.** The deployed sender is in
  `LEGACY_ENS_SENDERS_WITHOUT_SPONSORED_RELEASE` (`useENSReleaseName.ts:44-46`), so the app routes
  them to a support request instead (`ENSUsernameChangeRequest.tsx`), which reserves nothing.
- **The ontology deliberately excludes the passkey from domain vocabulary**: the `passkey`
  supporting term carries the reason "Authentication credential; account infrastructure, not
  domain vocabulary." There is no `identity`, `username`, or `green-goods-name` entity. This spec
  therefore treats the Green Goods name as the domain identity and the username as an input to
  it, rather than promoting the credential's handle into the domain.
- **The public site cannot resolve names from the chain.** `check-pwa-precache-budget.mjs:34-35`
  forbids `/config/default-chain` and `/hooks/blockchain/` in public routes, which is why ENS
  names were removed there. Any cross-surface name unification needs an off-chain read.

### Open inferences or assumptions

- The "15–20 minutes" figure is UI copy only; the enforced number is a 25-minute client timeout
  (`useENSRegistrationStatus.ts:87`). No measured latency exists in the repo.
- Whether the Pimlico passkey server itself enforces uniqueness atomically is outside this
  codebase. Our check is a read followed by a write.
- The number of existing accounts whose username is not a valid slug is unknown and unknowable
  from the repo: usernames live in `localStorage` and the passkey server, and are not indexed.

## The six questions, answered

### 1. What "reserve" means, and where it can be enforced

A reservation is **a claim of intent held off-chain against one account address, which every path
this app controls honors, and which the on-chain claim consumes**. It is not ownership.

Where it can actually be enforced, given the evidence:

| Layer | Can it hold a name? | Cost |
|---|---|---|
| Passkey server uniqueness alone | No. It only stops a second *account* on that name. It says nothing about the slug, and it is off in local mode. | Free; exists today |
| Availability check at sign-up | No. It refuses a name already registered at that instant, but holds nothing afterwards. | One extra cross-chain read at sign-up |
| Off-chain reservation record | Yes, for every claim made through the app. A protocol member transacting directly against the contract still wins. | A new store, signed like join requests |
| On-chain reservation | Yes, absolutely. Requires a new sender and a state migration. | A contract deployment and migration |

**Recommendation: the availability check plus the off-chain record, and be honest in the copy that
it is a hold, not ownership.** The reservation is authoritative for the app; the chain stays
authoritative for registration. The on-chain option should be folded into the sender v2 that
`ens-l2-sender-admin-recovery` already needs, rather than motivating its own deployment.

The off-chain record has an exact precedent in this repo: garden join requests are a signed,
expiring, revisioned record keyed by account address, stored by the agent
(`packages/agent/src/api/routes/garden-join-request-*.ts`). A reservation is the same shape with a
different payload, and should reuse that pattern rather than inventing a second one.

### 2. Slug rules versus username rules

The slug rules win, because they are the ones the contract enforces. At sign-up the app should run
the existing `validateSlug` and refuse what it refuses, with the same messages the claim form
already uses.

What that costs: the sign-up field stops accepting capitals, spaces, accents, emoji, and `.eth`
suffixes. The placeholder today is literally `"e.g. alice or alice.eth"`. This is a real narrowing
of a first-run field, and it is the main product tradeoff in this plan.

Two ways to soften it, both of which keep one rule:

- **Normalize and confirm.** The person types what they like; the app shows the slug it will
  reserve (`suggestSlug` already does exactly this transformation) and asks them to accept it.
  `Maya Silva` becomes `maya-silva`, visibly, before they commit.
- **Refuse outright**, with the claim form's error text.

Normalize-and-confirm is recommended: it preserves the friendly first-run field, it makes the
Green Goods name visible at the moment the person is thinking about their name, and it reuses
`suggestSlug` and `validateSlug` unchanged.

**Existing usernames that are not valid slugs are left alone.** They keep working as recovery
handles, because that is what they are. When such an account reaches the claim form, it gets
today's behavior, which the short-term fix already improved: the form prefills `suggestSlug(name)`
and the person edits it. Nothing is migrated, nothing is invalidated. See question 6.

### 3. Collisions and expiry

Three collision surfaces, and they need different answers:

- **Against a registered name.** Checked at sign-up with `isSlugAvailableAcrossChains`, which
  already covers both chains and the 30-day cooldown, and which fails closed on RPC error
  (`useSlugAvailability.ts:49-50`). A sign-up must not be blocked by an RPC outage, so the
  reservation is the thing that fails closed, not the sign-up: if the check cannot run, create the
  account without a reservation and let the person reserve later.
- **Against another reservation.** The reservation store is the authority. First write wins;
  the second gets the claim form's "already taken" message.
- **Against an existing passkey username.** Not a collision worth enforcing. Usernames are not
  unique today in any complete sense, and a username is not a name anyone else sees on-chain.
  Making sign-up refuse a name because some other account's *recovery handle* matches it would be
  a new restriction with no domain meaning.

**Expiry.** A reservation must expire, or a name is dead the moment someone signs up and leaves.
The natural clock is the one the reservation is waiting on: protocol membership. Proposed default,
for the founder to confirm: **90 days from sign-up, refreshed whenever the account signs in**, and
released immediately when the account registers a different name. An account that comes back is
still holding its name; an account that never returns gives it up. This is the single most
product-shaped number in the plan and it is listed as an open question.

Gardens are the asymmetric case. A garden name is permanent and is registered by the mint path,
which will not consult a reservation. Two defensible answers: let the garden mint win and tell the
gardener their reservation was displaced, or refuse to reserve a name a garden already holds and
accept that a later garden mint can still displace one. Neither is free; this is an open question.

### 4. Membership and reservation

They compose cleanly, and this is the strongest argument for the feature. The contract requires
the protocol hat to register (`ENS.sol:118`, `:128`), and the hat arrives automatically with any
garden role (`Hats.sol:659-665`). So the gap between "I picked my name" and "I am allowed to
register it" is exactly the gap a reservation fills. The order becomes:

```
sign up → name reserved → join a garden → hat minted → claim (~15-20 min) → registered
```

Today `ENSClaimReminder` already nudges a member with no name
(`ENSClaimReminder.tsx:44`). With reservations that nudge gets better: it can say which name is
being held and how long the hold lasts, rather than inviting the person to invent one.

Nothing about the membership gate itself should change. Reserving before membership is the point;
registering before membership stays impossible.

### 5. Wallet accounts with a mainnet ENS name

"Just use their ENS name" is a **display rule, not a registration**. A `*.greengoods.eth` subname
is minted to the receiver contract and the user holds only the resolver `addr` record
(`ENSReceiver._setENSRecords`); a mainnet ENS name cannot be moved into that namespace, and
registering a matching slug would create a second name for an account that already has one.

So: an account whose wallet resolves a mainnet ENS name is **already named**. The app should stop
nudging it to claim, and every surface should show that name. The display priority already exists
in the code and only needs to be stated once and applied everywhere:

```
Green Goods name → wallet ENS name → chosen passkey username → shortened address
```

This leaves one genuine question. There is no reserved-name list, so anyone may claim
`vitalik.greengoods.eth` today whether or not they hold `vitalik.eth`. Reserving the matching slug
for a verified ENS holder would close that, at the cost of holding names for people who may never
use Green Goods. Listed as an open question.

### 6. Migration and identity unification

**Migration is lazy, not a batch.** Existing usernames live in `localStorage` and the passkey
server and are not enumerable, and on-chain slug mappings are not enumerable either. There is no
list to iterate. The only honest path is to act when an account appears: on sign-in, if the
account has no Green Goods name and no reservation, check whether its username is still available
as a slug and offer to reserve it. If it is taken or invalid, offer the normalized suggestion.
Nothing is done to accounts that never return.

**Identity unification depends on one thing this plan can provide cheaply.** The public site
cannot read names from the chain (`check-pwa-precache-budget.mjs:34-35`), which is why it shows
shortened addresses today. A reservation store that already holds `address → name` off-chain is
the natural place to serve a public, read-only name directory, which would let the public site,
the admin cockpit, and the PWA resolve the same name by the same rule. The indexer's `Gardener`
entity already has an `ensName` field with no handler behind it
(`schema.graphql:1533-1536`) and is the alternative home.

Choosing between them is out of scope here; the requirement this plan carries is that the
reservation record must be readable by the surfaces that need it, so unification does not need a
second store later.

## Human Judgment Points

These are the founder's calls. The plan cannot be sequenced without answers to the first three.

1. **Is an app-level hold enough, or does the reservation have to be on-chain?** An off-chain hold
   is honored by every path the app controls and can ship without a contract deployment. It cannot
   stop a protocol member who transacts directly against the sender. On-chain is absolute and
   needs a new sender plus migration, which `ens-l2-sender-admin-recovery` already requires for
   other reasons.
2. **How long does a reservation last, and what refreshes it?** Proposed: 90 days from sign-up,
   refreshed on sign-in, released on registering a different name.
3. **Does the sign-up field narrow to slug characters, or normalize and confirm?** Recommended:
   normalize and confirm, which keeps the friendly field and shows the real name.
4. **Garden names versus gardener reservations.** Garden names are permanent and mint through a
   path that will not consult reservations. Does a garden mint displace a gardener's reservation,
   or does the reservation check refuse names gardens hold?
5. **Should a verified mainnet ENS holder get the matching slug reserved?** Closes an
   impersonation gap; holds names for people who may never arrive.
6. **Should there be a reserved-name list at all** (`admin`, `support`, `greengoods`, garden
   names)? None exists today, on either chain or in the client.
7. **Does the reservation store become the public name directory** that identity unification
   needs, or does that belong in the indexer?

### Protected or high-risk surfaces

- `packages/shared/src/workflows/auth*` and `packages/shared/src/providers/Auth.tsx` are
  `critical` (`values.md § Criticality Matrix`). Sign-up is the first thing a new gardener does
  and the last thing that should break: any check added there must not block account creation when
  it fails.
- `packages/contracts/src/registries/ENS.sol` is `critical` and, if touched, means a new
  non-upgradeable deployment plus a state migration.
- `packages/agent/src/**` is `sensitive`. A reservation store holds a name against an address and
  must not become an enumeration surface for accounts.

## Non-Functional Constraints

- **Package boundaries**: hooks stay in `@green-goods/shared`; the store, if off-chain, belongs to
  the agent beside the join-request routes; sign-up UI stays in `packages/client`.
- **Performance**: sign-up must not wait on two chain reads to succeed. Run the check, show the
  result, and let the account be created either way.
- **Security**: a reservation is written for the signing account only, proven the way join
  requests prove themselves. Reads must not allow enumerating accounts or names in bulk.
- **Offline / sync**: sign-up already works against a flaky network; a reservation that cannot be
  written is deferred, never a blocker.
- **Localization**: every new string lands in `en`, `es`, and `pt`.
- **Ontology**: adding a name concept means editing
  `packages/shared/src/ontology/green-goods-ontology.json` and regenerating with
  `node scripts/quality/check-ontology.mjs --generate` (`ontology.md § Change protocol`). If the
  work is planned but unbuilt, the entry is `source_status: "specified"` and must name this hub as
  its governing specification and a planned source anchor.

## Package / Lane Mapping

| Area | Lane | Notes |
|---|---|---|
| Sign-up field, confirmation, claim-form and reminder copy | `ui` | Normalize-and-confirm; i18n in three locales |
| Availability at sign-up, reservation hook, reservation store and routes | `state_api` | Reuses `validateSlug`, `isSlugAvailableAcrossChains`, and the join-request store shape |
| On-chain reservation | `contracts` | Only if question 1 is answered "on-chain"; otherwise `n/a`, and it rides the sender v2 in `ens-l2-sender-admin-recovery` |
| QA | `qa_pass_1`, `qa_pass_2` | Sequential; sign-up is a critical first-run path |

## Risks

- **Risk: the reservation promises more than it can keep.** A hold that is not on-chain can be
  beaten by a direct contract call.
  - Mitigation: say "held for you" and not "yours"; re-check at claim time and tell the person
    plainly if the name went; never show a reservation as a registration.
- **Risk: sign-up gets slower or more failure-prone.** It is the first thing a new gardener does.
  - Mitigation: the check never gates account creation; the reservation is written after the
    account exists and can be retried later.
- **Risk: narrowing the sign-up field costs sign-ups.** Today it accepts anything over three
  characters.
  - Mitigation: normalize and confirm rather than refuse.
- **Risk: a fifth copy of the slug rules.** Four already exist and are documented as needing to
  stay in sync (`ens.ts:28-30`).
  - Mitigation: call `validateSlug`; add no new rule text.
- **Risk: reservations become a name-squatting surface**, since sign-up is free and unlimited.
  - Mitigation: expiry, one reservation per account (mirroring the contract's one name per
    address), and no transfer between accounts.
- **Risk: the work collides with `ens-l2-sender-admin-recovery`.** Both touch naming, and that hub
  owns the sender v2 and the release path passkey users need.
  - Mitigation: this hub takes no contract lane unless question 1 says on-chain, in which case it
    becomes a requirement on that hub rather than a second deployment.
