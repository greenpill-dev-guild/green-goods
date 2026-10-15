# Pilot execution plan

**Feature:** `stripe-thirdweb-endowment-pilot`

**Linear Issue:** [PRD-1031](https://linear.app/greenpill-dev-guild/issue/PRD-1031)

**Linear Project:** [Garden Fiat Contributions](https://linear.app/greenpill-dev-guild/project/garden-fiat-contributions-3675da59ceb3)

**Linear Source:** `source:plans`

**Tracking:** Parent-only hub mirror, reconciled with the existing delivery/qualification issues; no duplicate lane issues. Keep live Linear states and assignments unless a later user request changes them. The [sync handoff](handoffs/linear-sync.md) links the readable specification and work mapping.

**Status:** Backlog; plan prepared, implementation and live testing pending

**Created:** 2026-10-14

**Last Updated:** 2026-10-15

**Priority:** US and EU donor acquisition first. The user expects these to be the initial sources of capital; [regions.md](regions.md) distinguishes that strategy from verified payment availability. Keep Brazil, South Africa and Nigeria as later, separately gated local-donor routes. Retain the hub slug and existing pending lane state.

## Decisions

| Decision | Rationale |
| --- | --- |
| Endowment, with donor-owned redeemable shares | Explicit user clarification; a direct garden donation is a separate product outcome. |
| US/EU first, using Stripe direct + thirdweb email/signing | Shared documented provider coverage and the user's capital-acquisition priority. L0 is the US hypothesis; EU has separate verification requirements. No public thirdweb L0 adapter was verified. |
| Ramp/Fonbnk only after regional selection | Avoid building several adapters before payment and KYC feasibility are established. MoonPay is comparison-only. |
| Existing Arbitrum vault only | Keep the pilot bounded; current Ethereum campaign manifests are insufficient. |
| Prove execution authorization before live checkout | Buying crypto without being able to complete the endowment does not satisfy the task. |
| One final endowment consent, no post-payment deposit action | Bank/issuer authentication can remain; a second wallet signature, “finish endowment” or manual payment report fails the proposed checkout. |

## Sequential checkpoints

- [ ] **1. Establish US/EU prerequisites.** Product owner selects one garden/vault and exact asset; integration owner obtains Stripe preview details and endowment approval, confirms eligible US states and two EU countries, and validates account-specific credit-card/fiat/Arbitrum USDC quotes. Read deployed vault behavior and donor redemption/yield routing. Confirm EU verification and downstream asset permissions separately. **Output:** per-cohort prerequisite decisions, not one global approval. Provider waiting time is unknown.
- [ ] **2. Prove the signed execution path.** Timebox to one engineering day, starting with thirdweb exact signed UserOperation/batch on an Arbitrum fork/test environment. Prove unfunded preparation, late delivery, sponsorship validity, single-use enforcement, donor share ownership and page-close completion. Evaluate a restricted session only if needed; reject broader authority. **Output:** a real compatible mechanism, or a stop-and-rescope decision before any donor is charged.
- [ ] **3. Add the direct Stripe adapter.** Backend owns Link OAuth exchange/refresh, region-specific customer status/limits, wallet registration binding, quotes, payment/session status and signed webhook handling. Separate US L0 stopping rules from EU required verification and resumability. Keep OAuth secrets/tokens off the client; use provider-hosted card entry and avoid storing raw KYC. Verify amount/currency units against the enabled API. **Output:** sandbox purchase state and idempotent completion reconciliation, without claiming actual KYC/credit acceptance.
- [ ] **4. Add the checkout state and endowment orchestration.** Shared owns the typed intent and authorization/deposit coordinator; persist recoverable state without keys. Bind the single authorized batch to the authenticated donor and server intent, and independently verify delivery/deposit. **Output:** deterministic negative tests for stale/mismatched/duplicate/partial outcomes and a resume path without another purchase or deposit confirmation.
- [ ] **5. Wire a private pilot checkout.** Extend the nearest public vault checkout/panel with email, region-appropriate provider setup, card, itemized review, one final action and pending/receipt screens. Add recovery/position management and a private country/method/garden enrollment gate. Use localized copy and labeled rendered evidence. **Output:** end-to-end sandbox mechanics plus a reviewed live-test checklist. No live credentials or dependency installation are implied by this plan.
- [ ] **6. Run the authorized US cohort.** Three genuinely first-time participants and two repeat $50 checkouts; Visa and Mastercard, two issuers, two eligible states, mobile/desktop, page closure and cross-device email recovery. Verify a small donor-controlled redemption. Keep all step-up and declined attempts in the denominator. **Output:** US-only decision after actual credit posting and chain proof, using [eval.md](eval.md).
- [ ] **7. Run the separately authorized EU cohort.** Two first-time participants in two approved EU countries and one repeat at €50 each. Prove mandatory verification/resume, locally issued credit cards from two issuers, page-close completion and recovery. Evaluate first-time and returning timing separately. **Output:** EU decision limited to the tested countries and approved route; EU onboarding is not called L0. Shared technical failures block both cohorts; regional eligibility failures block only the affected route.
- [ ] **8. Select later regional routes.** After the US/EU foundation is proven, resolve [regional gaps](regions.md#provider-decisions): Brazil Ramp Pix versus Fonbnk Pix; South Africa Fonbnk redirect; Nigeria Fonbnk manual-flow removal and entity/partner approval. Product/integration owners record one selected provider/method or no-go per country, quote/limits, verification profile, settlement/refund SLA and local-currency test budget. **Output:** selection evidence; no integration work for a failed route.
- [ ] **9. Add one selected regional route at a time.** Reuse funding intents and the donor authorization boundary; add only the chosen adapter, verification/payment presentation and reconciliation. Split backend, Shared and client edits into separately verifiable 3–4-file batches. Prove the actual bank-settlement window against authorization/swap/paymaster expiry before live work. **Output:** route-specific negative tests and rendered proof; never a broad delegated wallet permission to accommodate slow banks.
- [ ] **10. Run and decide each later cohort separately.** Two first-time attempts and one repeat per selected route, around $50 equivalent subject to limits and an approved local budget. Include page closure, a delayed payment and cross-device recovery. A separate card subtest is required for any credit-card claim. **Output:** one go/no-go record per country/provider/method; no automatic rollout based on another country's result.

Keep the authorization spike to one engineering day. The earlier 3–5-day estimate applied only to the initial US slice and is not a commitment for this expanded plan. Estimate EU and later route work after the prerequisite/spike results; provider enablement, verification review, banking settlement and issuer posting are separate unknown waits.

## Ownership and nearest implementations

| Capability owner | Nearest source and actual gap | Proposed bounded work |
| --- | --- | --- |
| Backend funding integration | [Thirdweb adapter](../../../packages/agent/src/api/funding/thirdweb.ts) creates provider payment links and rejects endow; [funding intents](../../../packages/agent/src/services/funding-intents.ts) own durable attempts. | Add one Stripe-specific adapter/route using existing funding persistence and reconciliation. Do not extend hosted-link metadata into a pretend L0 API. Split transport and session wiring into separate bounded edits. |
| Shared funding/ownership | [Card-endow rules](../../../packages/shared/src/modules/vault-crowdfunding/card-endow.ts) and [proof rules](../../../packages/shared/src/modules/vault-crowdfunding/card-proofs.ts) check receiver and tuples. | Reuse pure checks where their meaning matches; put the reusable coordinator/hook in Shared and consume declared exports. Split intent/proof changes from the coordinator. |
| Public client checkout | [Vault dialog](../../../packages/client/src/components/Public/Vault/VaultCheckoutDialog.tsx), [card panel](../../../packages/client/src/components/Public/Vault/VaultCardPaymentPanel.tsx) and [staged flow](../../../packages/client/src/components/Public/Vault/VaultCardEndowFlow.tsx). | Reuse the existing presentation, replacing hosted payment links in the gated pilot; split Stripe/email presentation from final route wiring. Read client design/browser guidance before UI implementation. |
| Contract semantics | Existing verified vault/token/strategy contracts. | Read-only verification. No contract source changes or deployment in this pilot. If new functionality is essential, stop this plan and scope it explicitly. |

Each implementation edit should touch about 3–4 owning files, with a useful independent proof. File names for new runtime code remain provisional until prerequisites identify the compatible route. Reuse the existing authentication boundary; do not add client-local hooks or global wallet migration.

## Requirements coverage

| Requirement | Checkpoints | Evidence |
| --- | --- | --- |
| US/EU acquisition priority | 1, 6–8 | Separate initial cohorts; later routes do not become launch dependencies |
| L0 US credit card on Arbitrum | 1, 3, 6 | Enabled quote, actual tier, successful credit posting and correct delivery |
| EU verified credit-card route | 1, 3, 7 | Required EU verification, country/issuer proof, returning reuse |
| Brazil, South Africa and Nigeria route selection | 8–10 | Explicit provider/method, gaps, local budget and independent decision |
| Email-first donor ownership | 2, 4–7, 9–10 | Same-wallet email recovery, donor-only admin rights, donor shares and redemption |
| One checkout, automatic endowment | 2, 4–7, 9–10 | One final consent, bounded preauthorization, page-close/delayed completion, no extra deposit action |
| Usable garden benefit and truthful receipt | 1, 4, 6–7, 10 | Vault/strategy and garden yield beneficiary, deposit/ownership receipts, separate yield proof |
| Clear fees and failure/support recovery | 3–10 | Local total/FX, failure matrix, payment posting and private support drill |

## Implementation and validation posture

No runtime behavior was changed while preparing this hub. Future behavior-changing lanes require focused RED/GREEN proof and fresh receipts before terminal status. Use the repository validation selector for the actual touched paths, retaining critical signing/money-movement overrides. Request dependency approval before adding Stripe preview packages; preserve the current thirdweb version until the spike proves a justified change. Keep credentials in the root environment pattern. The later user request authorizes the recorded Linear sync; live accounts, personal data, payments, provider contacts and broadcasts remain outside this work.

Acceptance and failure details live in [eval.md](eval.md). Planning-only evidence and the task phase record live in [the planning handoff](handoffs/planning.md).
