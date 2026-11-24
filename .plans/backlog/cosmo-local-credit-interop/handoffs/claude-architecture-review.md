# Claude Code — independent architecture review and second pass

Copy the following prompt into a fresh Claude Code session. This is review, not an implementation
dispatch. The first pass and tracker cleanup are intended inputs to challenge, not approved design.

```text
Review the Green Goods × Cosmo-Local architecture proposal in:
/Users/afo/Code/greenpill/green-goods

Read AGENTS.md, applicable guides and the review/research skills. Stay on the existing branch.
The checkout is shared and dirty; do not overwrite other work.

User intent
- A single Green Goods commitment can receive both vouchers and G$.
- The user explicitly chose to agree voucher and G$ terms at commitment acceptance.
- Keep the initial issuer-service model simple: contribution earns access to services;
  supporters can separately purchase access.
- Establish a sound contract foundation for an audit, with clear Arbitrum and Gnosis roles.
- Preserve PWA/admin cohesion, Tech and Sun pitch clarity and public Q4 strategy.
- No implementation or deployment in this session.

The earlier interpretation as several G$ installments was wrong and has been superseded.
Do not revive it, but independently challenge the replacement proposal too.

Primary sources
https://docs.cosmolocal.credit/protocol/overview
https://docs.cosmolocal.credit/protocol/smart-contracts
https://docs.cosmolocal.credit/protocol/network
https://github.com/cosmo-local-credit/protocol

Read any additional protocol documentation I attach. Identify versions and contradictions.
The first pass resolved v1.1.0 to ce090fd3d5a7493c726fb939da39af15ef1c9d7c.
Its README labels the Gnosis deployment table v1.0.0; do not assume compatible deployed bytecode.
Respect the clean-room boundary: published documentation/metadata/interfaces only.
Do not read, import or vendor upstream AGPL implementation source.

Local inputs
.plans/backlog/cosmo-local-credit-interop/architecture-alignment.md
.plans/backlog/cosmo-local-credit-interop/commitment-upgrade-plan.md
.plans/backlog/cosmo-local-credit-interop/{brief.md,spec.md,plan.todo.md,eval.md,status.json}
The applicable ontology and current contract implementations/callers.

Read live RESR-73, PRD-857 and PRD-1314–PRD-1327. PRD-1299 owns voucher UI design;
PRD-1297 owns broader voucher UI implementation. PRD-1323/1324 own only linked commitment
rewards in Green Goods 2.1.0. Preserve their relationship to PRD-1261/1262.
A Linear state is not proof that an architecture is selected or implemented.

First-pass recommendation to review
A narrow CommitmentPooling upgrade exposes accepted voucher terms and fulfillment provenance.
A new Arbitrum CosmoLocalModule owns entitlements, issuer authorization and receipts.
A new restricted Gnosis issuer adapter performs once-only issuance through reused CLC token
implementations. Reuse CLC pool/configuration contracts. Reuse the existing G$ SettlementModule,
Celo executor, Safes and routes unless a concrete compatibility requirement disproves that choice.

Assess this against both alternatives: a no-core-upgrade sidecar with explicit award/attester
semantics, and a broader multiasset settlement redesign. Recommend the smallest adequate design.
The user has accepted voucher-plus-G$ intent and acceptance-time terms, not every contract choice
or issuer/allocation policy. Do not reopen the accepted product decision without a concrete
conflict or risk; review whether the implementation proposal enforces it.

Questions requiring independent review
1. Are promised voucher terms enforceably bound at acceptance without two conflicting sources
   of truth? Which exact core change is needed, and could existing interfaces suffice?
2. Does the fulfillment record accurately cover ordinary, fallback, dispute and legacy paths?
3. Is initial issuance preferable to transferring pre-issued inventory under issuer terms?
   Can a Green Goods steward authorize only the issuer budget actually delegated to them?
4. Are asynchronous outcomes safe: G$ succeeds/voucher waits; mint succeeds/ack is lost;
   duplicate transport or entitlement; stale terms; cap exhaustion; cancellation and repair?
5. Are capacity reservations, other mint authorities, recipient allocation, per-asset rounding
   and service discharge fully specified without inventing a generic payment engine?
6. Which components are reused instances, new instances of reused CLC implementations,
   upgrades to GG contracts, or genuinely new GG code? Verify chains and authorities.
7. Are source and receipt authentication, live transport version and selected CLC deployment
   proven or visibly pending? Do not use timeout as proof of failed destination execution.
8. Are legacy contracts, funded routes, indexer identities and app consumers preserved?
9. Are the plan's dependencies, agent-assisted estimates and audit evidence credible?
   Distinguish engineering elapsed time from external audit and release gates.

Deliverable
Create handoffs/claude-architecture-review-results.md in the same Plan Hub:
- Decision summary in friendly, plain language.
- Prioritized findings with sources and concrete consequences; distinguish fact,
  inference, recommendation and unresolved user decision.
- Corrected current/proposed architecture and one success/failure sequence diagram.
  Label chains, reused GG, reused CLC, candidate upgrades and new GG code.
  Keep funding, vouchers and delivery evidence distinct.
- A recommended final boundary, exact changes to the first-pass proposal, and only the
  decisions that Afo still needs to make.
- A proposed plan/Linear correction list if needed; do not apply external writes.

Read-only except this review artifact. No runtime changes, dependencies, branch actions,
transactions, deployments, tracker writes or publication. Do not mark PRD-1315 complete.
Do not rewrite canonical plans until Afo accepts the review decisions.
Finish once the artifact supports a concrete architecture decision; avoid a broad repo audit.
```

## First-pass verification and task record

The corrected Linear roadmap and 13 child tasks were read back, together with four existing issue
corrections, five milestones and the project overview. All 14 roadmap/task records remain Backlog;
31 roadmap dependency edges and the inspected external prerequisites have no cycles. Existing
assignees, cycles, due dates and four original milestone definitions were preserved. Local plans
remain uncommitted in a shared dirty checkout; no runtime files were changed by this pass.

Observed checks: `node scripts/harness/plan-hub.mjs validate` validated 29 feature hubs;
`git diff --check -- .plans/backlog/cosmo-local-credit-interop` passed; the bounded link check
found no missing local targets across nine edited Markdown documents. These checks certify
planning structure only. Browser proof: none (no UI changes). Claude review is pending.

Task record: Cosmo-Local architecture correction / PRD-1314 | Type: planning and research | Outcome: complete first pass
Agent/model: Codex / model not reported | Coverage: this research and planning-cleanup segment only

| Phase | Start → end (UTC, 20 October 2026) | Result / evidence |
|---|---|---|
| investigate | 03:26:54 → unknown | Primary protocol docs, pinned release metadata/specs and relevant Green Goods source |
| implement | unknown → unknown | Planning documents and reviewer handoff only; no runtime implementation |
| publish | unknown → 03:39:54 | User-authorized Linear planning corrections; no Git publication |
| verify | 03:39:54 → 03:41:42 | Plan validation, local links, diff check and bounded Linear readback above |

Human corrections: 0 in this segment; acceptance-time terms were an answered design decision.
Human attention: unknown. These timestamps measure observed elapsed boundaries, not active effort.
