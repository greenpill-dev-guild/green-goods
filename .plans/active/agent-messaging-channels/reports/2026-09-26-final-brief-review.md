# Final technical brief review

**Date:** 26 September 2026
**Scope:** the current technical brief, all 21 Mermaid sources, six browser wireframes and the current hub projections. Dated research records remain historical.
**Repository reference:** `da329c99e556ad248dded850efc1f8e6cc0c75be`; the reviewed documentation is an uncommitted working-copy revision, not a tested runtime commit.
**Verdict:** COMMENT_ONLY — evidence review with document corrections. The specification now provides a coherent API-harness implementation boundary. Live integrations and production readiness remain unproven.

## Coverage ledger

| Review batch | Coverage | Result |
| --- | --- | --- |
| Product, accounts and processing | Brief sections 1–4; current user decisions; relevant source types/builders and converter/provider boundaries | Reviewed; account scope and processing responsibilities are explicit |
| State, identity and persistence | Sections 5–6; every state/ERD source; consent, revision, outbox and attempt invariants | Reviewed; missing persistence contracts corrected |
| Browser, API and sequences | Sections 7–9; all sequence sources; six rendered SVG wireframes; session and recovery boundaries | Reviewed; command, handoff and retry gaps corrected |
| Operations and delivery | Sections 10–14; current brief/plan/eval/spec/status projections; historical dispatch labels | Reviewed; accepted defaults and staged completion gates aligned |

No runtime source, dependency manifest, deployment configuration, contract or tracker was changed. No subagent, package installation, provider upload, wallet operation or chain transaction was used for this review.

## Findings closed in the document

**1. Persisted records did not fully express the stated authority — high, specification completeness.** Section 6 showed challenge hashes without the source/resource bindings required by section 7, and review digests without enough saved decision content to reconstruct confirmation. It also left source/derived media references and grant policy/budget data implicit. The revised ERDs and physical constraints now include those bindings, immutable review content/history, confirmation evidence, asset manifests and attempt references. A review of an existing onchain Work may have no local draft. Future group conversation identity is keyed by chat/thread, with sender identity on source entries, so one group has one binding history. The future Profile model remains outside the current schema.

The sibling sweep covered challenge issuance, revision confirmation, report/review operations, grants, media, inbox/outbox and account associations. The document now also names the mandatory base WorkSubmission fields beyond Action.inputs and the stronger application review rules, including explicit confidence and human attribution. Exact EAS defaults match the current builders; review workUID remains inside schema data rather than outer refUID.

**2. Browser and execution lifecycles had underspecified commands and contradictory retry paths — high, contract clarity.** Recovery and execution-grant management now have concrete API operations, expected-version/digest checks and idempotency behavior. Recovery starts from the new chat without the old phone. A different browser requires its own proof; session cookies never travel in links. Pairing codes are displayed in the intended browser and supplied through the original chat. Initial unverified browser access cannot monopolize the locator. The prototype’s single active resource scope per browser cookie is explicit.

The sibling sweep covered owner signing, delegated signing, setup, revoke, relink, mobile handoff and repeated tabs. Sequence diagrams now validate envelopes before reservation, separate grant enablement from review submission, and preserve the first report confirmation during setup. Proven pre-broadcast rejection needs explicit retry; an unknown wallet outcome remains reserved. Signed UserOperations are durably checkpointed before bundler handoff; a paused/expired grant allows reconciliation only. Stale model output does not consume unapplied input. The model-call budget no longer implies an extra unbounded wording call.

**3. Delivery and defaults had competing interpretations — medium, scope clarity.** Section 12 is the current delivery contract, with a concrete first API harness and separate live interpretation, owner-signing, delegation and recording gates. Its Shared/domain and SQLite work is the same implementation later hardened by subsequent steps. Live credentials do not block synthetic tests. Companion plan/evaluation files now label older dispatch and cut lines as historical; their old no-model/no-delegation wording is not current scope. Lane status remains blocked until ownership and handoffs are reconciled; no tracker status was advanced.

The user accepted reporting permissions of **24 hours / 5 submissions** and separate review permissions of **1 hour / 5 decisions**. Gas caps still require measured calls. The user also accepted **24-hour pre-consent expiry**, **7-day inactive-draft expiry**, and private-source cleanup after publication/reconciliation. The brief specifies that retries do not extend retention, raw derivatives/diagnostics are covered, and uncertain execution evidence is retained minimally for reconciliation. Provider retention and minimal audit/backup schedules remain separate operating gates.

## Requirement closure

| Requirement | Specification status | Runtime evidence |
| --- | --- | --- |
| WhatsApp-first story/correction/review; garden context; human attribution | SATISFIED in the current contract | Unimplemented/unproven |
| Existing EOA signing plus separate existing-Kernel report/review grants | SATISFIED, with explicit fallback and compatibility gates | BLOCKED pending exact module/custody proof |
| OpenAI content processing, Jev decisions, automatic conversion and spreadsheets | SATISFIED, including coverage, privacy and deterministic arithmetic | BLOCKED pending models/converter evaluation |
| Platform-neutral agent-reporting routes, PWA design, recovery | SATISFIED in API/machines/wireframes | BLOCKED pending actual route, proxy and wallet proof |
| API harness first and current dependency/ownership map | SATISFIED; bounded completion criteria specified | Not implemented |
| Passkey-first onboarding/Profile wallet linking, group transport, EIP-7702 | OUT_OF_SCOPE for current implementation | Future-only or excluded as specified |

## Safety facts and limits

**Human attester and resolver rules — PATH_TRACED.** The existing EAS builders, Work/WorkApproval resolvers, Shared WorkSubmission and review validator were inspected. They support the documented attester, garden, timing, no-self-review and call-shape contracts. Application-required confidence/field rules are stronger than the resolver’s range checks and must be enforced by the new command boundary. Source inspection is not a live Arbitrum proof.

**Scoped Kernel delegation — REFERENCED.** ZeroDev’s call-policy documentation describes target/function/argument restrictions. It does not prove the current Kernel 0.3.1 configuration can enforce the nested EAS garden/schema/work constraints or indirect review effects. The brief retains adversarial policy, custody, budget and revoke gates; it does not call that integration complete.

**Provider interpretation — REFERENCED.** TypeSafe documents text-only state and independent questions; OpenAI data controls distinguish application state and retention settings. Current diagrams respect those boundaries. No model accuracy or privacy-setting claim was established by a live request.

## Verification and remaining gates

The 21 updated Mermaid sources passed syntax parsing with `node /private/tmp/check-gg-mermaid.mjs`. The six updated SVG wireframes were rasterized with the existing Sharp dependency and visually inspected: route names and accepted limit labels are legible, with no observed text overlap. These are artifact checks, not authenticated browser QA. Full browser rendering, diagram layout and PDF pagination remain unverified because authenticated browser control is unavailable in this environment.

Final handoff also runs the document DOM/link/theme check, the selector-chosen non-mutating review check, Plan Hub validation and diff hygiene. Their completion is reported in the task response. The review selector chooses formatting for this documentation scope; it does not select runtime tests or builds.

No further product decision is needed to define the synthetic API-harness slice. Before live stages: assign the builder, reconcile tracker/handoffs, pin/evaluate models and converters, verify source-channel/provider setup and canonical origin, prove garden roles and exact wallet/Kernel behavior, select isolated signer custody, measure gas budgets and settle provider settings plus minimal audit/backup retention. None of those gates is silently waived by a clean document review.
