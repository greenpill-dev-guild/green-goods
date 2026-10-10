# Claude Code Handoff: Offer Vocabulary Correction

**Owner**: Claude Code
**Tracker**: PRD-789
**Status**: approved and published 2026-08-02
**Architecture source**: `../standing-commitments-spec.md`

## Scope lock

Remove **Practice** as a defined product or domain noun from the canonical prototype, visual asset
gallery, build sources, screen registry, storyboards, captions, asset names, and validation copy.

Present the behavior as two ways of using one familiar product noun:

1. **Offer once** creates one ordinary Offer with `commitmentSeriesId == 0`.
2. **Offer over time** creates or uses one pool-scoped internal `CommitmentSeries`.

Reusable Offer metadata may be saved as signed offchain, private-by-default data. It is input to
either path, not another product object. Only an unsaved draft may remain device-local. “I’m
learning this” is outside the initial Commitment Pooling Offer flow.

## Preserve exactly

- `CommitmentSeries` as the internal durable identity for an Offer used over time in one pool
- finite, pre-created, capacity-backed available places
- claim accepts one existing place and never spawns a new promise
- exact linked-instance **Story**
- **Ask me again next cycle** as the default renewal posture
- holder-controlled **Rest**, **Resume**, and **Retire**
- independent immutable Commitment lifecycles
- no automatic obligation, score, rate, rank, inferred participant count, or cross-pool merge

## Artifact corrections

- Replace **Things I can contribute** with **Things I can offer** where it names this feature.
- Replace Practice creation with saved Offer metadata and the **Offer once / Offer over time**
  choice.
- Replace standing-commitment product copy with ongoing Offer copy. Technical diagnostics may
  name `CommitmentSeries`.
- Rename **The practice that remains** visual story to **The Offer that continues**.
- Rename the `standing-practice-remains` asset family accordingly and update every reference.
- Remove saved-private/learning Practice states. Cover saved Offer metadata, Offer once, and Offer
  over time instead.
- Keep pool participation history separate from the exact Story of one ongoing Offer.

## Required proof before PRD-789 can leave Todo

1. Rebuild both authoritative artifact outputs with zero warnings.
2. Re-run the full state, journey, hotspot, copy, accessibility, light/dark/mobile, and
   reduced-motion validation required by `claude-standing-artifacts.md`.
3. Search all Claude-owned artifact sources and generated outputs for stale defined-noun uses of
   `Practice`, `Add a practice`, `Saved practices`, `standing commitment`, and
   `standing-practice-remains`.
4. Inspect all corrected visual assets at final size, not only their SVG source.
5. Exercise every changed prototype state in rendered browser proof.
6. Republish both canonical artifacts, then re-fetch both canonical URLs and verify the corrected
   copy and state coverage from the published versions.

## Completion evidence

Claude Code completed the correction and publication pass on 2026-08-02. Codex then independently
reviewed the corrected native-size visuals, rebuilt the prototype and gallery sources, ran the
targeted design, vocabulary, ontology, XML, diff, and plan-hub guards, and opened both canonical
published URLs.

- Prototype:
  `https://claude.ai/code/artifact/19c3dcad-ac1d-4398-bcd4-57d0c892be2c`
- Visual Asset Gallery:
  `https://claude.ai/code/artifact/007ef090-9e26-4b1d-898c-615155304d9d`
- Prototype build: 36 screens, 337 states, 453 hotspots, 44 journeys, 357 scenes, 0 warnings
- Gallery build: 18 story sections, 28 architecture sections, 51 screen entries, 5 reference
  sections, 41 Mermaid blocks
- Corrected generated outputs contain Offer once, Offer over time, exact Story, Ask me again next
  cycle, and Rest/Resume/Retire; they contain no Add a practice, Saved practices, or
  standing-practice-remains strings.
- Both canonical URLs rendered with their expected titles and no browser console errors during the
  independent review.

Codex could not independently rerun the Playwright-based 41-diagram prerender because the managed
macOS host denied Chromium's Mach rendezvous registration, including outside the filesystem
sandbox. That host limitation is recorded rather than treated as an artifact defect: Claude's
41/41 light-and-dark prerender proof, the frozen published gallery, the successful source build,
and Codex's live published-URL inspection together satisfy the publication gate.

Do not modify Solidity, events, indexer entities, capacity accounting, Story derivation, or series
lifecycle semantics as part of this correction.
