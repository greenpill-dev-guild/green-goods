# Green Goods Commitment Pooling — External Brief

**Version**: v1.2 draft (English) · shareable as doc/PDF · not yet published to the docs site
**Last aligned with canonical synthesis**: v5 (2026-07-05) — [Commitment Pooling × Green Goods — Grassroots Economics Learnings, and the Full Flywheel We're Building](https://linear.app/greenpill-dev-guild/document/commitment-pooling-green-goods-grassroots-economics-learnings-and-the-d3939e890b14)
**How to read the labels**: **Built** means live in Green Goods today. **Planned** means specified for a dated release, not yet implemented. Settlement-status labels (*Reported*, *Oracle-verified*, *Evidence-gated*) appear only in “Trust and money” below; their exact definitions live in the technical appendix (shipping with the FAQ).
**Before external distribution**: partner factual review — participating gardens, GoodDollar / House of Alignment, and methodology collaborators. *Contact channels per audience are finalized at that review.*

## Why now

**Green Goods is an offline-first app where community gardens document regenerative work on-chain, built by the Greenpill Dev Guild.** Today, gardeners capture evidence in the field — even offline — operators approve it, and assessments record what changed on the land. **Built.** What the platform doesn’t yet have is the step *before* the work: a way for a community to say what it needs, for neighbors to promise help, and for those promises to be taken up, kept, and remembered. The Season One gardens already coordinate this informally. Commitment pooling gives that coordination a shared, durable record. **Planned.**

## What commitment pooling is

For generations, Kenyan communities have pooled labor through rotational work traditions like *Mweria*: neighbors commit work to one member’s land, then rotate. Grassroots Economics spent over a decade formalizing this pattern into an economic protocol — pooling *commitments* rather than money, so communities with little cash can still organize mutual support (Ruddick 2023). Green Goods brings that pattern to its gardens as a **clean-room implementation**: informed by Grassroots Economics’ published paper and public documentation, built on our own architecture. It is not a Sarafu integration, and no Grassroots Economics code is used.

## How the loop works

1. **A community names a need** — a *Request* (“we need X”), an *Offer* (“I can give Y”), or an *Initiative* (“let’s do Z together”). **Planned** — September, in a dedicated community app.
2. **The garden records where things stand** — a baseline assessment before work begins. **Built** as a rail today; an upgraded version ships with pooling.
3. **Someone promises** — a commitment states who will do what, by when, for whom, recorded on Arbitrum by Green Goods’ own pooling module. **Planned** — August.
4. **Work proves it** — field evidence and operator approval, on the same **Built** work-and-approval rails gardens use today.
5. **The person who received the help confirms.** Whoever accepted an offer, or whoever made the request, confirms the promise was kept. The person who did the work can never confirm their own promise, and confirmation can require several named people to agree. **Planned** — August.
6. **The community learns.** A follow-up assessment and community testimony close the loop, and a fulfilled commitment can carry a reward — including G$ settled on Celo. **Planned** — August/September.
7. **The cycle becomes an impact certificate.** A pool's fulfilled commitments and their evidence bundle into the cycle's Hypercert — a certificate of delivered outcomes that funders can buy fractions of on the marketplace. The marketplace is **Built** and runs on Arbitrum today; bundling commitments into certificates is **Planned**.

*Companion graphics (this folder, each with a 2x PNG for upload; index in `visual-assets.md`): `external-brief-loop` — this loop as a labeled circle, placed here; `external-brief-money-map` — the split-state money map, placed in Trust and money; `external-brief-funding-rails` — the three rails, placed in How delivered outcomes attract funding; `external-brief-roles` — the five roles and their actions, placed before An invitation. Include all four in the shareable doc/PDF export.*

## Why the baseline matters

The baseline assessment is not paperwork before the real work — it does three jobs in the loop. It is the **readiness gate**: a garden's pool cannot open for promises until a current baseline exists, so every promise is made against a shared picture of the land as it is. It is the **anchor for proof**: follow-up assessments must reference the baseline they measure against, which is what lets "promise kept" mean *observable change* rather than testimony alone. And it is where **needs surface**: walking the land to record where things stand is usually the moment a community names what is missing — the Needs that offers and requests then answer, with each commitment carrying a reference to the need that motivated it (need → commitment → work → baseline/delta → testimony).

Three tensions from the practice, named honestly: a baseline costs real effort before any value flows, so stewards carry unpaid observational work up front; baselines go stale, which is why each new season re-grounds on the same pool rather than inheriting last year's picture; and authorship is deliberately inclusive — a steward may capture the baseline in analog form, so a credentialed evaluator is never the gate on a community getting started.

## What this looks like on the ground

**Most promises need no money at all.** For mutual aid, the confirmation *is* the settlement — rewards are the optional layer on top. Two examples from the pilot gardens (behavior **Planned** for August/September; quantities illustrative):

- **Awka, Nigeria (Tech and Sun Hub).** A member offers a two-hour design workshop. The attending cohort is the named confirmation group — say three of five attendees — and the person who gave the workshop cannot be one of them. When they confirm, the promise is fulfilled. No token moves.
- **Cape Town, South Africa (Greenpill Cape Town).** The operator posts a request under the garden’s UNICEF-funded cleanup program: one beach cleanup, twenty collection bags. Accepted claimants do the work; the operator who made the request confirms it. A member without a phone still takes part — the operator records their promise on their behalf at the gathering.

## Built today vs. planned

**Built** (running on Arbitrum now): 13 live Season One gardens; garden identity and roles; passkey sign-in (no seed phrases); offline-first field capture; work evidence and approvals; assessments; a live Hypercert impact marketplace; pilot supporter vaults built with Octant yield strategies.

**Planned**: the commitment pooling module and its register (August 31); G$ settlement (August 31 — every focus garden is settlement-capable, with Tech and Sun Hub planned as the first execution); the community app for needs and confirmations (September 30). The pilot focuses on Tech and Sun Hub (Awka, Nigeria), Greenpill Cape Town (South Africa), and AgroforestDAO / Redemption Hill (Bias Fortes, Brazil), plus a fourth garden — in outreach, named only once participation is confirmed — for the mature-organization MRV-adoption slot. The three named gardens already exercise all four action domains: solar, education, waste, and agroforestry. Naming a garden never presumes its readiness. Each confirms participation through research sessions and a corrected mandate first.

## Trust and money — the boundaries we hold

These boundaries are not fine print — they are what keeps the system safe for the communities who trust it:

- **Promises are not tokens to trade.** Commitments live in a non-transferable register: no swapping, no exchange rates, no speculation. Transferable settlement vouchers are a separate follow-on and stay *Evidence-gated* until the pilot proves the need.
- **Support is not steering.** Funding shown alongside a community’s needs supports the garden as a whole; it is not per-need escrow and does not buy influence over what the community does.
- **Nobody holds your money.** The pooling module never takes custody of rewards. In August, G$ payments are executed by garden operators from garden-owned accounts; automating that execution is a stretch goal (otherwise September).
- **G$ stays on Celo.** Coordination and proof live on Arbitrum; G$ value settles on Celo, where it is native. Bridging tokens between chains adds custody risk, so we verify across chains instead of moving value. No bridged G$, ever.
- **A payment report is not proof.** When an operator records a Celo transaction, it is labeled *Reported*. Only an automated oracle check of the finalized Celo receipt (Chainlink Functions) can mark it *Oracle-verified*. There is no human override.
- **If delivery rails aren’t ready, payouts wait.** Automated delivery to individual members depends on sponsored accounts on Celo — the infrastructure that lets members transact without holding gas money. Until that gate passes, protocol and garden funding continue, but member delivery stays blocked. No workarounds, and no garden-held claims on members’ behalf.
- **No rankings.** Green Goods does not rank communities, gardens, needs, or people. Mutual aid is not a competition.

A **borrow-and-repay loop** (interest-free advances repaid over time, with no per-person credit scores) is designed but deliberately *Evidence-gated*: it is not part of the August release.

## How delivered outcomes attract funding

Commitment pooling closes with proof — and proof is what funders can back. Funding follows delivered outcomes, not promises:

- **Impact certificates (Hypercerts).** Each cycle's verified outcomes become a Hypercert on the **Built** Arbitrum marketplace; buying a fraction funds work that was already delivered and confirmed. Bundling a cycle's fulfilled commitments into its certificate ships with pooling — **Planned**.
- **Supporter vaults (with Octant).** Supporters deposit into pilot yield vaults, and the principal stays theirs. The yield is routed into buying fractions of garden impact certificates — patient capital that keeps funding verified outcomes. **Built** (pilot vaults live).
- **Direct support and G$ settlement.** Direct donations to a garden work today (**Built**); the G$ settlement pilot below pays members for fulfilled commitments (**Planned**).

## Who funds the settlement pilot

Green Goods is one of four members of GoodDollar’s **House of Alignment** ecosystem-alignment program, alongside Gardens, ReFi DAO, and Textile. After GIP-26 — the proposal to fund the program from the GoodDollar DAO — failed its community vote in June 2026, the **Good Labs Foundation stepped in to fund the pilot directly**: roughly **$800/month in G$** per member via a Flow Splitter on Flow State, with a first evaluation on **2026-09-30**. Funds stream directly into the Green Goods protocol treasury on Celo. From there, Green Goods models exactly one route: protocol treasury to garden accounts. Every focus garden is settlement-capable — each gets its own garden-owned Celo account on demand — with Tech and Sun Hub planned as the first execution. Each garden pairs settlement with a local way to spend G$ back into the pool, so value circulates instead of draining out.

## Timeline

| Date | Checkpoint | What ships | What gardens experience | Proof we hold ourselves to | Money and settlement |
|---|---|---|---|---|---|
| 2026-07-31 | Dry run | Confirmed garden mandates, facilitation kit, and a readiness matrix published with explicit gaps | Research and co-design sessions with operators; mandate read-back and correction; today’s built rails only | Operator-confirmed mandate artifacts — or an explicit incomplete/unavailable status; no launch claim | Rewards via existing community-fund rails only; no G$ moves |
| 2026-08-31 | Release | Pooling module and non-transferable register live on Arbitrum; promise, claim, and confirmation surfaces; operator-executed G$ settlement path | First commitments seeded from confirmed mandates; promises taken up, evidenced, and confirmed in the app | One bounded end-to-end proof with every external gate passing; settlement claims labeled *Reported* or *Oracle-verified* | Every focus garden settlement-capable (one Celo account each); Tech and Sun Hub planned first |
| 2026-09-30 | Community app | Independent community app (view, signal, confirm); operator triage in admin; funder discovery on existing public pages | Members name Requests, Offers, and Initiatives themselves and confirm promises; gathering usability sessions | Observed task completion and recovery paths in real sessions | First House of Alignment evaluation |
| 2026-12-31 | Hardening review | Published pilot learnings and promote/defer decisions | “What we heard / what changed” returned to every garden; case studies only with garden approval | Pilot targets reported with full measurement methodology | Follow-ons (transferable vouchers, borrow-and-repay) stay evidence-gated |

## Why we believe this pattern works

- A randomized controlled trial of Kenya’s Sarafu community-currency network found a $30 community-currency transfer increased recipients’ food and water spending by roughly $28, within a network that mediated over $3M in trade among 40,000+ users (Mqamelo 2022, *Frontiers in Blockchain*).
- Grassroots Economics’ July-2025 network study (self-reported) counts ~251,449 peer-to-peer exchanges across ~55 pools; in an 855-user survey, 84% reported positive income effects and 95% called the network important to their household.
- The protocol we adapt is documented in Ruddick, W. O. (2023), “Letters from the Field: Commitment Pooling — An Economic Protocol Inspired by Ancestral Wisdom,” *IJCCR* 27, pp. 54–79.

## An invitation

- **Garden operators** — confirm a research/onboarding session and correct your garden’s mandate; sessions run through July 30.
- **Gardeners and community members** — name a Request, Offer, or Initiative, or take up a promise. No crypto knowledge needed: passkey sign-in, works offline.
- **Evaluators** — review the evidence lineage (need → commitment → work → baseline/delta → testimony) and tell us where the methodology mapping falls short.
- **Funders** — support a garden directly, buy fractions of its impact certificates, or deposit into a supporter vault; ask us whether any settlement claim is *Reported* or *Oracle-verified* — we will always tell you which.
- **Collaborators and protocol stewards** — join a bounded research, evaluation, settlement, or documentation lane.

*Until per-audience contact channels are confirmed at partner review, reach the team through your garden’s operator or the Greenpill Dev Guild.*
