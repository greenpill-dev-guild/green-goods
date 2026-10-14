# Codex handoff — adversarial review of the off-ramp corridor research

**Linear**: [RESR-71](https://linear.app/greenpill-dev-guild/issue/RESR-71/independent-review-pass-over-the-off-ramp-corridor-research) ·
project [Capital Off-Ramp Corridors](https://linear.app/greenpill-dev-guild/project/capital-off-ramp-corridors-3f9573efe397)
**Source under review**: `.plans/ideas/capital-offramp-corridors/brief.md`, as created 2026-08-03
**Posture**: review only — produce a correction record, do not rewrite the brief
**State**: **completed 2026-08-04.** This is the historical dispatch instruction, kept for
provenance. Its output is [`reports/codex-review-2026-08-04.md`](../reports/codex-review-2026-08-04.md),
and the corrections have since been applied to `brief.md`, which now runs sections 1–10. The
section map below therefore describes the superseded 2026-08-03 source, not the current brief —
read the corrected brief and the review report as the live artifacts.

---

You are reviewing a research brief produced by Claude in a single session on 2026-08-03 from public
web sources. It has not been checked by anyone. It reaches strong conclusions that are about to
drive real decisions, and your job is to try to break it.

Read `.plans/ideas/capital-offramp-corridors/brief.md` in full first. Note its internal structure:
sections 1–9 frame the problem and cover country regulation, section 10 covers gardener-level
economics, section 11 ranks locally loved consumer venues, and **section 12 supersedes section 11**
wherever they conflict, because a later constraint (the off-ramp must be reachable from inside the
Green Goods PWA) removed most consumer apps from consideration.

## Context you need

Green Goods is an offline-first PWA that verifies regenerative environmental work and records it
onchain. Production runs on Arbitrum. Wallets are self-custodial (Reown AppKit + wagmi +
`permissionless` ERC-4337 + passkey-backed embedded submission), and Green Goods holds no user funds
today — preserving that non-custodial posture is treated throughout the brief as the primary
evaluation criterion.

The question: how does an individual gardener in Nigeria, South Africa, Brazil, or the United States
turn a payout of roughly $5–100 into local spendable money, from inside the app? Garden treasury
conversion and funder inflows are explicitly out of scope.

Demographics stated by the product owner: Nigeria — young university students; South Africa — youth
plus somewhat older community members; Brazil — all ages, needs broad accessibility; United States —
familiar and cheap.

## What to do

### 1. Verify the factual claims

Produce a claim-by-claim record. Use the repo's existing correction vocabulary:
**CONFIRMED / CORRECTED / UNVERIFIABLE / SUPERSEDED**, each with a current source URL and date.
Where a claim is wrong or stale, the correction matters more than the original claim did.

Prioritise these — they carry the most weight in the conclusions:

**Fees and economics**
1. Mainstream cash-out widgets price at roughly 1% with a ~$3.99 minimum (Ramp 0.99%/$3.99; MoonPay 1% + $3.99 card minimum), making them unusable below roughly $150.
2. Breet charges up to 0.5% with no setup fee, no monthly fee, and no hidden spread.
3. Yellow Card charges a ~2–3% spread with no fixed floor.
4. Quidax charges 0% on instant swaps plus ₦200 for naira withdrawal; Busha is free for naira in and out.
5. Coinbase CDP offers 0% USDC on-ramp *and* off-ramp for developers who integrate.

**Nigeria — the safety claim**
6. Binance delisted all NGN pairs in Feb 2024, ended NGN deposits/withdrawals in March 2024, and has **not** restored them as of Aug 2026; it holds no Nigerian licence.
7. Nigeria's EFCC has frozen 1,100+ crypto traders' bank accounts, and a freeze locks the entire account rather than the disputed amount.
8. MoonPay discontinued buying, selling and swapping in Nigeria (June 2024).
9. Nigeria's SEC is the primary digital-asset regulator under ISA 2025; ARIP is the incubation path; Luno Nigeria was the first global exchange admitted (July 2026); minimum capital for a Digital Asset Exchange is ₦2bn.

**Provider capabilities**
10. Breet's API accepts USDC on **Arbitrum** (plus Base, Polygon, Ethereum, Tron, Solana, BNB), settles NGN and GHS, offers REST with address generation and webhooks, requires same-day KYB, and is SEC ARIP licensed.
11. Yellow Card holds VASP licences in Nigeria, Kenya and South Africa, covers 20+ countries, and advertises free stablecoin transfers on Polygon, Celo, Solana and Stellar — **not** Arbitrum.
12. VALR supports USDC deposits and withdrawals on Arbitrum and holds an FSCA CASP licence.
13. Kotani Pay integrates 15+ chains including both Arbitrum and Celo.
14. Fonbnk converts airtime to USDC at roughly $0.01 granularity and supports Nigeria via bank transfer and airtime.
15. Transak supports off-ramp in 40+ countries including PIX for Brazil; **its Nigeria status is recorded as unconfirmed** — resolve this.
16. Onramper aggregates 8 off-ramps across 46 fiat currencies with a widget (~8 lines) and a headless option; **its NGN and ZAR off-ramp coverage is unresolved** — resolve this.
17. Nubank has 112M Brazilian customers (>60% of adults), supports USDC, and offers **no third-party off-ramp API**.

**Regulation**
18. Brazil: BCB Resolutions 519/520/521 effective 2026-02-02; stablecoin flows classified as FX with a ~$100k cap for standard VASPs; BCB 561 bars electronic FX providers from stablecoin cross-border remittance from 2026-10-01; foreign platforms need a local licensed subsidiary or Brazilian SPSAV partner by 2026-10-30.
19. South Africa: FSCA approved 300 of 512 CASP applications by end-2025; SARB is rewriting exchange control; Joint Communication 1 of 2026 issued 2026-05-28; ZARU launched Feb 2026 and is institutional-only.
20. United States: GENIUS Act effective 2026-05-01; non-custodial wallets outside its scope and MiCA's; FinCEN's April 2026 NPRM proposes AML/CFT programs for permitted payment stablecoin issuers; $600+/yr to a US individual triggers W-9 and 1099-NEC; Form 1099-DA reporting begins 2026.

### 2. Attack the reasoning, not just the facts

These are inferences, not citations. Each could be wrong even if every fact above holds:

- **R1** — that a business payout API (Green Goods or a garden entity holds the account and disburses to third parties) changes Green Goods' regulatory position in a way a user-verified widget does not. This is the brief's central claim. Is the money-transmitter framing correct? Does the garden-entity-as-account-holder mitigation actually work, or does it just relocate the problem?
- **R2** — that the most-loved consumer apps and the PWA-integrable providers are "nearly disjoint sets." Is there a consumer venue with a partner/affiliate integration path the brief missed?
- **R3** — that staying on Arbitrum is viable, because the integrable providers accept it. Check whether the named providers really accept Arbitrum for the *specific* flow required (inbound deposit for conversion), not merely for generic transfers.
- **R4** — that two integrations (Transak for ZA/BR/US + Breet for NG) cover all four corridors.
- **R5** — that Nigeria should be licensed-venues-only as a user-safety rule.
- **R6** — that the US corridor needs no off-ramp integration at all and should be a verification pilot only.

### 3. Find what is missing

- Any provider that beats the recommended one in any corridor, especially any with **no minimum and a percentage-only fee** that serves Nigeria or Brazil.
- Any regulatory change after 2026-08-03 that moves a conclusion. Brazil, Nigeria and South Africa were all mid-change when this was written.
- Any per-provider **minimum transaction amount** — the brief flags this as its single largest unknown and could not resolve it for any provider. Resolving even a few would be high value.
- Whether a provider will accept a **garden's local entity** rather than Green Goods as account holder.
- Anything about the *offline-first* constraint the brief ignores: what happens to a cash-out initiated with intermittent connectivity, and whether any provider's flow tolerates it.

## Output

Write your findings to `.plans/ideas/capital-offramp-corridors/reports/codex-review-2026-08-04.md`.

Structure it as:
1. **Verdict** — does the brief's country-by-country recommendation survive? One paragraph.
2. **Correction record** — claim by claim, CONFIRMED / CORRECTED / UNVERIFIABLE / SUPERSEDED, with source URL and access date. Corrections state what the fact actually is.
3. **Reasoning review** — R1–R6, whether each holds, and where it breaks.
4. **Gaps and missed options** — anything the brief should have covered.
5. **What changed since 2026-08-03**, if anything.

## Constraints

- **Do not rewrite `brief.md`.** Produce the review as a separate report. The brief is another agent's artifact.
- **Do not install dependencies** or add packages.
- **Do not contact any provider.** Public sources only.
- **Stay inside `.plans/ideas/capital-offramp-corridors/`.** This repo runs multiple concurrent
  Claude and Codex sessions on the same tree; anything you find modified outside your scope is
  someone else's work in progress. Report it, do not "fix" it.
- **This repo is public.** Do not add partner names, individual names, contacts, or cohort
  judgements to any file.
- Cite a source URL and access date for every factual claim you confirm or correct. An uncited
  correction is not usable.
- Where you cannot verify something, say UNVERIFIABLE and say what would settle it. Do not fill
  gaps with plausible inference — that is the exact failure mode this review exists to catch.
