# Editable pitch deck and inspection artifacts

## Current status: core deck in review

On 9 October 2026 Pacific (10 October UTC) the user accepted Fraunces upright for the title with no italic or green accent word, then chose an 18-word third-person subtitle for land stewards from measured options, kept the v2 panel composition, approved fetching the Fraunces Medium cut, and settled on Medium 500 with the second title line in the website's accent green. Start with the [continuation prompt](../handoffs/pitch-restart-prompt.md). The solution sample was carried into a sixteen-slide core deck built from the agreed narrative, which now awaits review.

## Latest visual checkpoint: v3 cover, solution sample and core deck

[The agreed editable cover](visual-direction-v3/green-goods-pitch-cover-v3.pptx): one slide in Fraunces Medium 500 upright with the second title line in accent green, the 18-word subtitle and the v2 panel composition. The [decision record, measurements and limitations](visual-direction-v3/README.md) accompany it with [speaker notes](visual-direction-v3/speaker-notes.md) and a [verification receipt](visual-direction-v3/verification.json). The render is a headless Chromium replica of the slide geometry with the exact font files, not PowerPoint or Keynote output. The [v3 font bundle](green-goods-pitch-fonts-v3.zip) adds the Medium cut with provenance; nothing was installed. The [solution-slide sample](visual-direction-v3/green-goods-pitch-solution-v3.pptx), built from the v2 solution composition with status labels and a single accent, sits beside the cover with its [render](visual-direction-v3/solution-01.png) and [receipt](visual-direction-v3/verification-solution.json); the decision record explains both. The [core deck](visual-direction-v3/green-goods-pitch-core-v3.pptx) with its [notes](visual-direction-v3/speaker-notes-core.md), [receipt](visual-direction-v3/verification-core.json) and [deck spec](visual-direction-v3/core/deck-spec.json) is the current review candidate for the whole pitch; its renders and PDF preview regenerate from the spec and are not stored in the branch.

## Previous checkpoint: v2 cover, problem and solution

Version 2 addressed the preceding feedback: a short cover hook, explicit knowledge silos, no generated faces or heads, images on the right, and a concrete browser-workspace explanation. Its cover is superseded by v3; its problem and solution slides remain the current reference for those compositions.

[Three editable treatments](visual-direction-v2/green-goods-pitch-visual-direction-v2.pptx) cover the opening, problem and solution from the agreed flow. [Image briefs and exact prompts](visual-direction-v2/README.md) document the website references and two new conceptual images. These are representative compositions for review, not the complete revised pitch. All slide text remains editable; each slide has speaker notes and source references.

## Status of earlier decks

The 26-slide and 18-slide deck files below are prior drafts. The user rejected the narrative and generated imagery. Rendering and package checks establish artifact integrity, not acceptance. The [current agreed direction and revised flow](../pitch-revision.md) supersede their positioning and commercial figures. No slide or image changed during the narrative-alignment update. New imagery should follow the actual website references and a reviewed visual purpose.

## Prior draft: Green Goods Warm Earth design

- Editable pitch deck (`green-goods-os-pitch-warm-earth.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68): the revised 26-slide narrative in the public Green Goods editorial style.
- [Design references and editor handoff](design-reference.md), [speaker notes](speaker-notes-warm-earth.md), [source-to-claim index](pitch-source-index.md) and [verification](verification-warm-earth.json).
- Cover preview (in retained deck) (`green-goods-os-pitch-warm-earth.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68); the retained deck contains all slides.
- [Brand font bundle](green-goods-pitch-fonts.zip): unchanged repository font files and their license/provenance. Fonts are referenced, not embedded in the PPTX; no software or fonts were installed.

This prior draft uses Fraunces and Inter, warm linen and charcoal, restrained green, the official mark and square editorial layouts. All research text and notes are preserved from the narrative revision. Every slide was rendered and inspected; native PowerPoint/Google Slides behavior was not tested. Earlier versions below are retained for history.

## Previous narrative revision

- Revised editable pitch (`green-goods-os-pitch-revised.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68): 18 core pitch slides and eight appendix slides; 201 native text/shape objects, nine native tables, two embedded concept illustrations and 26 speaker-note parts.
- [Revised speaker notes](speaker-notes-revised.md) and [source-to-claim index](pitch-source-index.md).
- [Revised verification receipt](verification-revised.json) and rendered cover (in retained deck) (`green-goods-os-pitch-revised.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68). All slides remain in the retained editable deck.
- [Market model](../market-sizing.md) and [revised strategic framing](../pitch-revision.md).

This version replaces the earlier deck's research-review narrative. It leads with the vision, problem, solution, user/buyer, value proposition, reciprocal network, market, competition, revenue, go-to-market and proposed partner/funder ask. Technical and legal detail is retained in the appendix and notes. Market prices, qualified share, acquisition and margins remain assumptions. This is a proposal, not an implemented OS or a record of customer traction.

The final PPTX was reimported and every slide rendered. All slides received individual full-size visual inspection; the final five content repairs were inspected again, and the other 21 final renders matched the already-inspected renders byte-for-byte. Package and geometry checks pass with no findings or warnings. Text and tables are editable; illustrations are replaceable bitmaps. Native PowerPoint/Google Slides behavior was not tested.

The two new images are fictional editorial concepts generated with the built-in image tool on 8 October 2026 Pacific. `landscape-concept.png` depicts varied working lands, a creek and small groups of stewards in a tactile forest/sage/ochre palette, with dark space for editable title text. `field-adviser-concept.png` depicts a fictional farmer and adviser at a farm worktable with ordinary devices, notebook and probe. Neither depicts a real partner, pilot, person or environmental result. No private community data or images were used.

## Superseded first version

- Green Goods OS pitch (`green-goods-os-pitch.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68): 18 editable slides, native text, eight native tables and speaker notes with source references.
- [Speaker notes](speaker-notes.md): readable editable Markdown copy extracted from the final PPTX.
- [Verification receipt](verification.json): file hash, package/layout/reimport checks and visual-inspection coverage.
- Rendered cover (in retained deck) (`green-goods-os-pitch.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68): the retained deck contains every slide.
- Nursery illustration (in retained deck) (`green-goods-os-pitch.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68): generated conceptual artwork, not field or pilot evidence.

The presentation was rendered with Artifact Tool after importing the finalized PPTX. Every slide was inspected individually. Native PowerPoint and Google Slides application behavior was not tested. Text and tables are editable; the cover illustration is a replaceable bitmap. The renderer's first image-path export issue was repaired by embedding the image bytes before final validation.

## Illustration provenance

Created using the built-in image generation tool on 2026-10-08. Final prompt:

> Create one sophisticated editorial illustration for a Green Goods proposal presentation. A fictional community plant nursery viewed from gently above, orderly small seedling beds, rich dark soil, a simple watering can and a handwritten field notebook with no legible words, diverse young green leaves. Warm earth palette: deep forest green, muted sage, warm ivory and subtle terracotta. Hand-painted gouache with fine botanical detail and subtle paper texture, calm and credible rather than futuristic. Portrait composition, approximately 4:5, with plants and beds flowing diagonally in the right two thirds, generous simple dark green space at upper left. No people, no flags, no logos, no computers, no sensors, no text. This is conceptual artwork, not evidence of an actual community, farm or product deployment.

No private community images, personnel information or live field data were used.

## Draft PR packaging

All five editable decks, research, notes, source indexes, image prompts and both three-slide checkpoints are retained. Historical full-deck PNG previews and three standalone images duplicated inside those decks are omitted from this branch to keep the unchanged repository validation gate within its binary-diff buffer. Original files remain in the source checkout at `/Users/afo/Code/greenpill/green-goods/.plans/ideas/green-goods-os/artifacts/`. Their earlier render checks remain historical; this packaging pass did not alter any PPTX. Historical preview/image links now point to the corresponding retained deck.

## Removed from the branch tree

On 10 October 2026 the three rejected decks (`green-goods-os-pitch.pptx`, `green-goods-os-pitch-revised.pptx`, `green-goods-os-pitch-warm-earth.pptx`) and the superseded v1 visual checkpoint folder (`visual-direction/`, whose face-containing images must not be reused) were removed from the branch tree. The pre-push selector fingerprints the whole binary patch against develop within a 64 MiB buffer, and the branch had outgrown it. The files remain in this branch's history at commit dc6d62d68 and in the original checkout; their notes, source indexes and verification receipts stay here as text. No validation rule or hook was changed.
