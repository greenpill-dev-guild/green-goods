# Commitment Pooling — Claude Standing-Commitment Artifact Handoff

## Status

- Work unit: canonical prototype + visual asset gallery architecture pass
- Owner: Claude Code
- Current state: ready for artifact work after Afo's 2026-08-02 scope lock
- Linear context: [PRD-789](https://linear.app/greenpill-dev-guild/issue/PRD-789), unblocked after
  the [PRD-788](https://linear.app/greenpill-dev-guild/issue/PRD-788) architecture gate closed
  under PRD-650
- Canonical prototype:
  <https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c>
- Canonical gallery:
  <https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d>
- Exploration input, not authority:
  <https://claude.ai/code/artifact/998342dd-6dd2-4677-a7a3-e429e28cd9cc>

This is artifact work, not runtime product implementation. Preserve concurrent working-tree
changes, stay on the current branch unless Afo explicitly authorizes a branch action, and do not
publish over either canonical artifact until source validation and the review checklist pass.

## Read first

1. `.plans/active/commitment-pooling/standing-commitments-spec.md` — owning architecture
2. `.plans/active/commitment-pooling/uiux-spec.md` Appendix F
3. `.plans/active/commitment-pooling/acceptance-matrix.md` §2.2
4. `.plans/active/commitment-pooling/contract-spec.md` 2026-08-02 amendment
5. Existing `prototypes.md`, `wireframes.md`, `diagrams.md`, `visual-assets.md`, artifact build
   sources, hi-fi fixtures, and their validation scripts
6. The repo design skill, Warm Earth token contract, and current client/admin shipping components

If an older source conflicts with the standing spec, stop and correct the artifact source to the
standing spec. Do not make a new architecture decision inside Fable, a storyboard, a fixture, or
the artifact runtime.

## Locked model

Present two ways of using one product noun while keeping the technical layers distinct:

1. **Offer once** — one ordinary Offer with `commitmentSeriesId == 0`.
2. **Offer over time** — an Offer backed by one pool-scoped internal `CommitmentSeries`.
3. **Saved Offer metadata** — reusable signed offchain, private-by-default input; only unsaved
   drafts may be local-only. It is not a separate product/domain object.
4. **Available place** — one already-created Offered Commitment instance whose provider capacity
   is reserved.
5. **Story** — exact linked-instance history and absolute counts, never a score.

The claim action accepts one pre-created place. It does not spawn an instance. Available count is
the number of currently Offered, capacity-backed linked instances. Offer creation reserves the
slot; Offer acceptance and `acceptExchange` do not reserve again. Requests are not standing
commitments in v1.

Initial series lifecycle is Active, Resting, Retired. Resting blocks new places but changes no
existing instance. Retired is terminal. Co-holder, apprenticeship, handover, fork/adoption, and
community-held stewardship are later concepts only and must have no active v1 control.

Next-cycle default is **Ask me again next cycle**. No automatic obligation creation. “Kept N
times across M cycles” is allowed when exact. Participant counts must be labelled reported
evidence, never inferred protocol data. No score, rate, rank, comparison, cross-pool identity, or
public personal history.

## Required source outputs

- Amend `wireframes.md` with the minimum new low-fi frames and cross-references.
- Amend `prototypes.md` with canonical source journeys, fixtures, action inventory, state coverage,
  and validation expectations.
- Amend `diagrams.md` only where the four-layer model, series/instance relationship, or Offer
  capacity reservation is materially clearer as a diagram.
- Amend `visual-assets.md` and its source asset inventory with the approved new story and
  architecture visuals.
- Update the canonical prototype build source and hi-fi fixtures.
- Update the canonical gallery build source and image assets.
- Keep all asset IDs, frame IDs, and storyboard numbers deterministic; update counts everywhere.
- Record a concise artifact review report with exact commands, rendered states, screenshots, and
  any proof limit.

## Required prototype journeys

At minimum, make these review-visible:

1. Empty **Things I can offer**
2. Create or save private Offer metadata
3. Choose **Offer once** or **Offer over time**
4. Choose a garden for the ongoing path
5. Pending/offline series creation with a dependent place draft
6. Active ongoing Offer with zero available places
7. Add one and multiple finite places
8. Claim exactly one pre-created place and open its ordinary Commitment detail
9. Story with Fulfilled, Cancelled, Expired, Disputed/repaired, and multi-cycle records
10. Ask me again next cycle
11. Rest, resume, and retire, including existing-instance preservation copy
12. Signed saved-Offer versus unsaved local-draft persistence explanation
13. Pool participation history shown separately from the series Story
14. Later-succession preview, visibly non-interactive and outside initial scope

Include mobile, desktop, light, dark, loading, empty, offline, queued, retryable failure, terminal,
and reduced-motion states where relevant. Use existing shipping component anatomy; this is
architecture conformity and clarity, not a visual redesign.

## Required visual gallery stories

- **The Offer that continues**: person → Offer over time → pool-scoped internal series → finite
  places → independent fulfillment records → Story.
- **Availability is a promise already reserved**: contrast Offer-at-creation reservation with
  Request-at-acceptance reservation without market/trading framing.
- **A commitment compounds through repetition, not replacement**: one series, multiple cycles,
  independent instances, absolute counts.
- **Rest without erasure**: no new places while prior/open instances and Story persist.
- **Succession later, with consent**: a clearly labelled horizon image that does not imply v1
  controls or transferability.

Preserve Warm Earth, the established image aesthetic, readable captions, alt text, SVG + 2x PNG
requirements, and both light/dark gallery behavior. Do not introduce a fourth garden identity.

## Corrections required from the private exploration

- Replace claim-spawns-instance with claim-accepts-pre-created-instance.
- Replace device-only saved data with signed offchain saved Offer metadata; local-only is draft
  state.
- Replace decorative capacity with Offer-at-creation provider reservation.
- Label participant totals as reported evidence or omit them.
- Replace “counts-only standing” with **pool participation history** when referring to
  `PoolMemberHistory`.
- Do not present saved Offer metadata as onchain, series as global across pools, or Story as
  reputation.

## Validation

Run the existing artifact validation/build commands discovered from package scripts and the
current source files. At minimum:

- validate every Mermaid block if diagrams change;
- validate every storyboard/frame/asset reference and count;
- validate the prototype source and render every required state;
- validate the gallery source, all assets, light/dark tabs, and mobile layout;
- run the relevant format, vocab, DesignMD/generated/token, story-quality, and artifact-specific
  checks;
- visually inspect the canonical prototype and gallery before publishing;
- after publication, re-open both canonical URLs and verify the expected version/content rather
  than trusting a publish response.

Use authenticated Brave for any repo UI comparison. The Claude artifact preview may use its own
artifact runtime, but do not describe it as authenticated product QA.

## Stop conditions

Stop and report rather than inventing when:

- the canonical artifact source location or publish target is ambiguous;
- an existing fixture requires a product/API shape that contradicts the locked spec;
- a requested participant count lacks evidence authority;
- an initial succession control would be needed;
- publishing would overwrite unrelated concurrent artifact work;
- source validation or rendered verification cannot be completed.

## Completion report

Return:

1. exact source files changed;
2. journey/frame/asset IDs added or amended;
3. every validation command and result;
4. screenshots or rendered proof for the required states;
5. canonical prototype and gallery URLs after verified publication;
6. remaining gaps or explicit proof limits;
7. confirmation that no runtime product package, Linear record, Google Doc, contract, deployment,
   authority, or value state was changed.
