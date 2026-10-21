# Cosmo-Local Integration — acceptance evidence

**Reconciled:** 2026-10-20 UTC. These criteria apply to separately accepted implementation slices.
No check below is certified by planning, a Linear state or the completed foundation project.

| Boundary | Required observable evidence | Owner |
|---|---|---|
| Authority | Unauthorized source chain/sender/hat/issuer rejected; issuer cannot withdraw pool money | PRD-1096 |
| Linked rewards | One commitment receives agreed vouchers and G$ independently; neither receipt implies the other or later service delivery | PRD-1315 / PRD-1326 |
| Accepted voucher terms | Issuer consent, amount/allocation policy and eligibility are explicit; terms are registered only while the commitment is Offered or Requested and cannot change afterward; existing commitments gain no implicit entitlement | RESR-73 / PRD-1315 |
| Partial cross-chain outcome | G$ success with voucher delay, mint success with lost acknowledgment and safe reconciliation do not duplicate either asset | PRD-1318 / PRD-1326 |
| Protocol version | Selected Gnosis implementations match the published build artifacts (four established on 20 October, the rest pending) and controllers and proxy admins are recorded; re-read at the deployment block | PRD-1319 / PRD-1325 |
| Earned issuance | Source entitlement, eligibility and actual confirmer path retained; no assumed beneficiary confirmation | PRD-1096 / COM-46 |
| Purchased issuance | Settled receipt, correct recipient allocation, cancellation/refund policy and unique entitlement | PRD-1096 / COM-46 |
| Replay and recovery | Same message and distinct-message reuse both rejected; retry cannot double mint; failed and pending states reconcile | PRD-1096 |
| Capacity and caps | Agreed deliverable service capacity, issuance cap and token holding limits remain distinct and bounded | COM-46 / PRD-1096 |
| Issuer budget | The amount the adapter can deliver is bounded by the token (allowance) or by a revocable writer cap; the adapter holds no pool or limiter authority | PRD-1318 / COM-46 |
| Member account | Gnosis derivation, ownership, sponsored signing and recovery proved independently of garden accounts | PRD-1096 |
| Exchange | Executable direct swap with minimum output/deadline; stale quote, de-list, depleted inventory, limit and sponsorship failures | PRD-1096 |
| Service discharge | Presentment, partial/full delivery, confirmation and once-only discharge; failed delivery has a visible remedy | COM-46 / PRD-1096 |
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
or installed-PWA proof from mocks, and record unavailable proof honestly. This planning pass changed
no UI and has rendered proof **none**.

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
