# Green Goods visual direction v3: cover typography and copy

**9 October 2026 Pacific / 10 October UTC.** The agreed cover, built from the v2 package after the typography and copy discussion: one slide, Fraunces Medium 500 upright, with the second title line in the website's accent green. The v2 problem and solution compositions remain the reference for those slides until the weight is chosen.

## Decisions applied

| Feedback | Decision | Treatment in this checkpoint |
|---|---|---|
| Italic cover title reads tacky | Fraunces upright, no italic. The website's accent colour stays: the user asked for part of the title in Green Goods green as on the site, so the second line takes the hero accent token, upright. | Land care in charcoal `#292524`, within reach in tertiary-action green `#1A7544`; 50 pt with 54 pt leading and 0.9 pt tighter tracking, matching the site's `-0.018em`. |
| Shortened subtitle lost substance, then the fuller one ran long | Subtitle chosen from five measured shorter options on 9 October 2026 Pacific (10 October UTC): the proposition's verbs for land stewards, the hub's umbrella term, with "and each other" dropped at the user's suggestion. | Inter Regular 20 pt over three phrase-broken lines, 28 pt leading. |
| Composition | C1: keep the v2 linen panel left and the conceptual garden scene right. | Panel, wordmark, logo, image and caption unchanged from v2; title box grows to two lines; subtitle box moves up to 4.58 in, holds three lines and is 5.9 in wide for wrap tolerance. |
| Title weight | Medium 500, chosen from a rendered pair at 400 and 500. | One slide in Fraunces Medium; the Regular renders were review material and are not kept. |

Considered and not chosen for the title: Inter Semibold (portable but reads as a generic software deck and drops the editorial identity), Newsreader (calmer, but a third family the website does not use), Source Serif 4 (reserve if Fraunces is rejected as a family). Fraunces upright isolates the question of treatment from family and matches the site funders will open next.

Cover copy as set:

> Land care / within reach
>
> Affordable tools for land stewards to learn / from one another, coordinate support and / keep sovereignty over their knowledge.

Explicit line breaks are set as separate paragraphs, following the v2 precedent, so the editable file and the renders break identically. Earlier candidates are kept for history: the 27-word Option 1 (five lines at 18 pt) and its 24-word trim, plus three noun-stack variants that kept "communities caring for land" or "coordinated support" but echoed the hook or lost the verbs. "Infrastructure" no longer fits a three-line cover and belongs on the solution slide and in the notes. The hook "Land care within reach" stays a working title. Third person throughout: a cover shown to funders must not say "your knowledge".

## Measured layout

Measured with the exact font files at 96 px per inch. The 18-word subtitle wraps naturally into three lines at 20 pt; the widest line is 529 px kerned and 533 px unkerned, so the box was widened to 5.9 in (566 px) and every run carries `kern="1200"`, which keeps the wrap identical in an editor that kerns differently. The earlier 27-word subtitle needed five lines at 18 pt in this measure, which is why it was shortened. Title lines measure 298 px and 378 px at Regular and 303 px and 385 px at Medium inside a 553 px box. Subtitle bottom sits 0.92 in above the panel's bottom edge.

Geometry, inches from the top left of a 13.333 by 7.5 in slide: panel 0.417, 0.750 at 6.562 by 5.917; logo 0.833, 1.201 at 0.615 by 0.348; wordmark 1.625, 1.104 at 4.750 wide, Fraunces 25.5 pt; title 0.833, 2.469 at 5.760 by 1.500; subtitle 0.833, 4.580 at 5.900 by 1.167; caption 11.354, 7.052, Inter 10.5 pt in linen.

## Fonts

The [v3 font bundle](../green-goods-pitch-fonts-v3.zip) holds the three referenced files with provenance and the OFL 1.1 text: Fraunces Regular 400 and Inter Regular 400 copied unchanged from the repository, plus Fraunces Medium 500 (family name `Fraunces Medium`, static instance) fetched from Google Fonts on 10 October 2026 UTC into a session scratch directory with the user's approval. Nothing was installed system-wide. None of these families is installed on the authoring Mac, so Keynote or PowerPoint there substitutes fonts until the bundle is installed; deliver audience copies as PDF rendered with the bundle. Fonts are referenced, not embedded.

## Rendering and verification

Render: [slide-01.png](slide-01.png) at 1280 by 720, a headless Chromium 148 render (the repository's Playwright) of an HTML replica that uses the slide geometry above, the same text, line breaks and colours, and the exact font files loaded by the page. It is not PowerPoint, Keynote or Google Slides output; this environment has no LibreOffice or python-pptx, and the earlier checkpoints' renderer is not available here. Inspection at 1280 by 720 and 2560 by 1440 checked title and subtitle fit, hierarchy, the accent colour, the absence of italics, faces and heads, and the unchanged image and caption.

The PPTX passed stdlib structural checks: zip integrity, well-formed XML in every part, every relationship target present, every part typed, and a one-entry slide list. Slide text matches the copy above; notes carry the full proposition, sources and the typography decision; no em dashes; no commercial figures. Details and hashes are in [verification.json](verification.json); PPTX SHA-256 `9b99b2afc2216e2064fc779d4e9dd43b0f6333604e1464976245f84028a639fc`.

## Files and source-to-claim index

- [Editable presentation](green-goods-pitch-cover-v3.pptx), [speaker notes](speaker-notes.md), [verification receipt](verification.json), render above.
- Cover claims: user-supplied proposition and accepted direction, 8 October 2026 Pacific, in [pitch-revision.md](../../pitch-revision.md). Affordability is a commitment to test, not a measured saving.
- Typography authority: root [DESIGN.md](../../../../../DESIGN.md) and the [browser dialect](../../../../../packages/client/DESIGN.browser.md); the live hero heading is Fraunces at weight 400 with `-0.018em` tracking in `packages/client/src/components/Public/atoms/EditorialAtoms.tsx`.
- Image: `garden-concept.png` from the [v2 checkpoint](../visual-direction-v2/README.md), unchanged, with its exact prompt and provenance there. No new image was generated. It is a fictional conceptual scene, not field evidence.

## Next step

Produce the solution-slide sample on the same rules (Fraunces Medium upright headings, Inter body, green reserved for one accent, image right) from the v2 solution composition before expanding the full deck.
