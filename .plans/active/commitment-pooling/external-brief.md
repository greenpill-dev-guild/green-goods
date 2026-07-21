# Green Goods Commitment Pooling — External Brief

**Version**: v1.2 draft (English) · shareable as doc/PDF · not yet published to the docs site
**Last aligned with canonical synthesis**: v5 (2026-07-05) — [Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building](https://linear.app/greenpill-dev-guild/document/commitment-pooling-green-goods-grassroots-economics-learnings-and-the-d3939e890b14). **Corrections applied since v5**: Green Goods' designated fund topology (House of Alignment funding is intended to land directly in the Green Goods protocol Safe on Celo; the earlier working-capital hop is retired, but live receiving-address evidence remains a distribution gate) and per-action required-work counts, both from the 2026-07-18 audit response (`reports/corrections-log.md` §9–10).
**How to read the labels**: **Built** means live in Green Goods today. **Planned** means specified for a dated release, not yet implemented. Settlement-status labels (*Reported*, *Oracle-verified*, *Evidence-gated*) appear only in “Trust and money” below; their exact definitions live in the technical appendix (shipping with the FAQ).
**A note on one word**: we call the person who runs a garden its **Garden Steward**. In the Green Goods app today that same role is still labeled *Operator* — the rename is in progress, and both words mean the holder of the garden's operator/owner permissions.
**Before external distribution**: partner factual review — participating gardens, GoodDollar / House of Alignment, and methodology collaborators. *Contact channels per audience are finalized at that review.*

## Why now

**Green Goods is an offline-first app where community gardens document regenerative work on-chain, built by the Greenpill Dev Guild.** Today, gardeners capture evidence in the field — even offline — Garden Stewards approve it, and assessments record what changed on the land. **Built.** What the platform doesn’t yet have is the step *before* the work: a way for a community to say what it needs, for neighbors to promise help, and for those promises to be taken up, kept, and remembered. The Season One gardens already coordinate this informally. Commitment pooling gives that coordination a shared, durable record. **Planned.**

## What commitment pooling is

For generations, Kenyan communities have pooled labor through rotational work traditions like *Mweria*: neighbors commit work to one member’s land, then rotate. Grassroots Economics spent over a decade formalizing this pattern into an economic protocol — pooling *commitments* rather than money, so communities with little cash can still organize mutual support (Ruddick 2023). Green Goods brings that pattern to its gardens as a **clean-room implementation**: informed by Grassroots Economics’ published paper and public documentation, built on our own architecture. It is not a Sarafu integration, and no Grassroots Economics code is used.

## How the loop works

1. **A community names a need** — a *Request* (“we need X”), an *Offer* (“I can give Y”), or an *Initiative* (“let’s do Z together”). **Planned** — September, in a dedicated community app.
2. **The garden records where things stand** — a baseline assessment before work begins. **Built** as a rail today; an upgraded version ships with pooling.
3. **Someone promises** — a commitment states who will do what, by when, for whom, recorded on Arbitrum by Green Goods’ own pooling module. **Planned** — August.
4. **Work proves it** — field evidence and steward approval, on the same **Built** work-and-approval rails gardens use today.
5. **The person who received the help confirms.** Whoever accepted an offer, or whoever made the request, confirms the promise was kept. The person who did the work can never confirm their own promise, and confirmation can require several named people to agree. **Planned** — August.
6. **The community learns.** A follow-up assessment closes the proof loop, and a fulfilled commitment can carry a reward — including G$ settled on Celo once its release gates pass. **Planned.** Community testimony is a separate **September-only** Community-app capability; it is not part of the Build phase or an August client surface.
7. **The cycle becomes an impact certificate.** A pool's fulfilled commitments and their evidence bundle into the cycle's Hypercert — a certificate of delivered outcomes that funders can buy fractions of on the marketplace. The marketplace is **Built** and runs on Arbitrum today; bundling commitments into certificates is **Planned**.

## Why the baseline matters

The baseline assessment is not paperwork before the real work — it does three jobs in the loop. It is the **readiness gate**: a garden's pool cannot open for promises until a current baseline exists, so every promise is made against a shared picture of the land as it is. It is the **anchor for proof**: follow-up assessments must reference the baseline they measure against, which is what lets "promise kept" mean *observable change* rather than testimony alone. And it is where **needs surface**: walking the land to record where things stand is usually the moment a community names what is missing — the Needs that offers and requests then answer, with each commitment carrying a reference to the need that motivated it (need → commitment → work → baseline/delta → testimony).

Three tensions from the practice, named honestly: a baseline costs real effort before any value flows, so stewards carry unpaid observational work up front; baselines go stale, which is why each new season re-grounds on the same pool rather than inheriting last year's picture; and authorship is deliberately inclusive — a steward may capture the baseline in analog form, so a credentialed evaluator is never the gate on a community getting started.

## What this looks like on the ground

**Most promises need no money at all.** For mutual aid, the confirmation *is* the settlement — rewards are the optional layer on top. Two examples from the pilot gardens (behavior **Planned** for August/September; quantities illustrative):

- **Awka, Nigeria (Tech and Sun Hub).** A member offers a two-hour design workshop. The attending cohort is the named confirmation group — say three of five attendees — and the person who gave the workshop cannot be one of them. When they confirm, the promise is fulfilled. No token moves.
- **Cape Town, South Africa (Greenpill Cape Town).** The Garden Steward posts a request under the garden’s UNICEF-funded cleanup program: one beach cleanup, twenty collection bags. Accepted claimants do the work; the steward who made the request confirms it. A member without a phone still takes part — the steward records their promise on their behalf at the gathering.

## Built today vs. planned

**Built** (running on Arbitrum now): 13 live Season One gardens; garden identity and roles; passkey sign-in (no seed phrases); offline-first field capture; work evidence and approvals; assessments; a live Hypercert impact marketplace; pilot supporter vaults built with Octant yield strategies.

**Planned**: the commitment pooling module and its register (Build closes July 31; Release is August 12 and remains separately human-authorized); G$ settlement (the August 12 target waives no value-tier gate, with Tech and Sun Hub planned as the first bounded execution); the community app for needs, confirmations, and testimony (September 30 operational checkpoint). The pilot focuses on Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (South Africa), and AgroforestDAO / Redemption Hill (Bias Fortes, Brazil). A fourth slot, for a mature organization adopting the methodology, is still open. The three named gardens already exercise all four action domains: solar, education, waste, and agroforestry. **Naming a garden is not the same as it agreeing to take part** — each confirms participation through research sessions and a corrected mandate first, and we make no claim on any garden's behalf until it does.

## Trust and money — the boundaries we hold

These boundaries are not fine print — they are what keeps the system safe for the communities who trust it:

- **Promises are not tokens to trade.** Commitments live in a non-transferable register: no swapping, no exchange rates, no speculation. Transferable settlement vouchers are a separate follow-on and stay *Evidence-gated* until the pilot proves the need.
- **Support is not steering.** Funding shown alongside a community’s needs supports the garden as a whole; it is not per-need escrow and does not buy influence over what the community does.
- **The pooling module holds no money.** It never takes custody of rewards. In the planned value tier, G$ payments are executed from scoped Celo Safes only after the settlement release gates pass; no date implies that authorization.
- **G$ stays on Celo.** Coordination and proof live on Arbitrum; G$ value settles on Celo, where it is native. Bridging tokens between chains adds custody risk, so we verify across chains instead of moving value. No bridged G$, ever.
- **A payment report is not proof.** When a steward records a Celo transaction, it is labeled *Reported*. Only an automated oracle check of the finalized Celo receipt (Chainlink Functions) can mark it *Oracle-verified*. There is no human override.
- **If delivery rails aren’t ready, payouts wait.** Automated delivery to individual members depends on sponsored accounts on Celo — the infrastructure that lets members transact without holding gas money. Until that gate passes, protocol and garden funding continue, but member delivery stays blocked. No workarounds, and no garden-held claims on members’ behalf.
- **No rankings.** Green Goods does not rank communities, gardens, needs, or people. Mutual aid is not a competition.

A **borrow-and-repay loop** (interest-free advances repaid over time, with no per-person credit scores) is designed but deliberately *Evidence-gated*: it is not part of the initial pooling release.

## How delivered outcomes attract funding

Commitment pooling closes with proof — and proof is what funders can back. Funding follows delivered outcomes, not promises:

- **Impact certificates (Hypercerts).** Each cycle's verified outcomes become a Hypercert on the **Built** Arbitrum marketplace; buying a fraction funds work that was already delivered and confirmed. Bundling a cycle's fulfilled commitments into its certificate ships with pooling — **Planned**.
- **Supporter vaults (with Octant).** Supporters deposit into pilot yield vaults, and the principal stays theirs. The yield is routed into buying fractions of garden impact certificates — patient capital that keeps funding verified outcomes. **Built** (pilot vaults live).
- **Direct support and G$ settlement.** Direct donations to a garden work today (**Built**); the G$ settlement pilot below pays members for fulfilled commitments (**Planned**).

## Who funds the settlement pilot

Green Goods is one of four inaugural members of GoodDollar’s **House of Alignment** pilot, alongside Gardens, ReFi DAO, and Textile. [GIP-26](https://discourse.gooddollar.org/t/gip-26-begin-distributions-to-house-of-alignment/8890) proposed protocol-funded distributions of roughly **$800/month in G$** per member through a Flow Splitter and a first evaluation on **2026-09-30**, but it **failed its community vote**. GoodDollar's [June 23 governance update](https://discourse.gooddollar.org/t/gooddao-2-0-gooddollar-governance-re-vision-update/9016) confirms that the **Good Labs Foundation will fund the pilot as a separate experiment** with the same four members; it also says the distribution mechanism was still being decided. Therefore the amount, Flow Splitter, start date, exact September reporting obligation, and Green Goods receiving address remain partner-verification gates rather than current facts. Green Goods' designated topology—once receiving-address evidence is recorded—is direct receipt into the protocol Safe on Celo, followed by exactly one modeled route from that Safe to garden accounts. No focus garden is described as live-settling before value-tier Release evidence and authorization.

## Timeline

| Date | Type | What closes | What gardens experience | Proof we hold ourselves to | Money and settlement |
|---|---|---|---|---|---|
| 2026-07-20 | Native phase — Scope and Design | Specs, prototype, acceptance, and scope are coherent enough to build | Research and co-design continue on today’s built rails | Reconciled source set with explicit unavailable evidence | No new G$ movement |
| 2026-07-31 | Operational checkpoint — July dry run | Confirmed mandates, facilitation kit, and readiness matrix with explicit gaps | Mandate read-back and correction | Steward-confirmed artifacts or explicit incomplete/unavailable status | Existing community-fund rails only |
| 2026-07-31 | Native phase — Build | Implementation and QA GREEN; no broadcast or public-live claim | Rehearsal against confirmed mandates, without implying release | Full lane proof; the narrow non-custodial/non-transferable Release tier still requires separate human authorization | Value tier remains blocked |
| 2026-08-12 | Native phase — Release | Separately authorized deployment and one bounded production proof | First live commitments only after the relevant gates pass | Artifact-by-artifact authorization and post-deploy proof; settlement stays *Reported* until *Oracle-verified* | Value tier requires audit, timelock, testnet, Safe/Functions/AA evidence, and live proof; a missing gate remains blocked |
| 2026-09-30 | Operational checkpoint — Community and evidence | Community-app usability, September-only testimony, and settlement-evidence packet | Members name Requests, Offers, and Initiatives, confirm promises, and may add testimony | Observed completion/recovery plus source-backed evidence and privacy thresholds | First evaluation; unavailable inputs remain blockers |
| 2026-12-31 | Native phase — Follow On / Hardening | Evidence-backed promote/defer decisions only | “What we heard / what changed” returned to every garden | Pilot targets with full methodology | Follow-ons stay evidence-gated; this phase authorizes no implementation |

## Why we believe this pattern works

- A randomized controlled trial of Kenya’s Sarafu community-currency network found a $30 community-currency transfer increased recipients’ food and water spending by **$28.43** — statistically significant at the 10% level after two months — within a network that mediated over $3M in trade among 40,000+ users ([Mqamelo 2022, *Frontiers in Blockchain* 4:739751](https://www.frontiersin.org/articles/10.3389/fbloc.2021.739751/full)).
- Grassroots Economics’ July-2025 network study (**self-reported**, not third-party audited) counts ~251,449 peer-to-peer exchanges across ~55 pools; in an 855-user survey, 84% reported positive income effects and 95% called the network important to their household.
- The protocol we adapt is documented in [Ruddick, W. O. (2023), “Letters from the Field: Commitment Pooling — An Economic Protocol Inspired by Ancestral Wisdom,” *IJCCR* 27, pp. 54–79](https://www.ijccr.net/article/view/9297). Ruddick has since extended it in [“Proto-Social Infrastructure and Stewardship of Commitment Pooling,” *IJCCR* 30(1) 2026, pp. 80–98](https://www.ijccr.net/article/view/9512).

## An invitation

- **Garden Stewards** — confirm a research/onboarding session and correct your garden’s mandate; sessions run through July 30.
- **Gardeners and community members** — name a Request, Offer, or Initiative, or take up a promise. No crypto knowledge needed: passkey sign-in, works offline.
- **Evaluators** — review the evidence lineage (need → commitment → work → baseline/delta → testimony) and tell us where the methodology mapping falls short.
- **Funders** — support a garden directly, buy fractions of its impact certificates, or deposit into a supporter vault; ask us whether any settlement claim is *Reported* or *Oracle-verified* — we will always tell you which.
- **Collaborators and protocol stewards** — join a bounded research, evaluation, settlement, or documentation lane.

*Until per-audience contact channels are confirmed at partner review, reach the team through your Garden Steward or the Greenpill Dev Guild.*

---

## Production notes — not part of the brief

Everything below this line is for whoever produces the shareable doc/PDF. Strip it from anything a reader sees.

**Companion graphics** (this folder; each has a 2x PNG for upload — index and style contract in `visual-assets.md`):

| Asset | Place at |
|---|---|
| `external-brief-loop` | after "How the loop works" |
| `external-brief-money-map` | in "Trust and money — the boundaries we hold" |
| `external-brief-funding-rails` | in "How delivered outcomes attract funding" |
| `external-brief-roles` | before "An invitation" |

Include all four in the shareable export. Images are dragged in manually — neither Linear nor Google Docs accepts embedded images over MCP.

**Where this goes**: the *External Brief* tab of the [Green Goods Commitment Pooling Google Doc](https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit) (external canonical), mirrored from this file. See `external-communications.md` § The three surfaces.
