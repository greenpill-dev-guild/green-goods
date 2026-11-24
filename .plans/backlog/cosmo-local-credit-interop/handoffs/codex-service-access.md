# Prepared prompt: personal G$ purchases and voucher redemption

**Status:** the user dispatched this prepared slice on 21 October 2026 after closure of the
remaining purchase proof gaps. The [execution continuation](codex-service-access-execution.md)
records resolved formatting, the approved validator repair and subsequent service implementation
and validation. At dispatch, the31-case fork and five-check baseline passed before any service
runtime edit. Those historical results do not certify the later extension; consult the execution
continuation for its current evidence. The architecture below is accepted and does not require
another architecture approval.

Originally prepared as planning-only under the user's instruction not to implement. That earlier
preparation boundary is superseded by the later dispatch, subject to its proof-closure sequence.

The subsequent user continuation also authorizes local Indexer/Shared/member integration and
cohesive local commits. Signing remains required and the user signs from their terminal. See the
[integration record](codex-service-access-integration.md). Earlier no-commit wording in the original
prompt below records the initial dispatch boundary; live restrictions remain unchanged.

## Accepted implementation prompt

Implement the next contracts slice for personal G$ purchases across gardens and service-voucher
redemption in `/Users/afo/Code/greenpill/green-goods`, following
`.plans/backlog/cosmo-local-credit-interop/spec.md` and its service-access amendment.

Work in the existing checkout on `feature/cosmo-local-contracts`; no worktree. First inspect
the branch, status and existing changes. The earned-voucher implementation is already present
locally and uncommitted, with evidence in `handoffs/codex-contracts.md`; inspect and preserve it.
Do not recreate it, attribute other sessions' changes to this task, or reuse its historical test
results as proof of new behavior. If the branch changed, do not switch underneath another session;
report that conflict. Fetch and inspect `origin/develop` for newer relevant code, but do not
automatically merge/rebase a shared dirty checkout. No stash, reset, overwrite or worktree.

### Inputs and scope

Read root and contracts `AGENTS.md`; this hub's spec, brief, tasks, evaluation, status and earned
contracts handoff; `.claude/context/{ontology,product,codebase-architecture,testing,validation-pipeline}.md`;
and the existing Commitment Pooling member-funded claims brief, contract spec and settlement spec.
Use pragmatic-programming, domain-driven-design, and the repository planning workflow. Inspect
current code and callers before choosing interfaces. At implementation start, inspect the
`node scripts/harness/plan-hub.mjs linear-sync --feature cosmo-local-credit-interop --json`
manifest read-only and verify relevant existing records when accessible. No Linear writes or
sync-confirmation claim is authorized by this prompt.

Limit this dispatch to contract behavior, meaningful tests, necessary contract artifacts and
the owning planning/handoff updates. Record the dependent Indexer, Shared and app work without
implementing those later slices. Do not report an app checkout or membership activation as complete.

The acceptance story is a gardener earning rewards for a course requested by Garden A, then
spending their own G$ on an AI membership offered by Green Goods or a service offered by Garden B.
Also prove the independent voucher-redemption route. Use fictional service terms and local accounts;
actual issuer approval, capacity, prices, remedies and live accounts remain release prerequisites.

### Architecture to implement

1. **Retain earned rewards.** Preserve the existing local VoucherEntitlementModule, GnosisVoucherAdapter,
   authenticated v1 messages, exact-revision consent, real recognition allocation, finite reserve
   allowance, atomic distribution, durable execution results and independent acknowledgment recovery.
   One fulfilled commitment can reward vouchers and G$ independently. Any legitimate core Fulfilled
   remains eligible for earned distribution; it is not proof of holder-approved service discharge.
2. **Enable opted-in service offers across gardens.** Plan and implement only the narrow additive
   CommitmentPooling changes needed for approval-gated Individual Offers to accept an eligible member
   of another garden without provider-garden membership. Cover ordinary garden and protocol pools.
   Provider stewards approve service requests; buyer-garden stewards retain their own funding authority.
   Preserve provider/contributor membership, Request and institutional Garden claims, non-transferable
   registry identity, Hats roles, recognition, and default behavior of legacy offers. Bind exact
   preacceptance purchase terms and payment mode; do not broadly relax every claim gate.
3. **Separate funder and settlement account.** The gardener is the personal buyer/funder and service
   recipient. Their selected `buyerGarden` remains the core `payerGarden`; its registered Celo Safe
   is the custodian and settlement source. The actual offer garden is `providerGarden`. No implicit
   treasury subsidy, provider-Safe substitution, or membership fabrication. Missing buyer-garden
   settlement setup blocks this route. Sponsorship and institutional purchases keep separate semantics.
4. **Extend existing funding at its owner.** Reuse SettlementModule and SettlementFundingLib with
   explicit versioned/opt-in personal-purchase records. Bind source chain/module/commitment, terms
   revision, buyer, recipient, both gardens, canonical Celo G$, price, custody Safe and refund account
   to a stable purchase identity independent of retry IDs. Preserve legacy records unchanged.
   Close the current assumption that funding.garden must be the offer pool's garden. Freeze consent
   before payment; repricing or changed parties cannot silently retarget deposited funds.
5. **Keep every G$ transfer on Celo.** The buyer explicitly transfers personal funds into their own
   garden's existing Safe. Initially keep steward-verified deposits: verify actual canonical token
   transfer receipt, authorized depositing account, actual received amount and unique transaction/log
   reference against the purchase before recording. Do not treat balance changes or supplied hashes
   as proof. Preserve token fee handling and disclose gross amount/excess before signing. No bridge,
   minting, new Celo escrow vault or automatic wallet pull. Safe earmarks remain accounting, not locks.
6. **Enforce funding and outcomes.** Intended order: request, bound terms/funding pledge, deposit
   verification, provider acceptance, buyer-garden funding consumption, service delivery and settlement.
   Keep dependency direction settlement -> pooling. Acceptance alone cannot authorize a personal
   purchase payout. Every relevant plan/finalize/dispatch entry point must reject absent, mismatched,
   refunded or unconsumed funding for the new mode, including legacy-entry-point bypass attempts.
   After fulfillment, reuse the existing provider payout allocation and zero payer retention across
   gardens; do not redirect contributor payments to a provider Safe by assumption. Refund the bound
   buyer account using the existing Celo rail when eligible. Prove payout/refund mutual exclusion,
   particularly acceptance-before-consumption and delayed/reordered command and result cases.
   Preserve exact recorded-deposit refunds on non-delivery and disclosed garden top-up treatment
   of successful excess. Initial G$ orders have full settlement or eligible full refund; no partial
   G$ settlement or automatic renewal. Insufficient Safe funds remain recoverable and visible.
7. **Add voucher service escrow.** Bind holder, issuer, token, existing service commitment, accepted
   terms revision and quantities. Reuse the core promise lifecycle with scoped cross-garden consumer
   eligibility; do not create another promise registry or a G$ obligation for a voucher-only service.
   Hold vouchers on Gnosis. Release only explicitly holder-approved delivered units to the issuer
   reserve for reuse within budget. Return undelivered units under agreed remedy rules; never burn
   automatically. Track partial quantities with conservation and once-only release/return. Generic
   Fulfilled, a purchase receipt and a timeout are each insufficient as holder approval. Define
   membership activation/access-period units in the service terms without pretending contracts
   automatically provision a real external membership.
8. **Authenticate and recover.** Use separate typed redemption commands/results and stable business
   identities. Authenticate source/destination peers, chain, version and payload; reject attached
   token bridging. Keep economic execution durable if acknowledgment fails, retry acknowledgments
   without moving value again, and prevent stale failures replacing success. Apply pause, fee-budget,
   replay and upgrade controls consistent with the existing integration. Keep completed reward
   messages and service-redemption authority distinct; the reserve-distribution adapter gains no
   pool-withdrawal, limiter or token-minting authority.

The earlier “core and G$ contracts unchanged” rule applies to the earned slice, not this newly
dispatched personal-purchase extension. The planned upgrades are narrow CommitmentPooling
eligibility/terms and SettlementModule funding/outcome changes. Reuse CommitmentRegistry, Hats,
canonical G$, Celo Safes and executor transport. Before coding, write the exact ABI/storage/event
delta and compatibility strategy in the owning handoff. If a new custody model, broader role change
or executor redesign is actually necessary, present that concrete scope conflict rather than
silently expanding the architecture.

### Exclusions

- No G$-to-voucher purchase integration or mixed G$/voucher checkout. Each accepted service promise
  selects one payment route; a G$ purchase neither creates nor redeems a voucher.
- Direct Gnosis SwapPool purchases remain a separate slice. Their WXDAI asset is rehearsal-only;
  preserve minimum output/deadline, named recipient and no duplicate issuance requirements.
- No generic multiasset settlement framework, fiat receipt verification, global exchange-rate
  table, multihop execution, lending or changes to yield/certificate behavior.
- No dependencies installed/upgraded, release flags enabled, live deployment, fund transfer,
  authority change, external write, commit, push or PR. Leave the work local and uncommitted.
- Preserve existing release gates. This prompt does not waive audit, account readiness, governance,
  timelock, testnet, rollback or human release authorization requirements.

### Method and completion evidence

Inspect the closest implementations and produce a concise ordered plan, then proceed within the
dispatched scope without reopening these settled product requirements. Complete coherent contracts
steps on the same local branch, with targeted RED/GREEN proof before expanding. Use Bun contract
wrappers only, never raw Forge or `bun test`. Keep the root environment convention and respect
denied secret reads. Do not install missing dependencies as a workaround.

Required proof includes:

- Real Garden A -> Garden B and Garden A -> protocol offer paths, plus same-garden/legacy regression;
  buyer membership revalidation; provider and buyer-garden authority isolation.
- Consent/terms races, missing setup, wrong asset/chain/Safe/funder, net deposit shortfall, duplicate
  deposit references, immutable refunds, competing funded claims and no unfunded treasury fallback.
- Payout/refund exclusivity across acceptance, funding consumption, cancellation, disputes, replays,
  pause, depleted Safe balance and lost/reordered acknowledgments; canonical G$ fees/caps preserved.
- Holder-approved partial voucher service, unapproved/fallback Fulfilled, remedies, repeated releases,
  return-after-release, mixed-route double charge, conservation and acknowledgment recovery.
- Existing earned-voucher invariants, exact storage/event/ABI compatibility and upgrade safety.

Run the repository selector for the actual changed surfaces and retain all critical overrides.
Use mocks for deterministic failure coverage and pinned forks for real token/Safe/interface
conformance; label simulated transport and account stand-ins. Use only published CLC documentation,
hand-written interfaces and deployed bytecode; do not read/import/vendor AGPL implementation source.
Do not claim live CCIP, passkey signing, issuer capacity or external membership activation from mocks.

Update the owning handoff with actual commands/results, identity of tested files, unresolved
dependencies and the compact task/phase record. Preserve existing lane blockers and historical
evidence. A dirty/untracked implementation has working-tree proof, not a commit-attributed receipt.
Stop when this contracts slice and its required checks are complete. Leave Indexer/Shared/app work,
Gnosis purchase swaps, live operation and broader lifecycle completion explicitly outstanding.

## Planning update record — outside the implementation prompt

Task record: personal G$ service access architecture | Type: guidance | Outcome: complete
Agent/model: Codex / exact model unknown | Coverage: 21 October planning amendment only

| Phase | Start → end (UTC) | Result / evidence |
|---|---|---|
| Investigate | 2026-10-21 16:55:30 → unknown | Inspected claim eligibility, funding, payout ownership and the separately authorized swap-slice instruction |
| Verify | unknown → 2026-10-21 17:08:56 | Plan validation, local links, formatting, whitespace and preservation checks below |

Validation observed for this planning edit:

- `bun run scripts/harness/plan-hub.mjs validate`: validated 34 feature hubs.
- `bun node_modules/@biomejs/biome/bin/biome format --write .plans/backlog/cosmo-local-credit-interop/status.json`:
  formatted the one changed JSON file. Used the installed Bun executable directly.
- `git diff --check -- .plans/backlog/cosmo-local-credit-interop`: passed using installed Homebrew Git.
- Local-link and whitespace inspection: all references in six updated/new Markdown documents resolve;
  status JSON parses and its prompt link resolves.
- Snapshot comparison: existing contract source/tests, app settlement flag and earned-slice handoff
  unchanged. All execution lanes, Linear metadata, taxonomy and overall status preserved.

The scoped `bun run check --plan -- --intent qa --changed <seven planning paths>` selected only
formatting but reported `blocked:toolchain.node`. The standard Node wrapper could not access its
managed toolchain under current permissions; the direct installed Biome check above succeeded.
The first Git invocation also hit the inaccessible system xcrun path; installed Homebrew Git
completed the check. No configuration, dependency, permissions or validation policy was changed.
No contract tests were run for this planning-only edit, and no runtime behavior is certified here.

Human corrections: 0 observed in this segment; attention: unknown. This record does not measure
the parallel swap implementation or recertify its evidence. No runtime implementation, branch/index
change, commit or external tracker update was performed by this planning task.
