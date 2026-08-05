# Commitment Pooling — Claude Full-Pooling Story and Google Doc Handoff

## Status

- Work unit: additive hand-drawn Story assets plus canonical Google Doc reconciliation
- Owner: Claude Code
- State: ready for review/dispatch after the Codex compatibility sources are accepted
- Runtime implementation: not authorized
- Canonical gallery (**publication destination, currently stale**):
  <https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d>
  — the live build is still 2026-08-02 and carries neither D28/D29 nor the three new Story assets
  (`reports/corrections-log.md`, 2026-08-05 entry). Do not read that URL as evidence of this work
  unit; re-fetching it after republication is the completion check.
- Canonical Google Doc:
  <https://docs.google.com/document/d/16LNXMr5voQUgWC3iyULbL4iEhRrFo4DezZZLgNtA4hc/edit>
- Linear context: PRD-650, PRD-651, PRD-721, PRD-727, and
  [PRD-796](https://linear.app/greenpill-dev-guild/issue/PRD-796), the In Review full-pool
  compatibility gate

This is an additive narrative and visual pass. Do not redesign the document, reinterpret the
architecture, or pull future voucher work into the initial implementation. Preserve concurrent
working-tree changes and stay on the current branch unless Afo explicitly authorizes a branch
action.

## Read first

Read these sources in order before editing:

1. `plan.todo.md`, Decision Log #51–#54 and register #86–#89
2. `contract-spec.md` §6.2, especially the corrected Grassroots Economics mapping and
   transferable-voucher attachment path
3. `standing-commitments-spec.md` §8.1 and §10–§12
4. `exchange-architecture-brief.md` in full
5. `pilot-evidence-spec.md` §3, §10.3, and the Tech and Sun paragraph
6. `architecture-closure-matrices.md` future full-pool compatibility gate
7. `diagrams.md` D27–D29
8. `visual-assets.md`, including the 2026-08-04 circular-G$ WIP note and the pending Claude-owned
   additions
9. `visual-assets-artifact.build.ts`, `visual-assets-prerender.ts`, and the current Story reading
   order
10. the live Google Doc, all six tabs, before making any edit

The repo specifications own architecture. The current Google Doc owns external voice and
structure. If either conflicts with an older storyboard, image, Linear description, or private
exploration, correct the latter; do not invent a new compromise.

## Locked architecture

The current design **is adaptable** to full Commitment Pooling because three identities stay
separate:

1. `commitmentId` / registry `classId` — one immutable, non-transferable promise instance.
2. `commitmentSeriesId` — one pool-scoped Offer used over time and its Story.
3. future `voucherClassId` — one adapter-owned issuer instrument with backing and redemption
   terms.

The future Pool seam is one reserved `settlementAdapter` address interpreted as a versioned
adapter/router. The first activatable backing mode is fulfilled-only. Reserved-capacity backing
is separately gated and disabled. G$ commitment support is not voucher redemption.

The capability order is:

1. commitment coordination;
2. compatibility freeze;
3. field evidence;
4. fulfilled-backed voucher and redemption;
5. one bounded pool proving issuance, seed, exchange in/out, redemption, liquidity, and repair;
6. separately gated capacity backing and/or federation.

No stage automatically authorizes the next. No current ABI/storage addition is required. A
voucher never transfers the promise, series holder, claimant, confirmation authority,
contributors, recognition, or Story.

## Preserve current in-progress work

Before editing, run `git status --short --branch` and inspect the current diff. At handoff creation,
these paths contained concurrent work and must not be overwritten:

- `artifacts/visuals/synthesis-circular-gd.svg/.png`
- `artifacts/visuals/external-brief-pilot-pathways.svg/.png`
- `hifi/journeys.ts`
- `hifi/legacy.ts`
- `hifi/screens/admin.ts`
- `hifi/screens/client-wallet.ts`
- `hifi/screens/client.ts`
- `hifi/screens/public.ts`
- `hifi/screens/settlement.ts`
- `hifi/fixtures.ts`
- `visual-assets.md`

Inspect and continue the existing `external-brief-pilot-pathways` work; do not recreate or replace
it blindly. This work unit needs no hi-fi/prototype changes. Do not touch the `hifi/` WIP.

## Required hand-drawn Story assets

Create or reconcile three Warm Earth SVG + synchronized 2x PNG pairs:

### 1. `synthesis-path-to-full-pooling`

Show one adaptable system growing through the six locked capability gates. Make the base
coordination layer visually complete and useful on its own. Use dashed/gated treatment for every
future layer. State that completing one layer does not authorize the next.

Place it:

- in the gallery Story tab after the current three-layer/six-function framing; and
- in Google Doc tab **02 Deeper Reference**, after the paragraph explaining that Commitment
  Pooling grows in stages and before `What we take from the public research`.

### 2. `synthesis-single-pool-loop`

Show the exact future one-pool mechanics:

`authorized class → bounded fulfilled-backed issuance → seed inventory → quote/limit →
exchange in/out → redemption → settled or visible repair`

Draw the promise record and G$ support rail outside that loop. State that neither becomes
redemption by implication. Do not depict federation as active.

Place it:

- in the gallery Story tab after the staged-path asset; and
- in Google Doc tab **02 Deeper Reference**, near the paragraph that explains what is excluded now
  and what comes later.

### 3. `external-brief-pilot-pathways`

Reconcile the existing WIP into a narrowly labelled case-study asset. The primary story is Tech
and Sun across two horizons:

- **Next cycles**: climate-education Need → bounded Offer over time → genuinely reserved places →
  work/evidence → eligible participant-group confirmation → exact Story → separate support rails.
- **Future only if evidence supports it**: one fulfilled-backed service voucher class → bounded
  one-pool seed/exchange/redemption/repair test.

Quantities remain illustrative. Do not imply that Tech and Sun has agreed to a voucher pilot.
Muizenberg or AgroforestDAO material may remain only if it is equally grounded, explicitly
provisional, and does not crowd the two-horizon Tech and Sun explanation.

Place it:

- in a new or expanded gallery Story subsection about a grounded path over time; and
- in Google Doc tab **01 External Brief**, inside `What this can look like on the ground`, after
  the Tech and Sun paragraph.

Named-garden use is a narrow case-study exception. D28/D29 and reusable synthesis assets stay
garden-agnostic. The fourth-garden slot remains unnamed.

## Existing Story assets to reconcile

Inspect, do not automatically redraw:

- `synthesis-three-layers`
- `synthesis-ge-protocol`
- `synthesis-circular-gd`

Only change a claim where the new compatibility architecture requires it:

- class registration is curation/capacity accounting, not seed inventory;
- bilateral `acceptExchange` is a paired start, not pooled exchange;
- G$ reward/support payout is not voucher redemption;
- the full later loop adds its own voucher class, backing, seed inventory, exchange, redemption,
  and repair;
- the base pool/module never custodies the voucher or G$.

Preserve the current four-block `synthesis-circular-gd` WIP and its separate-Celo-rail
clarification. Do not reintroduce the retired orbit or local-goods block.

## Gallery source changes

Update the Story source in `visual-assets-artifact.build.ts` additively:

- add the three new Story sections/assets in a coherent reading order;
- keep the current 18 Story assets and prose unless an exact stale claim requires correction;
- update Story navigation, current asset count, alt text, and assertions;
- retain D28 and D29 exactly as generated from `diagrams.md` unless a real spec mismatch is found;
- keep the Architecture count at 42 and total Mermaid count at 43;
- keep Reference coverage at 36 assets;
- do not change Screens or hi-fi content;
- publish only the exact prerendered `PUBLISH-THIS` file to the existing canonical gallery URL.

The expected Story count after adding three distinct assets is 21. If the existing pilot-pathways
asset is already counted somewhere, reconcile the assertion to the actual unique rendered asset
count and explain the difference in the completion report.

## Google Doc editing contract

The live document currently has six tabs:

1. `00 Start Here`
2. `01 External Brief`
3. `02 Deeper Reference`
4. `03 Applied Reference`
5. `04 Rollout, Measurement & Claims`
6. `05 Sources & Citations`

Preserve that structure, headings, tables, links, citations, and the document's plain,
commitment-first voice. The current writing explains a complicated system with short declarative
sentences, admits what is unresolved, and distinguishes Built, Planned, and evidence-gated
capabilities. Match that voice.

Do not perform a wholesale rewrite. Before each change:

1. read the full target tab;
2. identify the smallest exact insertion or correction;
3. retain surrounding phrasing and cadence;
4. make the edit;
5. reload and re-read the affected section.

### Tab 00 — Start Here

Add only a short orientation sentence or row if needed:

> The first implementation coordinates non-transferable promises. The same architecture keeps a
> clear path to later fulfilled-backed vouchers, one bounded exchange pool, and possible
> federation, but each step has its own evidence and authorization gate.

Do not turn the opening into a technical summary.

### Tab 01 — External Brief

Add a compact `What works first, what can grow later` subsection near `Built today and planned
next`. Explain:

- the next-month user/community path;
- why the base is useful without a voucher;
- the future capability gates in ordinary language;
- G$ support versus redemption;
- the Tech and Sun two-horizon example.

Keep the existing invitation, funding, trust, and garden examples intact. Correct only exact
misleading synonyms such as seed/class-registration, paired-start/exchange, or reward/redemption.

### Tab 02 — Deeper Reference

This is the main prose home for the architecture:

- add the three-identity boundary without exposing unnecessary Solidity detail;
- explain the versioned adapter/router;
- explain fulfilled backing first and why capacity backing is later;
- add the six-stage path and one-pool proof;
- keep the Grassroots Economics grounding and clean-room language;
- update `What is excluded now, and what comes later?` so architecture is specified while
  implementation/activation remains excluded;
- preserve the borrow-and-repay companion as a separate gated layer;
- update open questions with issuer, pricing, redemption, exposure, failure/repair, and whether
  ordinary support is sufficient.

Avoid saying the base registry is a voucher or that its class is wrapped 1:1.

### Tab 03 — Applied Reference

Add only the Tech and Sun two-horizon worked path and, if the tab already contains contract-facing
examples, a small identity mapping:

- one Offer over time;
- multiple immutable fulfilled instances;
- optional later `voucherClassId`;
- no transfer of the Offer, its Story, or confirmation authority.

Keep examples illustrative and avoid inventing quantities.

### Tab 04 — Rollout, Measurement & Claims

Separate dates from capability gates:

- existing dates remain project checkpoints;
- future voucher stages have no promised date;
- add the five promotion questions from `pilot-evidence-spec.md`;
- state that evidence may conclude `Not supported` or `Unavailable` and that this is a valid
  stopping result;
- add the rule that one pool must prove redemption and repair before federation.

Update the publication checklist to require current full-pool visuals and exact
support-versus-redemption wording.

### Tab 05 — Sources & Citations

Add or update only source entries required by the new prose. Preserve numbering and working links.
Do not cite Sarafu source code. Keep the public Grassroots Economics paper/docs as conceptual
grounding and the Green Goods repo specs as implementation authority.

## Google Doc image placement

Use the synchronized PNG, never the SVG. Preserve current image sizing where replacing an image.
For new images, insert at the exact anchors above and add human-readable alt text.

Also complete the already-pending replacements listed in `visual-assets.md` only when the current
PNG is verified and the placement still matches the live prose. Do not assume an older anchor is
still present.

After every insert/replace:

- save and confirm `Saved to Drive`;
- reload the tab;
- verify the image, caption/nearby prose, and next heading;
- confirm no text was displaced or duplicated.

## Validation

At minimum:

1. `git diff --check`
2. parse every changed SVG as XML
3. verify every changed SVG has a synchronized 2x PNG with correct dimensions
4. run the gallery builder and artifact assertions
5. run the full light/dark prerender and report `rendered 43, failed 0`
6. verify the exact shareable path:
   `bun .plans/active/commitment-pooling/visual-assets-prerender.ts --verify /tmp/cp-visual-shareable.PUBLISH-THIS.html`
7. inspect Story, Architecture D27–D29, mobile, light, dark, alt text, navigation, and enlarged
   previews
8. publish to the existing canonical gallery URL only
9. re-fetch/reopen that URL and verify the new Story assets plus D28/D29
10. reload and re-read all six Google Doc tabs; confirm `Saved to Drive`
11. search the live document and artifact for these prohibited claims:
    - registry class registration described as seed inventory
    - bilateral paired acceptance described as multilateral pooled exchange
    - G$ support payout described as voucher redemption
    - `commitmentId`, `commitmentSeriesId`, and `voucherClassId` treated as one identity
    - capacity-backed issuance presented as active or approved
    - federation presented as dated, built, or automatically next
    - a voucher transferring promise ownership, confirmation authority, contributors,
      recognition, or Story
12. run the plan-hub validator and the relevant vocab/design checks

Do not claim publication or Google Doc convergence from a tool response alone. Re-open the live
surfaces and report what was actually visible after reload.

## Stop conditions

Stop and report instead of guessing if:

- current WIP conflicts with this handoff or appears to belong to another active session;
- the live Google Doc has changed enough that an insertion would require a broad rewrite;
- preserving its voice would require an architecture compromise;
- a named-garden statement lacks current support or implies participation consent;
- the artifact publisher would overwrite an unrelated version;
- any SVG, PNG, Mermaid, mobile, light/dark, Google Doc reload, or live-URL proof fails.

## Completion report

Return:

1. exact source files and Google Doc tabs changed;
2. asset IDs created or reconciled, with SVG/PNG dimensions and alt text;
3. a placement map for every Google Doc image;
4. concise before/after prose snippets for each tab;
5. every validation command and result;
6. canonical gallery and Google Doc URLs after live verification;
7. any remaining stale image or unresolved claim;
8. confirmation that no runtime package, contract ABI/storage, deployment, authority, Linear
   issue, or value state was changed.
