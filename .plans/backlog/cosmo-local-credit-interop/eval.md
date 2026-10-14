# Cosmo-Local Credit Voucher Interoperability — Evaluation Plan

**Posture**: no implementation authorized. These gates describe what each slice must prove *if and
when* it is dispatched.

## Slice Gates

Each slice has an exit condition that must be met before the next may be scoped. They are not
schedule milestones.

| Slice | Gate |
|---|---|
| 0 — Due diligence | Live CLC configuration read and recorded; `burn`-after-expiry settled on a fork; §10 questions answered; pool ownership established; documented go / no-go on network membership |
| 1 — Interfaces + read bridgehead | Green Goods renders live CLC pool state. Zero writes, zero custody. No AGPL source in the tree |
| 2 — `ValuationPolicy` + voice | A garden declares, publishes and freezes a weighted valuation; gardeners see it before committing and register alignment or dissent; layer-1 hour records provably unchanged by any layer-2 revision |
| 3 — Pool passport | An external party inspects a Green Goods pool with their own tools; every fulfilment figure traces to counterparty confirmations on Arbitrum; no address enumeration on public surfaces |
| 4 — Mint authorization | A confirmed Arbitrum contribution produces a weighted Gnosis-native voucher in the contributor's own Gnosis Kernel account; the same facts cannot authorize a second mint |
| 5a — Exchange mechanics | A voucher moves through a third party and is redeemed, with the full path traceable, against our own Chiado deployment of the published CPP implementations or interface-conformant mocks |
| 5b — CLC venue behaviour | Against the live mainnet venue: de-listing with a held balance, rate change mid-flight, limit exhaustion and pool insolvency each produce a defined, surfaced outcome. **Mainnet-only and gate-bound — not provable on a venue we control** |

## Release Gates

1. **Correctness** — weight arithmetic is deterministic and bounded; no double consumption of
   fulfilment facts; a layer-2 revision never mutates a layer-1 record.
2. **Usability** — a gardener understands what their contribution is worth and why before they
   commit; a steward understands what they are freezing.
3. **Regression safety** — `CommitmentRegistry` remains non-transferable with no transfer or
   approval surface; no custody enters `CommitmentPoolingModule`; existing pooling behavior unchanged.
4. **Evidence quality** — research evidence and open assumptions recorded before implementation;
   every external fact re-verified against its primary source at implementation time.
5. **Human judgment** — protected surfaces and maintainer-call decisions named before merge; the
   open decisions in `plan.todo.md` resolved by Afo, not inferred.
6. **Licensing** — no AGPL source read, imported, or vendored; interfaces traceable to
   `docs/SPEC.md`.

## Acceptance Checks

| ID | Behavior Boundary | Check | Owner | Evidence |
|---|---|---|---|---|
| AC-1 | Valuation authoring | Steward sets weights; cycle opens; weights are immutable for the cycle's life | `ui` | |
| AC-2 | See-before-commit | The frozen table is visible on the commit path before a gardener commits | `ui` | |
| AC-3 | Two-sided signal | Align and dissent both record against the cycle policy; aggregate readable; non-binding | `ui` | |
| AC-4 | Layer separation | A revised equivalence table produces a new version; prior hour records byte-identical | `state_api` | |
| AC-5 | CLC read client | Listing, limit, rate, fee and inventory read correctly from live Gnosis state | `state_api` | |
| AC-6 | MCC profile | Profile validates against the MCC field set; freshness bounds present; no address enumeration | `state_api` | |
| AC-7 | Mint authorization | Confirmed contribution → bounded weighted mint; a repeated `messageId` **and** a distinct message reusing a consumed `authorizationId` are both rejected | `contracts` | |
| AC-8 | Cross-chain **garden** identity | On a pinned fork, the Gnosis garden account matches the Arbitrum address **and** its bound `(chainId, tokenContract, tokenId)` tuple, deployed runtime code hash, and owner/Safe topology all match the expected values. Covers garden accounts only — gardener accounts are AC-15 | `contracts` | |
| AC-9 | Non-transferability preserved | `CommitmentRegistry` exposes no transfer or approval function after all changes | `contracts` | |
| AC-10 | Bounded swap only | Every exchange path uses the `minAmountOut` + `deadline` form | `contracts` | |
| AC-11 | Failure modes | De-listing with a held balance, rate change mid-flight, limit exhaustion and pool insolvency each produce a defined, surfaced outcome. Adapter-side handling is provable on a controlled venue; the venue's own behaviour is Slice 5b, mainnet-only | `qa_pass_1` | |
| AC-12 | Regression review | Existing pooling, settlement and credit behavior unchanged | `qa_pass_2` | |
| AC-13 | Credit line traces to evidence | The limit request cites named delivery figures from the pool passport over a stated window, and the citation is recorded. A cap with no evidence input fails this check even if the limit reads back correctly | `state_api` | |
| AC-14 | Per-contributor quantity | Every mint amount traces to a recorded per-contributor quantity. No allocation is inferred by splitting `targetUnits` across contributors | `contracts` | |
| AC-15 | Gardener recipient path | Vouchers for individuals land in the contributor's own Kernel account, never a garden account. Proven on a fork with a multi-contributor commitment | `contracts` | |

## Test Strategy

- **Unit**: weight arithmetic and rounding bounds; double-spend prevention; `ValuationPolicy` freeze
  semantics; interface encode/decode against documented shapes.
- **Integration**: cycle open → weighted authorization → CCIP command → Gnosis mint on forked
  Arbitrum + Chiado; MCC profile assembly from indexer output.
- **Fork**: exact-address GardenAccount derivation on Gnosis; gardener Kernel-account derivation,
  proven separately; `GiftableToken` expiry and burn;
  bounded-swap slippage and deadline; de-listing with a held balance.
- **E2E**: steward authors and freezes → gardener sees → commits → confirmed → voucher appears →
  transfers to a third party → third party redeems.
- **Manual**: locale tone en/es/pt; the contribution ledger reading as a ledger, not a wallet.
- **TDD proof**: RED/GREEN commands and evidence recorded in lane handoffs and summarized in
  `status.json` when lanes are dispatched.

## QA Sequence

### Claude QA Pass 1

Focus on failure modes, UX comprehension of the valuation table, missing requirements, and test
gaps. The motivation-crowding and measurement-capture risks in `spec.md` §10 are QA concerns, not
only design concerns — check whether the surfaces read as recognition or as transaction.

### Codex QA Pass 2

Starts only after `qa_pass_1` passes. Re-run targeted validation; close remaining defects; verify
no AGPL source entered the tree and that every interface is traceable to `docs/SPEC.md`.

## Pilot Evidence Alignment

This work feeds, and does not bypass, `commitment-pooling/pilot-evidence-spec.md`:

- §3 reciprocity — what reciprocal relation remains after fulfilment
- §5 exchange demand — repeated bilateral or multilateral demand, not one-off feature interest
- §6 safeguards — who is disadvantaged by transferability and how repair works without scoring people
- §8 circulation — in-pool use, redemption, reseed, leak and hoarding; **low volume or mixed findings
  are valid evidence**
- §9 privacy — publication rules for event-derived pair and holding data
- §11 the September evidence packet

A pilot that shows all exchange settling bilaterally is a successful evaluation, not a failed one.
