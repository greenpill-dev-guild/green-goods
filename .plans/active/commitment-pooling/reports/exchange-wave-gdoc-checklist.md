# Commitment Pooling: Exchange-Wave Google Doc Reconciliation Checklist

**Date**: 2026-08-01  
**Mode**: one human pass in the canonical Google Doc  
**Boundary**: the repository does not mirror the document's prose

## Verification pass 2026-08-02 — prose complete, images outstanding

The canonical Google Doc was read end to end (62,905 characters, `modifiedTime`
2026-08-02T03:35Z) and checked item by item against this list. **Every prose delta below had
already been applied**; the document's own header now reads "Last aligned August 1, 2026 ·
exchange wave applied". The boxes were ticked here to close the drift between this file and the
document — the work was done in the doc first, not by this pass.

Two items landed in a different shape than specified, both acceptable, neither needing rework:

- **Six-functions crosswalk** — delivered as a bulleted `GE term — Green Goods mechanism — stage`
  list under "The six protocol functions", not a three-column table. The intent held: the
  explanation no longer depends on the image.
- **`ICommitmentRegistry`** — absent from the document. Correct: it is an interface name with no
  external-facing meaning. The three names that do appear (`CommitmentRegistry`, `CreditRegistry`,
  `TestimonyResolver`) are aligned, and `communityTestimony` is unchanged.

One item is only **partially** confirmed and still wants a human eye — see its box below.

**What actually remains: the tab 02 image placements**, tracked in `visual-assets.md` § Asset
status. They are a manual step and are not blocked by anything in this list.

## Exchange-wave deltas

- [x] State that the August contract scope now includes atomic bilateral paired acceptance through
  `acceptExchange(uint256)` for two counter-referenced Offer×Offer commitments.
- [x] Replace the old “commitment-for-commitment swaps are not claimed” sentence with: **“No
  transferable-voucher or multilateral swaps; bilateral paired acceptance is in the August
  contract scope.”** Keep the distinction between paired acceptance and transferable exchange.
- [x] Upgrade the six-functions exchange row from a reference-only record to **reference record +
  bilateral atomic acceptance in the approved August contract scope; multilateral and
  transferable exchange remains later**. Do not label the bilateral rung shipped until the
  contract lane lands and is verified.
- [x] Add the design-only exchange-architecture brief pointer:
  `.plans/active/commitment-pooling/exchange-architecture-brief.md`. State that it authorizes no
  implementation and that PRD-651 stays gated.
- [x] Add the approved August app-roadmap additions: exchange-pair UX, Offer-template library,
  and the noun-reduction/plain-language pass. Keep shipped, roadmap, and later-scope labels visible.

## Held-over narrative fixes from Will Ruddick's review

- [x] Add a “what the pool changes” passage answering what changes for everyone else when a
  commitment is accepted, fulfilled, cancelled, expires, or breaks: provider slots, class quotas,
  cycle-close coupling, the allocation snapshot, and `promiseKeptRate`.
- [x] Reorder **Start Here** so it leads with pooled promises, shared limits, and shared memory;
  evidence rails follow as support for that model.
- [x] Replace the image-dependent six-functions explanation with a text crosswalk table:
  **GE term ↔ Green Goods mechanism ↔ stage**.
- [x] Add “reciprocity across cycles”: rotation → standing → credit → voucher seam, the anti-score
  rationale, and the pilot's observational reciprocity question from `pilot-evidence-spec.md` §3.
- [x] Add the reseed/return-leg question to **Open questions that remain real**.

## Review-pass alignment additions

- [~] **Partially confirmed — needs a human eye.** Use the D12 three-tier funding-route statement wherever the protocol-to-garden route appears:
  the architecture ships in this release's build scope; value movement is separately
  evidence-gated and human-authorized; the upstream House of Alignment → protocol-Safe stream is
  a partner-side fact Green Goods reports, never a route Green Goods builds or queues.
- [x] Replace “competing claimants” framing wherever claims are described. A claim chooses one
  accountable lead provider. Contributors join the accepted commitment through its Open or
  LeadManaged roster policy and never claim. If two would-be leads request the same promise, the
  steward accepts one and explicitly Declines or Supersedes the other with a stored reason.
- [x] Apply the contract naming alignment everywhere the document names contracts:
  `CommitmentRegistry`, `ICommitmentRegistry`, `CreditRegistry`, and `TestimonyResolver`.
  Keep the schema config key and schema name `communityTestimony` unchanged.
- [x] Wherever member delivery is described, add: contributors receive at same-address
  counterfactual smart accounts on Celo, gated by `gardenerDeliveryEnabled`; that flag flips only
  after the recorded Celo AA/paymaster exit evidence. If the Kernel-version spike fails,
  protocol→garden continues while member delivery stays blocked.

## One-pass verification

- [x] Search the entire Google Doc for the retired contract names and update every living mention.
- [x] Search for reference-only exchange language and confirm the August bilateral rung is present.
- [x] Confirm no gardener-facing copy uses market-first framing; use “in exchange for.”
- [ ] Re-read each changed section in place and confirm the document reports **Saved to Drive**. *(Not verifiable from the repo side — this is a human confirmation in the document UI. The 2026-08-02 pass read the saved content via the Drive API, which cannot observe the editor's save indicator.)*
- [x] Record the pass date and unresolved partner questions without editing repo history.
