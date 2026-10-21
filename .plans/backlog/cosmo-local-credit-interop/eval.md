# Cosmo-Local Integration — acceptance evidence

**Reconciled:** 2026-10-21 UTC. These criteria apply to separately accepted implementation slices.
No check below is certified by planning, a Linear state or the completed foundation project.
PRD-1096 covers its approved fork scope only: its report must keep exact-revision claimant consent,
issuer-cap enforcement, the live escrow-to-promise handshake, claimant-funded Offer payments and
distinct gardener issuer identity/cap isolation, and independent steward issuer suspension unproved
where the defaults do not exercise them. The handshake limit includes escrow placement/custody.
Steward approval is not claimant consent, and the service-desk stand-in is not the live handshake.

| Boundary | Required observable evidence | Owner |
|---|---|---|
| Authority | Unauthorized source chain/sender/hat/issuer rejected; adapter and Arbitrum stewards lack pool authority. The issuer Safe owns the selected pool and can call `withdrawLiquidity` after sealing; P7 proves and discloses that retained custody power | PRD-1096 |
| Linked rewards | One commitment receives agreed vouchers and G$ independently; neither receipt implies the other or later service delivery | PRD-1315 / PRD-1326 |
| Accepted voucher terms | Issuer and counterparty consent freeze the exact approved revision, amount/allocation policy and eligibility while Offered/Requested, before both immediate open-claim and approval-gated acceptance. Direct core claimCommitment/acceptClaim cannot bypass it; frontend wrappers, post-acceptance consent and dispatch exclusion are insufficient. If the unchanged core cannot enforce this, return the boundary to PRD-1315 before dispatch; later revisions cannot silently replace a pending claimant's or accepted counterparty's terms; existing commitments gain no implicit entitlement; earned-reward recipients equal to the reserve holder are rejected before accepting the voucher obligation (the rehearsal proves only Offer approval and Request dispatch rejection) | RESR-73 / PRD-1315 / PRD-1317 |
| Presentment setup recovery | Deposit success plus rejected/delayed receipt or failed promise creation converges through idempotent retry or authenticated setup cancellation/expiry/refund. Test delayed/duplicate/reordered activation and abort, refund failure/retry, no duplicate promise or stranded balance, no activation after setup refund and no setup-abort refund after activation; ordinary authorized service remedies remain available. Timeout alone proves no remote failure | PRD-1315 / PRD-1317 / PRD-1318 |
| Partial cross-chain outcome | G$ success with voucher delay, voucher delivery with lost acknowledgment and safe reconciliation do not duplicate either asset | PRD-1318 / PRD-1326 |
| Protocol version | Selected Gnosis implementations match the published build artifacts (four established on 20 October, the rest pending) and controllers and proxy admins are recorded; re-read at the deployment block | PRD-1319 / PRD-1325 |
| Earned issuance | Source entitlement, eligibility and actual confirmer path retained; no assumed beneficiary confirmation | PRD-1096 / COM-46 |
| Purchased issuance | The issuer pool's bounded swap settles payment and voucher delivery atomically; record finality, recipient, actual output, minimum output, deadline and inventory delta. No separate purchase message or entitlement exists under this route. A later route with separate settlement must define its entitlement and payment cancellation/refund rules; COM-46 owns service cancellation/refund terms in either case | PRD-1096 / COM-46 |
| Replay and recovery | Same message and distinct-message reuse both rejected; retry cannot deliver twice; failed and pending states reconcile. G17/G18 prove explicit Safe-authorized retired-peer recovery after expiry or zero-grace rotation, with the old source unavailable and economic terms unchanged | PRD-1096 |
| Upgrade immutables | M17/G16 reject non-owner/unpaused upgrades and replacement router/local-selector mismatch or missing getters; compatible UUPS upgrades preserve commands, results, consumption and spend | PRD-1096 / PRD-1319 |
| Capacity and caps | Agreed deliverable service capacity, issuance cap and token holding limits remain distinct and bounded | COM-46 / PRD-1096 |
| Steward issuer suspension | Record steward/admission authority independent of issuer-Safe cooperation, authenticated cross-chain state/order, per-issuer stop scope and recovery. Test affected mint/earned/purchase routes, bypass attempts, replay/unauthorized controls, in-flight commands and issuer isolation; preserve the approved outstanding service/discharge/refund path. Required unenforceable stops block release. The fork's owner pause does not prove this | PRD-1315 / PRD-1318 |
| Issuer budget | The amount the adapter can deliver is bounded by the token allowance or its own writer-path cap. Acceptance is unreserved: allowance is shared and revocable, not earmarked per entitlement; oversubscription and depleted reserve/allowance must fail safely and recover. The adapter holds no pool or limiter authority | PRD-1318 / COM-46 |
| Member account | Gnosis derivation, ownership, sponsored signing and recovery proved independently of garden accounts | PRD-1096 |
| Exchange | Executable direct swap with minimum output/deadline; stale quote, de-list, depleted inventory, limit and sponsorship failures | PRD-1096 |
| Service discharge | Presentment, partial/full delivery, confirmation and once-only discharge; failed delivery has a visible remedy. If COM-46 permits partial delivery, authenticated live commands bind delivered/refundable quantities to one escrow and conserve presented units. One immutable full-discharge/full-return/partial-split decision owns shared escrow progress; conflicts reject and terminal state follows settlement of every authorized leg. Test discharge after full return, repeated return, return after full discharge and repeated discharge, with another same-token escrow untouched. Partial legs settle once in either order without consuming or stranding each other. The fork desk tests its atomic stand-in separately | COM-46 / PRD-1096 / PRD-1317 / PRD-1318 |
| Presentment handshake | An authenticated, replay-safe receipt binds presenter, promise, token, amount and escrow receipt; the Gnosis escrow is proved to exist before the presenter becomes the Arbitrum counterparty; replay and unknown escrow are rejected | PRD-1315 / PRD-1317 / PRD-1318 |
| Voucher-accepting Offer payment | The selected claimant is bound as payer after claim selection, authorizes the exact payment and funds the approved reservation/escrow/debit route. Missing authorization or funds cannot appear paid; issuer-funded rewards cannot substitute. Failure/cancellation releases or refunds once under the recorded rule | PRD-1315 / PRD-1317 / PRD-1318 |
| Gardener issuer identity | Two gardeners sharing a garden or Safe retain distinct issuer identifiers, each with recorded token/admission-authority bindings and isolated authorization/caps; one cannot consume the other's cap or spend under the other's authority | PRD-1315 / PRD-1317 / PRD-1318 |
| Foundation invariants | Non-transferable promise identity, existing settlement meaning and no bridged value preserved | PRD-1096 |
| Passport | Definitions, units, windows, source/freshness and receipt links; earned/purchased/payment/delivery/obligations separate | PRD-1097 |
| Privacy | Separate publication consent, privacy-safe aggregates, no addresses or individual ranking | COM-46 / PRD-1097 |
| Usability | Member and steward complete meaningful tasks, recover from interruption and explain balances and obligations | RESR-93 / COM-28 |
| Live gate | Exact scope and human decision; each audit/Safe/timelock/testnet/rollback gate addressed | PRD-1197 |
| Live outcome | Authorized deployment readback plus a real service delivered and confirmed; otherwise explicit no-go | PRD-1100 |
| Pitch integrity | Claim ledger, primary sources, live/rehearsal labels and audience-specific offer; no invented traction or financial rights | RESR-94 / MAR-32 |
| Fiat stretch | Qualified corridor/account/recipient, all-in costs, payment recovery and separate live-pilot approval | RESR-82 / PRD-1031 / PRD-1038 |
| Voucher language | CLC instruments are called vouchers; promises, money, credit facilities and fulfillment retain distinct meanings | RESR-73 / MAR-32 |
| App cohesion | Accepted member/steward scope, shared patterns, truthful states and labeled rendered proof in en/es/pt | RESR-93 / PRD-1260 / PRD-1261 |
| Public Q4 strategy | Approved October–December priorities and asks at a stable public URL, source dates and working asset links | GROW-68 / PRD-1194 |
| App release | Admitted and deferred scope, included journey proof and final beta walk; no implied live CLC requirement | PRD-1262 |

## Validation strategy

Select focused checks for each implementation change using the repository validation policy;
critical financial surfaces retain their complete overrides. Unit tests should protect authorization,
accounting, replay and meaningful failure behavior. Integration and fork evidence should identify
chain/block, exact implementation and configuration, simulated components and remaining live unknowns.
A local fork demonstrates the tested deployment at the pinned state, not a later live configuration.

Rendered evidence follows AGENTS.md: identify the browser/session, distinguish authenticated signing
or installed-PWA proof from mocks, and record unavailable proof honestly. This pass changes deck
text and accessible narration while preserving CSS and element structure. Rendered proof is
**pending** because the browser security policy blocked the local file. Static HTML/JSON and paired
notes are checked directly; text wrapping and overflow remain unverified.

The whitepaper review records the earlier 275 passing focused foundation tests. Runtime code has
not changed during project reconciliation, so those tests were not rerun or recharacterized as CLC
integration evidence. Validate these planning edits with the plan-hub validator, source links,
status consistency, preserved lane objects, Linear readback and `git diff --check`.

## Useful pilot outcomes

Measure useful service use, repeated participation, outstanding obligations, assistance and recovery.
Capture whether a third-party voucher exchange solves a real need; a bilateral-only result is valid.
Money, volunteer time, knowledge, equipment and relationships do not become one invented total.
Impact certificates require their own claim and verification basis. The pitch must show both the
supported benefit and the evidence still missing.
