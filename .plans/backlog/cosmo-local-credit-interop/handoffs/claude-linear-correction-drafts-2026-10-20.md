# Linear correction drafts for the accepted PRD-1315 candidate

**Drafted:** 2026-10-20 UTC, after Afo accepted the no-core-upgrade boundary from the
[second-pass review](claude-architecture-review-results.md) as the PRD-1315 candidate.
**Status:** approved by Afo and applied to Linear on 2026-10-20 between 06:35 and 06:37 UTC as
anchored patch edits (one retitle, thirteen description edits, three comments); the texts below
are the applied texts. Every record kept its state (the roadmap records Backlog; RESR-73 In
Progress; PRD-857 and PRD-1096 Todo; PRD-651 Backlog; PRD-796 Done), assignee, cycle, due date
and milestone; the read-back is recorded in the closing handoff. The optional new issue in
section 2 was not filed. One wording error found afterwards is noted under PRD-1317; its Linear
fix awaits Afo's approval.
**Companion edits:** the hub documents in this folder's parent were edited the same day
(`architecture-alignment.md`, `commitment-upgrade-plan.md`, `spec.md`, `brief.md`, `eval.md`,
`plan.todo.md`, `status.json`, `handoffs/README.md`); the Linear texts below mirror them.
**Writing rules applied:** plain prose, problem first, Done-when bullets, no em dashes, US
spelling, no bold spans inside Linear bodies (the MCP mangles them). Repository links point at
the hub paths; replace with the committed branch URL once the hub is committed.

## 1. What changed and why

The first pass proposed a narrow CommitmentPooling upgrade. The review showed the existing core
views already give a voucher module the pre-acceptance window, the parties, the terminal Fulfilled
state and the canonical recognition vector, and that the G$ rail itself pays on Fulfilled alone.
So the accepted candidate is: a new Arbitrum voucher entitlement module, a new Gnosis issuer
adapter, reused CLC implementations through the published factory, the G$ rail untouched, and no
core upgrade. Two secondary changes: the issuer's budget should be a token-enforced ERC20
allowance from the issuer's reserve (proposed default; writer role with cap is the alternative),
and the adapter writes no pool limits. Two facts were established read-only on 20 October: the
four first-slice Gnosis implementations match the published v1.0.0 build artifacts, and both CCIP
routers quote the settlement codec's extra-args form.

Decisions that remain with Afo (keep them visible in RESR-73 and PRD-1315):

1. Eligibility rule: any Fulfilled commitment (G$ precedent, no core change) or ordinary
   confirmation only (needs a core change or an issuer attestation).
2. Issuer budget mechanism: allowance from the issuer's reserve, or writer role with adapter cap.
3. Allocation basis: recognition split per contributor, or a single recipient.
4. Purchased issuance in this slice, and the PRD-796 framing (issuer instrument outside the wrap
   boundary, or a recorded supersession of fulfilled-first ordering).
5. Acknowledgment lane in v1: on-chain acknowledgments, or indexer-joined pending state.
6. Gnosis member accounts: ask ZeroDev to deploy the passkey validator, replay the init code
   through the deterministic deployer, or accept delivery-only in October.
7. Who holds the Gnosis proxy admin role (timelock delay and Safe signers).

## 2. Per-record drafts

### RESR-73 (Research, In Progress): add a comment, keep the description

Comment text:

> Second-pass architecture review complete on 20 October. It challenged the first pass against
> the CLC v1.1.0 documentation, the pinned README, SPEC and DEPLOY, the current contracts and the
> live Linear records. Conclusion: the voucher-plus-G$ intent with terms bound at acceptance is
> enforceable without a CommitmentPooling upgrade. The core already exposes the pre-acceptance
> window and the Fulfilled state through getCommitment, and the G$ settlement plan pays on that
> state alone, so a voucher module can bind terms before acceptance with the core's own rule and
> issue on the same gate. Afo accepted that boundary the same day as the PRD-1315 candidate.
>
> Also established, read-only: the deployed Gnosis GiftableToken, SwapPool, Limiter and
> ERC1967Factory implementations match the published v1.0.0 build artifacts byte for byte (the
> v1.1.0 tag differs only by OracleRelay); both CCIP routers quote the settlement codec's
> EVMExtraArgsV1 form, on OnRamp 2.0.0 lanes behind Router 1.2.0. The metadata records solc
> 0.8.34, not the README's 0.8.36.
>
> Remaining decisions before PRD-1315 can freeze: eligibility rule, issuer budget mechanism
> (allowance from the issuer reserve is proposed), allocation basis, purchased issuance and its
> PRD-796 framing, acknowledgment lane in v1, Gnosis member accounts (the WebAuthn validator has
> no code on chain 100, 10 October read), and Gnosis proxy admin ownership.
>
> Sources: the hub files handoffs/claude-architecture-review-results.md and
> handoffs/claude-conformance-evidence-2026-10-20.md in .plans/backlog/cosmo-local-credit-interop.

### PRD-1315 (Backlog): replace the description

> Freeze the implementation boundary after RESR-73 research, Claude's review and Afo's decision.
> The accepted product behavior is one commitment receiving vouchers and G$, with both terms
> agreed at acceptance; the earlier G$ installment scope is superseded. On 20 October Afo accepted
> the candidate: a new Arbitrum voucher entitlement module and a new Gnosis issuer adapter, reused
> CLC implementations, the G$ rail unchanged, and no CommitmentPooling upgrade. The module reads
> the existing commitment views, registers voucher terms only while the commitment is Offered or
> Requested, and issues only on Fulfilled.
>
> Done when
>
> * The remaining decisions are recorded: eligibility rule (any Fulfilled, or ordinary
>   confirmation only through attestation), issuer budget mechanism (allowance from the issuer's
>   reserve is proposed; writer role with cap is the alternative), allocation basis (recognition
>   split or single recipient), purchased issuance in this slice and its PRD-796 framing,
>   acknowledgment lane in v1, Gnosis member accounts, and Gnosis proxy admin ownership.
> * Exact interfaces for the two new contracts are specified: entitlement id derived from chain,
>   module, commitment and terms revision (never supplied, independent of attempt), per-asset
>   rounding and conservation, duplicate and retry rules, and legacy treatment (no implicit
>   entitlement for existing commitments).
> * Protocol version and transport evidence from 20 October is cited and scheduled for a re-read
>   at the deployment block. A core upgrade is out of scope unless the eligibility decision
>   requires a stored fulfillment path; implementation needs separate dispatch.

### PRD-1316 (Backlog): retitle and replace the description, keep the id

Proposed title: Confirm the core views suffice for voucher terms and eligibility

> The first pass planned a CommitmentPooling upgrade to expose accepted voucher terms and a
> fulfillment getter. The review found the existing views sufficient for the accepted boundary.
> This task proves that and specifies the core change only if a later decision needs it.
>
> Done when
>
> * A test shows a contract caller can read state, parties, payer garden and the canonical
>   recognition vector for live-shaped commitments through getCommitment, isEligibleContributor and
>   validateRecognitionSnapshot, including dispute-resolved fulfillment and legacy records.
> * The voucher module's terms window is specified as the core's own rule: writable only while the
>   commitment is Offered or Requested, frozen afterward, with an explicit award kind for any
>   post-acceptance registration that PRD-1315 allows.
> * If and only if the eligibility decision requires on-chain confirmation-path checks, a separate
>   critical-tier upgrade specification names the stored fulfillment record, its storage slot,
>   the affected libraries and the fork proof. Otherwise this task closes with the test above.

### PRD-1317 (Backlog): replace the description

> Create the Arbitrum voucher entitlement module so a commitment can promise vouchers at
> acceptance and receive them after fulfillment, alongside its existing G$ consideration. No core
> upgrade: the module reads the commitment views.
>
> Done when
>
> * A payer-garden steward registers voucher terms (issuer garden, asset, units, allocation
>   policy, terms CID, season) only while the commitment is Offered or Requested; the issuer
>   garden's steward approves the budget; the entitlement id is derived from chain, module,
>   commitment and terms revision and is never supplied; garden authority alone cannot spend
>   another issuer's vouchers.
> * Issuance is allowed only on state Fulfilled, allocated through validateRecognitionSnapshot
>   and a deterministic remainder rule (or to a single recipient if PRD-1315 chooses that), with
>   every amount conserved per asset.
> * Dispatch is data-only over CCIP with a stored payload, fee reserve floor, retry of the same
>   bytes while unacknowledged, authenticated acknowledgments and a stranded-subject close-out,
>   modeled on the settlement lane. Outcomes are recorded independently of G$ settlement, and the
>   existing payout plan and funding rules are untouched.

**Correction found after application (20 October, not yet in Linear).** The first bullet names
the wrong terms author. An Offer has no payer garden until acceptance, and the core rule lets
only a steward of the pool's garden edit terms before acceptance
(`CommitmentPoolingTermsLib._requireEditableTerms`). Proposed fix, for Afo's approval: replace
"A payer-garden steward registers voucher terms" with "A steward of the pool's garden registers
voucher terms". Nothing else in the record changes.

### PRD-1318 (Backlog): replace the description

> Deliver authorized voucher entitlements on Gnosis through a restricted adapter that uses the
> selected CLC token implementation. The adapter is owned by the issuer's Safe, holds an ERC20
> allowance from the issuer's reserve (proposed default) or a writer role with a cap (alternative),
> and has no pool or limiter authority.
>
> Done when
>
> * The adapter authenticates transport, source chain selector, peer (with a grace window) and
>   protocol version, refuses token transfers, dedupes by execution key and by entitlement id, and
>   consumes an entitlement only on success so a stored failure can be retried after repair.
> * Delivery is transferFrom the issuer's reserve within the allowance (or mintTo as a writer if
>   chosen), the result is stored before any acknowledgment, acknowledgments defer with explicit
>   codes and can be retried sponsored or caller-funded, and the adapter can be paused.
> * Tests cover unauthorized source, sender and version; replayed message; new message with a
>   consumed entitlement; exhausted allowance or cap; expired deadline; lost acknowledgment; and
>   a Safe-initiated fallback call under the same bounds.

### PRD-1319 (Backlog): edit the Done-when bullets

Replace the first bullet with:

> * Cite the 20 October read-only evidence (deployed GiftableToken, SwapPool, Limiter and
>   ERC1967Factory code equals the published v1.0.0 artifacts; both routers quote the codec's
>   extra-args form) and re-run both reads at the deployment block; extend the bytecode check to
>   the fee policy, index and quoter implementations if they are used.

Replace the second bullet with:

> * Prove the two new contracts' storage, ABI and size, and their deployment and rollback on a
>   dated fork. No core storage proof is needed unless PRD-1315 selects a stored fulfillment path.

Keep the third bullet (G$ plans, allocations, retention, funding and routes preserved; independent
voucher and G$ completion; per-asset conservation).

### PRD-1320 (Backlog): add two bullets

> * Add chain 100 to the indexer configuration with the adapter, issuer token and pool addresses,
>   and new entities for entitlements, deliveries and receipts keyed chainId-id; existing
>   Commitment and settlement entities keep their meaning.
> * Land the new vocabularies (entitlement kind, delivery status, failure code) in the ontology
>   sidecar and projections in the same change, so the ontology gate passes.

### PRD-1321 and PRD-1322 (Backlog): add one bullet each

PRD-1321:

> * Add chain 100 to Shared's chain registry without the silent Sepolia fallback, to the Pimlico
>   endpoints, the settlement account profiles and the deployed-chain list, and expose
>   per-obligation readers (work fulfilled, G$ outcome, voucher delivered, service later).

PRD-1322:

> * Voucher actions reuse the existing signing and queue patterns; the gardener's Gnosis account
>   is verified separately, and the passkey validator gap on chain 100 is recorded as a blocker
>   for member-signed Gnosis actions until it is resolved.

### PRD-1325 (Backlog): edit the first bullet

> * Add the gnosis network entry (router 0x4aAD6071085df840abD9Baf1697d5D5992bDadce, selector
>   465200170687744372 as a string, chain 100) and a 100-latest artifact; create the token, pool,
>   limiter, fee policy, index and quoter proxies through the published Solady factory with the
>   admin different from the owner (timelock or second principal), using a repository-owned wrapper
>   rather than upstream scripts; wire the allowance (or writer) and seal registry and limiter bits
>   after wiring. No Arbitrum upgrade target.

### PRD-1326 (Backlog): add rows to the second bullet

> * Also cover delivery to a counterfactual member account that has no code on Gnosis, a labeled
>   stand-in for the missing passkey validator (vm.etch of the Arbitrum bytecode, never presented
>   as live), and a Safe fallback call under the same bounds.

### PRD-1327 (Backlog): edit the first bullet

> * Pin the two new contracts, their dependencies, the selected CLC implementation addresses with
>   the 20 October conformance evidence re-run at the deployment block, the authority graph, the
>   accepted economic rules and the message and receipt boundaries. No core storage diff unless
>   PRD-1315 selected a stored fulfillment path.

### PRD-857 (Todo): two sentence edits in the description

Replace "Arbitrum Hats authorize message-only issuance and limit changes; the Gnosis issuer checks
the sender, consumes a unique entitlement once and enforces a season cap. It can write the token
and limiter but cannot withdraw pool funds." with:

> Arbitrum Hats authorize message-only issuance; the Gnosis adapter checks the sender, consumes a
> unique entitlement once and delivers within the issuer's allowance (or a season cap if the writer
> model is chosen). It holds no limiter or pool authority and cannot withdraw pool funds.

Replace "The corrected architecture plan and PRD-1315 gate the exact contract boundary after
RESR-73 and Claude review." with:

> Claude's review (20 October) recommended, and Afo accepted, no CommitmentPooling upgrade;
> PRD-1315 freezes the remaining decisions.

### PRD-1096 (Todo): one bullet edit and one addition

In the first bullet replace "only authorized senders can change caps or limits" with "no limit
changes cross chains in the first slice; caps and allowances are the issuer's".

Add after the second bullet:

> * A passkey gardener account cannot deploy on Gnosis until the WebAuthn validator exists there
>   (10 October read). Rehearse with a labeled stand-in and record the live gap; a go on
>   22 October for member-signed Gnosis actions needs that deployment or a Safe-signed fallback.

### PRD-651 (Backlog) and PRD-796 (Done): one comment on each

> The 20 October architecture decision adds no voucher ABI, event, storage or custody to
> CommitmentPooling, so the frozen compatibility boundary holds. Issuer vouchers in the Cosmo-Local
> slice are third-party instruments, not wraps of Green Goods promises; the entitlement module
> consumes fulfillment facts once. Whether purchased (capacity-backed) issuance enters the slice,
> and how it is framed against the fulfilled-first ordering, is a pending decision in PRD-1315.

### Optional new issue (decision 20 October: not filed; the gap stays tracked inside PRD-1096 and PRD-1322)

Team: Product. Title: Make passkey member accounts usable on Gnosis

> The Kernel WebAuthn validator the app installs has no code on chain 100, so a passkey member
> account derives to the same address on Gnosis but cannot deploy or sign there (10 October
> read). Vouchers can be delivered to the address; swaps and presentments cannot run from it.
>
> Done when
>
> * One path is chosen and executed with its trust implications recorded: ZeroDev deploys its
>   canonical validator on Gnosis; the MIT init code is replayed through the deterministic
>   deployer to the same address; or delivery-only is accepted for members in October.
> * A simulated createAccount with the app's passkey init data succeeds on Gnosis, and Pimlico
>   sponsorship for chain 100 is confirmed and funded.
> * PRD-1096, PRD-1322 and PRD-1324 cite the outcome.

A search for "validator Gnosis" on 20 October returned only the parent records. Afo decided the same
day not to file a separate issue: PRD-1096 and PRD-1322 carry the validator gap in their Done-when
bullets, so the text above stays here as a record only.

## 3. How to apply, once approved

1. Commit the hub on one branch first (the planning working tree still holds uncommitted copies,
   and PR #1068 holds the 10 October research record), so the Linear links can point at a stable
   path.
2. Apply the record edits in the order above, keeping states, assignees, cycles, due dates and
   milestones. Use plain text for bodies; verify with a read-back.
3. Record decisions 1 to 7 as they are taken, in RESR-73 first and PRD-1315 second, so PRD-1315
   can freeze without a second rewrite.
