# Codex handoff — payer identity, recipient rule, and completion (2026-08-08)

You are taking ownership of this workstream. Under plan Decision Log #54 / register #89 you already
own plan/spec, Linear, Mermaid, and final cross-source review; this hands you the implementation
lane as well. Claude Code did the work below and has stopped.

**Do three things, in order:**

1. **Review everything adversarially** (§5).
2. **Write a self-contained new-session prompt** (§6) so this work survives context loss.
3. **Implement your own findings and the remaining work** (§7).

---

## 1. Why this exists

The protocol pool is Green Goods' own commitment pool. Its purpose is two-directional exchange with
the gardens:

- **Requests** — the protocol asks for work that advances the protocol. Garden-scoped asks (running
  an event, a garden-scoped survey) are claimed by the **garden**; individual asks are claimed by a
  **gardener**.
- **Offers** — the protocol provides support sessions, onboarding, and technical help, which
  **gardens claim and pay for** with G$ they earned.

That circulation is the pilot hypothesis. The architecture did not implement it. Settlement bound
the payer to `providerGarden` — the party that *delivered* — which assumes the asker and the doer
are the same account. True in every garden pool, false in the protocol pool, whose entire purpose is
that they differ. Both intended flows inverted: a protocol Request made the *claiming garden* pay
its own gardeners, and a protocol Offer was unpayable in the other direction.

## 2. What changed

**Payer identity (Decision Log #56 / register #90).** Immutable `payerGarden` beside
`providerGarden`. A Request stores `pools[poolId].garden` at creation; an Offer stores the claiming
`gardenContext` at acceptance. Settlement derives `source`/`executorGarden` and payout authority
from `settlementAccounts[payerGarden]`. `providerGarden` keeps EAS recipient scope and the roster
boundary and stops being the payer. Garden-internal commitments resolve both to the same garden, so
single-garden pools are unchanged — that equality is the compatibility guard.

**Recipient rule (Decision Log #57 / register #91).** Who receives follows who claimed:
Request + `ClaimType.Garden` → one recipient, the claiming garden's Celo Safe;
Request + `ClaimType.Individual` → contributor accounts; Offer, either kind → contributors, because
the claimant is the payer. This closes the circulation loop by earning rather than by subsidy.

**Consequences that followed:** `DisbursementKind.GardenBeneficiary` +
`prepareGardenBeneficiaryPayout(planId)`; `gardenRetainedAmount` forced to zero whenever
`payerGarden != providerGarden` or a beneficiary row exists; `GardenClaimRequiresProtocolPool`
rejecting Garden claims in garden pools; `acceptExchange` restricted to barter (both sides free);
`Reward*` → `Consideration*` rename across ABI, specs, ontology, and read-model identifiers.

## 3. Track record — read this before trusting anything below

Two adversarial review rounds have run. **Each overturned a claim Claude Code stated with
confidence.** Treat every assertion in the specs and in §4 as unverified until you check it.

- **Round 1** — REQUEST_CHANGES, six findings. Overturned: "the exchange gap is known and
  deliberate" (it was an exploitable defect: a priced Offer×Offer pair recorded one garden as payer
  for a two-person trade); "`CommitmentCreated` needs no `payerGarden`, it's derivable from
  `poolId`" (false under reverse delivery — no ordering guarantee, no bounded reverse index);
  "`check:ontology` passes" (never run; it was failing); "those two test files were only
  reformatted" (they carry +315/-2 and +106/-13 of another session's work).
- **Round 2** — REQUEST_CHANGES, seven findings. Overturned: "`ClaimType.Garden` is protocol-only
  and steward-only" (**false** — a garden pool's claim branch never inspected `kind`, so the
  recipient rule would have ordered a Safe-to-itself transfer); "no new `DisbursementKind` needed"
  (**false** — no implementable path existed to pay a garden Safe; a 100%-retained plan produces no
  payable row and completes locally, silently stranding the money in the payer Safe); "the recipient
  rule repairs `gardenRetainedAmount`" (it repaired one case of four).

The pattern is asserting architectural properties from reading adjacent code rather than executing
the check. Verify by running things.

## 4. Current state

**Built and tested** (pooling module, pre-deploy — no pooling address in `42161-latest.json`):

- `src/interfaces/ICommitmentPoolingModule.sol` — `payerGarden` on `Commitment`; `payerGarden`
  trailing on `CommitmentCreated` and `CommitmentAccepted`; consideration rename; new errors
  `ExchangeConsiderationUnsupported`, `GardenClaimRequiresProtocolPool`.
- `src/lib/CommitmentPooling/` — `CreationLib` (Request payer at creation), `AcceptanceLib` (Offer
  payer at acceptance; garden-pool Garden-claim rejection), `CreationChecksLib` (Garden-claim
  creation gate), `ExchangeLib` (barter-only), `TermsLib` (`recordConsiderationPaid` beneficiary
  follows the recipient rule).
- `test/unit/CommitmentPoolingPayer.t.sol` — NEW, 14 tests. `CommitmentPoolingExchange.t.sol` — 3
  added.

**Specified only — no implementation exists.** `SettlementModule` and `CeloSettlementExecutor` do
not exist in `src/`. Everything in `settlement-spec.md` is an implementation plan: the payer
binding, `GardenBeneficiary`, the retention constraint, and the recipient derivation are all
unbuilt and untested.

**Documents touched:** `plan.todo.md` (Decision Log #56/#57, registers #90/#91),
`reports/corrections-log.md` (three dated dispositions), `contract-spec.md`, `settlement-spec.md`,
`acceptance-matrix.md`, `diagrams.md`, `architecture-closure-matrices.md` + validator,
`uiux-spec.md`, `wireframes.md`, `prototypes.md`, `status.json`, eight handoffs, `hifi/*.ts`,
`visual-assets.md`, `packages/shared/src/ontology/green-goods-ontology.json` + regenerated docs,
and `artifacts/visuals/synthesis-circular-gd.svg/.png`.

**Gates, all currently green:**

```
cd packages/contracts && bun run test          # 1,816 Solidity + 100 script
cd packages/contracts && bun run check:sizes   # module 21,205 / margin 3,371
cd packages/contracts && bun run check:storage-layout
cd packages/contracts && bun run lint
bun .plans/active/commitment-pooling/architecture-closure.validate.ts
bun run check:ontology
bun run format:check && git diff --check
bun .plans/active/commitment-pooling/hifi/validate.ts
```

Note from round 2: the closure validator passed while `status.json` still described the superseded
provider-pays model. It does not prove semantic closure.

## 5. Task 1 — adversarial review

Find what is wrong. Report severity-ordered with file:line anchors. Priorities:

1. **`GardenBeneficiary` interactions.** Batching homogeneity, dispatch rechecks, cancel/requeue,
   acknowledgment, and the `executionKey` domain. Does a beneficiary child behave correctly
   everywhere a `ContributorReward` child does? Is `gardenerDeliveryEnabled` genuinely irrelevant
   to it?
2. **The retention-zero constraint.** Walk every `direction` × `claimType` × pool-type combination
   and find one it breaks or fails to cover. Does conservation still hold for the beneficiary
   shape? What happens to a plan edited from one shape into another?
3. **Is the recipient rule complete?** Specifically: a Garden-claimed Request whose claiming garden
   has no active settlement account; a Garden-claimed Offer in the protocol pool; anything reaching
   the rule with `payerGarden == address(0)`.
4. **The Garden-claim rejection.** Creation gate plus acceptance gate — is there a third path in
   (series, exchange, dispute resolution, a backfilled pool) that reaches acceptance with
   `kind == Garden` in a garden pool?
5. **Rename completeness.** Any surviving `Reward*` outside deliberate historical references, and
   whether `DisbursementKind.ContributorReward` should also move now that a sibling kind exists.
6. **Indexer coverage.** `payerGarden`/`payerGardenId`, the `GardenBeneficiary` disbursement, and
   the derived flow direction that replaces the flow-type tag §11 said was missing.

## 6. Task 2 — write the new-session prompt

Produce `reports/codex-payer-session-prompt-2026-08-08.md`: a self-contained prompt that lets a
fresh Codex session with no history carry this to completion. It must stand alone — assume the
reader has never seen this conversation. Include: the architecture and why it changed; the two
overturned-claim rounds as a warning about unverified assertions; the built-vs-specified boundary;
the exact gate commands; the scope boundaries in §8; the open questions in §9; and your own review
findings with their disposition. Do not simply link this file — restate what matters.

## 7. Task 3 — implement

1. Everything your review surfaces.
2. **Linear** (deliberately untouched, do it after the review): a successor issue superseding
   PRD-759 (Done — comment, do not rewrite a Done description); a comment on PRD-796 recording the
   scoped ABI-freeze exception; an amendment block plus a reset due date on PRD-686 (overdue,
   2026-08-04); close PRD-734 recording that GoodDollar confirmed and want to see circulation; and
   notes on PRD-721/722/723/724/725 for the `payerGarden` field, the consideration rename, the
   `GardenBeneficiary` kind, and the recipient rule.
3. **Google Doc change list** — the human applies it. Produce a precise list of what to change and
   where. The embedded `synthesis-circular-gd` PNG is stale (the Doc still has the 2026-08-04
   render) and must be re-uploaded by hand; images do not paste over MCP. **Do not edit the Doc.**
4. Anything in §9 you can close.

## 8. Scope boundaries and hazards

- **This repo runs concurrent agents.** Stash unknown diffs, never revert them. Two files in the
  working tree are another session's in-flight work and must be **excluded from this change's
  commit boundary**: `test/fork/ArbitrumCommitmentPooling.t.sol` (+315/-2) and
  `test/unit/CommitmentSchemaRecovery.t.sol` (+106/-13). Both were verified to contain no
  payer/consideration/recipient references. Untracked `script/deploy/commitment-schemas.test.ts`
  and `test/unit/NetworkSelectors.t.sol` are likewise theirs.
- **Immutable archives.** `reports/linear/**` are payloads of what was actually written to Linear on
  given dates; dated `reports/*-2026-*.md` are dated records. Do not edit either. Corrections belong
  in `corrections-log.md`. The living Decision Log in `plan.todo.md` *was* swept by the rename, and
  both reviews judged that acceptable.
- **Size discipline.** Decision Log #55: every future selector lands its weight in a library, never
  the module shell. Current margin is 3,371 bytes.
- **hifi UI copy** deliberately keeps "reward"/"support" wording — that is presentation vocabulary
  governed by `glossary-community.md`, not the ABI. Read-model identifiers were renamed.
- **Do not deploy or broadcast anything.**

## 9. Known open questions

- `gardenRetainedAmount` may deserve deletion rather than constraint. It is now zero in every case
  except garden-internal; a single-purpose field that is usually forced to zero is a smell.
- Whether `DisbursementKind.ContributorReward` should be renamed now that `GardenBeneficiary`
  exists and the promise-side vocabulary moved to "consideration".
- Fork tests could not be certified in round 2 — a pre-existing missing
  `HATS_MODULE_UPGRADE_FORK_BLOCK_NUMBER`. Unrelated to this change; confirm and record.
- The circulation metrics in `settlement-spec.md` §11 still depend on Celo-side observation outside
  the Envio boundary. The recipient rule closes the protocol↔garden leg only.
- `visual-assets.md` says the Google Doc still embeds the 2026-08-04 render. Confirm before the next
  partner read.
