# Cosmo-Local commitment integration plan

> Historical proposal. The 21 October accepted [specification](spec.md) supersedes core-upgrade,
> adapter-minting, optional-acknowledgment and unresolved allocation/confirmation proposals here.
> Retained for rationale; use the current spec and contracts handoff for implementation scope.


**Reconciled:** 20 October 2026 UTC / 19 October Pacific. **Planning only.**
The user authorized research and cleanup of this plan and Linear, followed by Claude review.
No runtime implementation, deployment, lane activation or external-audit claim is authorized.

## Corrected scope

A commitment can receive **vouchers and G$**, with both terms agreed at acceptance. The previous several-G$-installments scope and its
3–4-day demo / 5–8-day audit-candidate estimates are superseded. They must not drive implementation.
The [architecture alignment](architecture-alignment.md) owns current evidence, options, diagrams
and unresolved choices; [spec.md](spec.md) owns the broader integration baseline.

Recommended candidate: a narrow CommitmentPooling upgrade for accepted voucher references and
fulfillment provenance; a new Arbitrum voucher authorization module; a new Gnosis issuer adapter;
reuse CLC token/pool implementations and the existing G$ settlement route. Contract/API selection
is pending RESR-73, issuer terms and Claude's review. PRD-1315 freezes the accepted implementation
boundary after that review. It is not already done.

## Preserved deployment evidence

The read-only snapshot at **2026-10-20T01:38:54Z**, Arbitrum **516456240** / Celo **80559576**,
reported 42 commitments (32 requested, 6 accepted, 2 fulfilled, 2 cancelled), 26 non-cancelled
Celo-priced commitments all requested, and zero commitment payout plans, member funding, refunds
or loans. Three confirmed funding disbursements used four attempts and acknowledgments. Eighteen
Celo routes and 11,900,000 G$ across three settlement Safes were present. The relevant modules
were unpaused and protocol-Safe-owned. G$ units are not US dollars.

This is historical planning evidence, not a current release preflight. Preserve live records,
funds, replay history and identities. No existing commitment acquires a voucher promise by default.
The Gnosis v1.1.0 documentation / v1.0.0 deployment-table mismatch needs explicit resolution.

## Phases, priorities and dependencies

P0 means required to establish and prove the contract boundary; P1 means required for the complete
member/steward demonstration and audit intake. Priorities are sequencing guidance, not dispatch.
The existing issue IDs are reused to correct their scope, not to create a second delivery backlog.

| Phase | Issue | Corrected outcome | Priority | Prerequisites |
|---|---|---|---|---|
| Decide | RESR-73 | Research conclusions, Claude review, unresolved human choices | P0 | COM-46 for issuer terms |
| Decide | PRD-1315 | Accept voucher-plus-G$ behavior and contract boundaries | P0 | RESR-73 |
| Contracts | PRD-1316 | Expose accepted terms and authentic fulfillment for voucher eligibility | P0 | PRD-1315 |
| Contracts | PRD-1317 | Authorize voucher entitlements from Arbitrum | P0 | PRD-1315, PRD-1316 |
| Contracts | PRD-1318 | Execute bounded voucher issuance on Gnosis with replay-safe receipts | P0 | PRD-1317 |
| Contracts | PRD-1319 | Prove integration compatibility and preservation of existing G$ behavior | P0 | PRD-1316, PRD-1317, PRD-1318 |
| Data | PRD-1320 | Index linked fulfillment, G$ and voucher receipts | P0 | PRD-1316, PRD-1317, PRD-1318 |
| Shared | PRD-1321 | Provide consistent per-obligation status to both apps | P0 | PRD-1320 |
| Shared | PRD-1322 | Add authorized voucher actions and safe recovery | P0 | PRD-1317, PRD-1318, PRD-1321 |
| Admin | PRD-1323 | Review voucher-plus-G$ terms and outcomes in commitment detail | P1 | PRD-1321, PRD-1322, PRD-1299 |
| PWA | PRD-1324 | Explain work completion and each agreed reward | P1 | PRD-1321, PRD-1322, PRD-1299 |
| Operations | PRD-1325 | Prepare verified Gnosis configuration and any accepted Arbitrum upgrade | P0 | PRD-1315, PRD-1319 |
| Rehearsal | PRD-1326 | Prove both rewards, failure recovery and legacy preservation | P1 | PRD-1319, PRD-1320, PRD-1322–1325, PRD-1096 |
| Audit | PRD-1327 | Freeze the reviewed integration audit-intake package | P1 | PRD-1326 |

PRD-1314 is the roadmap parent. PRD-1323/1324 stay in **Green Goods 2.1.0** and relate to
PRD-1261/1262. They own linked commitment rewards only. PRD-1297 owns the broader voucher UI,
PRD-1299 its design, and PRD-1096 the existing local protocol-loop rehearsal. PRD-1326 verifies
the additional Green Goods dual-reward integration rather than duplicating that protocol rehearsal.
PRD-857 remains the overall voucher-delivery parent. No existing assigned work or due dates are reset.

Pitch preparation and public Q4 strategy continue through MAR-32 and GROW-68 → PRD-1194.
They consume an accurate claim ledger and labeled rehearsal evidence, not an implicit live launch.
General PWA simplification/cohesion can proceed without a live Gnosis deployment.

## Effort forecast to revisit after review

These are **conditional agent-assisted elapsed working-day ranges**, not measured throughput or
new deadlines. They assume issuer decisions are available, a usable CLC version is identified,
one voucher asset per demonstrated commitment, and no general fiat/multiasset executor build.

| Outcome | Working days from architecture acceptance | Boundary |
|---|---|---|
| Narrow contract/fork proof of one commitment receiving G$ and vouchers | 3–5 | Mocked transport, if used, explicitly labeled; no full app/release claim |
| Integrated PWA/admin rehearsal with recovery | 5–8 | Existing screens and signing infrastructure; version/account issues can extend this |
| Internally reviewed audit-intake candidate | 8–12 | Includes invariant, migration, deployment and reviewer fixes; not an external audit |

Do not promise production activation within these ranges. External audit scheduling, partner terms,
transport compatibility and existing testnet/timelock/go-no-go gates have independent lead times.
Reforecast after PRD-1315 and the first real selected-version conformance proof.

## Audit and acceptance evidence

- Freeze accepted terms, fulfillment eligibility, issuer delegation, recipient allocation, service
  lifecycle, chain roles, source/receipt authentication and legacy semantics.
- Prove per-asset conservation, cap/reservation rules, duplicate command rejection, successful mint
  with lost acknowledgment, retry, wrong peer/issuer, expiry, depleted capacity and partial success.
- Preserve the existing G$ singleton plan, funding/refund behavior, retained amounts, executor
  protocol, Safe balances and history. A voucher delay must not re-open completed G$ payments.
- Prove selected-version CLC interfaces and authorities; distinguish issuer capacity, mint budget
  and pool holding limits. Record upstream audit coverage and this integration's separate scope.
- Pin storage layout and exact candidate if a core upgrade is accepted; preserve old readers and
  explicit legacy provenance. Demonstrate migration/rollback on a dated fork.
- Produce indexer replay/reorg proof, shared state parity, labeled PWA/admin rendered proof, and
  source-backed live/rehearsal claims for the pitch/passport.
- Include reproducible wrapper commands, deployment manifests, authority checks, pause/recovery
  runbooks, residual risks and external auditor questions. No gate is waived by planning.

## Review handoff

Use [Claude's second-pass handoff](handoffs/claude-architecture-review.md). The reviewer should
challenge this recommendation against the primary protocol resources and current Green Goods
code, identify missing requirements and recommend the smallest sound alternative where needed.
Architecture review does not authorize implementation or mark PRD-1315 complete.
