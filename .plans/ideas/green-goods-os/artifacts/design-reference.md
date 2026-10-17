# Green Goods pitch: design reference and handoff

This document records the prior Warm Earth edition (`green-goods-os-pitch-warm-earth.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68), whose generated imagery and narrative were rejected. The current [three-slide visual checkpoint](visual-direction-v2/green-goods-pitch-visual-direction-v2.pptx) and [image briefs](visual-direction-v2/README.md) supersede its visual treatment. The historical record follows. It retains the revised 18-slide pitch and eight-slide appendix, including the problem, workflow, buyer, value propositions, reciprocal network, market model, competition, business model, go-to-market and proposed ask. This pass changes visual presentation, not research conclusions.

## References used

- [Root design system](../../../../DESIGN.md): warm linen `#FAF8F5`, charcoal `#292524`, stone `#78716C`, accessible green `#1A7544`, restrained green volume and Warm Earth character.
- [Public browser dialect](../../../../packages/client/DESIGN.browser.md): Fraunces editorial headings and large numbers, Inter body copy, square editorial surfaces, linen content over an image plate, quiet regular-Fraunces wordmark and generous whitespace. This is the appropriate reference for funders and partners.
- [Repository design skill](../../../../.claude/skills/design/SKILL.md): core system and surface-specific dialects. PWA mint and admin typography are not the reference for this presentation.
- [Vendored social-card fonts and provenance](../../../../packages/client/vite/assets/fonts/social/README.md): the actual Fraunces regular/italic and Inter regular TTF files were loaded into the temporary rendering process. Nothing was installed or downloaded.
- [Official logo asset](../../../../packages/admin/public/green-goods-logo.png): embedded unchanged with its original aspect ratio.
- [Public hero reference](../../../../packages/client/public/social-home-hero.png): inspected for the linen overlay, editorial hierarchy and selective green italic emphasis. The screenshot itself is not inserted into the deck.

## Applied design

The cover uses the official mark, a square linen panel and a Fraunces headline with one green italic phrase. Content slides use the linen canvas, charcoal typography and small green accents. Large market and financial figures use Fraunces. Native tables use quiet horizontal rules and no vertical grid or dark header block. One charcoal closing slide emphasizes the proposed ask. The two existing concept illustrations remain explicitly fictional in the speaker notes; neither is product or field evidence.

The deck uses the repository's available regular font cuts, matching the public site's editorial direction. Native text, tables and the theme retain Fraunces/Inter family names. The font files are **not embedded** in the PPTX. [The accompanying font bundle](green-goods-pitch-fonts.zip) includes the unmodified repository files, provenance and OFL notice for an editor whose computer lacks them. No automatic font installation occurs. An editor that substitutes fonts may change line wrapping. Native PowerPoint and Google Slides application behavior remains untested.

## Quality review

All 26 slides were rendered and inspected individually at 1280×720 using Artifact Tool with the repository fonts registered in the rendering process. After the final cover/table refinement, the ten changed slides were inspected again; the other sixteen final renders match the inspected images byte-for-byte. Text fits within the inspected slides. Package, geometry and explicit font-family checks pass with no findings or warnings.

The final package contains 202 editable text/shape objects, nine native tables, three embedded images (two illustrations and the official mark), and 26 substantive speaker-note parts. Slide text matches the preceding revised deck after cover-case and repeated-footer normalization. All 26 speaker notes match exactly. Sources, numerical assumptions and caveats therefore remain intact.

[Verification receipt](verification-warm-earth.json) · [Source-to-claim index](pitch-source-index.md) · [Speaker notes](speaker-notes-warm-earth.md) · Cover preview (in retained deck) (`green-goods-os-pitch-warm-earth.pptx`, removed from the branch tree on 10 October 2026 and kept in history at dc6d62d68).

Final SHA-256: `026b520dcf4bdadbb5ba0043931905cc68451da951bd21ee163072ce996c46b3`.
