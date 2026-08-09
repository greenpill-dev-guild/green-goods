# Google Doc change list: payer identity, recipient rule, and circulation

Date: 2026-08-08  
Document: [Green Goods Commitment Pooling](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit)  
Application owner: human editor  
Status: not applied by Codex

This is a narrow additive correction list. Preserve the six-tab structure, the document's plain
commitment-first voice, existing citations, and its Built / Planned / Evidence-gated discipline.
Read each full target tab before editing, make the smallest local correction, then reload and
re-read the affected section. Do not paste Solidity names into audience prose unless they are in a
technical note.

## Live-verified image state and mandatory caption correction

### Tab 02 — Deeper Reference

Codex inspected Tab 02 in the live Google Doc on 2026-08-08 without editing it. The embedded image
is already the current 2026-08-08 triangle around the protocol pool, showing all five relationships:
upstream House of Alignment support, protocol Requests claimed by individuals, protocol Requests
claimed by gardens, protocol Offers claimed and paid for by gardens, discretionary seeding, and
the garden-to-gardener internal payout edge. **Do not replace or re-upload the image.**

The image caption is stale. Replace the generic caption beginning `The protocol pool coordinates
claimable services and commitments` with:

> Requests and Offers circulate G$ around the Green Goods protocol pool. The protocol pays
> gardeners or gardens for Requests according to who claimed; gardens pay Green Goods for claimed
> Offers and pay their own gardeners for garden commitments. House of Alignment support and
> discretionary seeding remain separate.

Alt text:

> Circular G$ exchange around the Green Goods protocol pool. The protocol pays gardeners or
> gardens for Requests according to who claimed; gardens pay Green Goods for claimed Offers and
> pay their own gardeners for garden commitments. House of Alignment support and discretionary
> seeding remain separate.

After editing the caption, confirm the image and the next heading were not displaced. No image
upload is needed for this correction.

## Prose corrections

### Tab 01 — External Brief

At `Trust and money`, or the nearest paragraph that describes who pays after a commitment is kept,
replace any provider-pays or generic garden-pays wording with this audience-level rule:

> The account that asked for the work pays. In a garden's own pool, the asking and providing
> garden are the same, so the familiar flow does not change. In the protocol pool they may differ:
> the protocol pays when it asks a gardener or garden to do work, while a garden pays when it
> claims support offered by Green Goods.

Immediately after it, add the recipient rule if it is not already explicit:

> Payment follows who claimed. An individual claimant is paid through the participating
> contributors; a garden-scoped protocol Request pays the claiming garden's registered Celo Safe.
> The providing garden is never asked to fund work the protocol commissioned.

Keep this behavior marked **Built, pre-deploy**. The commitment-pooling payer field and guards, the
Arbitrum settlement module, and the Celo executor are implemented and tested. None is deployed or
configured at a live address, so the document must not describe payment as operational.

In any `Built today and planned next` summary, use this exact split:

- **Built, pre-deploy:** commitments record the asking garden as payer; garden-pool institutional
  claims and protocol-root self-claims are rejected; priced exchanges are rejected; the promise
  ABI uses consideration terminology; the payer-funded payout plan, institutional-beneficiary
  Safe payment, Celo dispatch/acknowledgment lifecycle, and core derived-direction indexer slice
  are implemented and tested.
- **Planned next:** deploy and configure the modules, connect state/API/UI consumers, and add the
  separate Celo-side observation required to claim executed circulation.

Do not imply that an accepted or fulfilled commitment proves that G$ moved.

### Tab 02 — Deeper Reference

In the circular-G$ section, replace any sentence saying the GoodDollar mandate question is
pending, awaiting confirmation, or unresolved with:

> GoodDollar confirmed the arrangement on 2026-08-08 and said they want to see circulation. This
> closes the mandate question, not the evidence question: partner claims still require observed
> payments during the pilot.

Near the settlement architecture explanation, add or correct the three separate identities:

1. **Payer**: the garden account that asked for the work and whose Safe may fund settlement.
2. **Provider garden**: the garden whose people or institution delivered; it remains the proof and
   roster boundary.
3. **Recipient**: derived from who claimed. A Garden-claimed Request pays the external claiming
   garden Safe; an Individual-claimed Request and every Offer pay contributors.

Add this compatibility sentence:

> Inside one garden pool, payer and provider resolve to the same garden. The distinction becomes
> material only when the protocol and a garden exchange work or services.

Under the payout-plan description, replace contributor-only language with two immutable shapes:

- **Contributor consideration:** a fixed contributor vector; a retained garden share is allowed
  only when payer and provider are the same garden.
- **Garden beneficiary:** one full-amount payment to the external claiming garden's registered
  Safe; no contributor rows and no retained share.

State that a plan cannot be edited from one shape into the other and a garden-beneficiary plan
cannot be marked complete until its settlement child is acknowledged. Avoid using
`gardenerDeliveryEnabled` in the audience prose; that capability gate applies only to individual
account delivery, not a garden Safe.

Where the indexer or metrics are described, add:

> The Arbitrum index derives the intended direction as internal, protocol-to-garden,
> garden-to-protocol, or reserved garden-to-garden from the frozen payer and provider identities.
> Actual Celo transfers still require Celo-side observation and are outside Envio's Arbitrum
> boundary.

### Tab 03 — Applied Reference

In the Tech and Sun or other worked commitment examples, apply these case rules without changing
quantities or inventing participation:

- protocol asks a garden to run an event or complete a garden-scoped survey → the protocol Safe is
  the payer and the claiming garden Safe is the single beneficiary;
- protocol asks an individual gardener → the protocol Safe is the payer and the contributor
  accounts are recipients;
- garden claims Green Goods onboarding, technical help, or a support session → the claiming
  garden Safe is the payer and Green Goods contributors are recipients;
- a garden's own commitment → payer and provider are that same garden, preserving the existing
  internal flow.

Remove any example that makes the claiming garden pay itself for a protocol Request or makes the
provider fund work requested by the protocol. Do not present a protocol garden claiming its own
garden-scoped Request; that path is rejected.

### Tab 04 — Rollout, Measurement & Claims

In the settlement evidence table or publication checklist, distinguish these facts:

- `Fulfilled` proves the commitment outcome, not payment.
- `Queued` and `Dispatched` are source-chain intentions, not received value.
- `Confirmed` requires an authenticated acknowledgment of the current settlement attempt.
- GoodDollar's circulation confirmation establishes partner alignment, not executed circulation.
- Any claim that G$ circulated needs observed Celo-side evidence; Envio-derived direction alone is
  insufficient.

Add `payer/provider/recipient agree with the claimant rule` and `current circular-G$ image is
embedded` to the pre-publication checklist.

### Tab 05 — Sources & Citations

Add or update only the entries needed by the new prose, preserving the existing numbering:

- Green Goods active plan, Decision Log #56–#58 and registers #90–#92.
- `contract-spec.md` payer and recipient amendments.
- `settlement-spec.md` payout-shape, lifecycle, and derived-flow sections.
- The dated 2026-08-08 GoodDollar confirmation record already used by the document owner; do not
  invent a public link or quote if the source is private.

No change is required in Tab 00 unless it says the settlement rail is either merely specified or
already deployed. If it does, change only that sentence to say the rail is implemented and tested
pre-deploy, with deployment and live configuration still pending.

## Final human verification

After applying the list:

1. wait for `Saved to Drive`;
2. reload all affected tabs;
3. search document-wide for `provider pays`, `providing garden pays`, `awaiting GoodDollar`,
   `pending GoodDollar`, `ContributorReward`, `settlement is not implemented`, and any claim that
   Celo settlement is deployed or live;
4. verify the existing circular-G$ image remains the current five-relationship triangle;
5. verify the corrected caption appears once and no following heading moved or duplicated;
6. keep all deployment, live-value movement, and executed-circulation claims absent until their
   separate evidence gates pass.
