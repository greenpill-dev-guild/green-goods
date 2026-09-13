# Design Decision Log

Append-only ledger of locked design and UX decisions. This is the canonical `DL-NNN` registry:
any `DL-NNN` cited anywhere in the design skill or `.claude/rules/frontend-design.md` must exist
as a row here (checked by `bun run check:guidance-links`).

**Append paths**: the `qa-session` skill's close-phase decision lock gate, or any design round
where the user locks a decision. **IDs are never reused** — supersede, don't delete.

**Status values**:

- `locked` — binding on all design work immediately; not yet written into a canonical guidance
  surface. Agents doing design work check locked rows touching their surface.
- `codified` — the rule now lives in a canonical surface (the `Codified into` column points at
  it); the row remains as the citation anchor.
- `superseded` — replaced; the `Codified into` column names the superseding `DL-NNN`.

## Graduation ladder

1. **Locked** (at session close or design-round end): append the row with a one-sentence
   contract-style decision, the rationale, `Status: locked`, `Codified into: —`.
2. **Codified** — when the decision is a reusable rule rather than a one-view outcome, rewrite
   it into the owning surface and flip the row's status:
   - admin interaction behavior → [interaction-patterns.md](./interaction-patterns.md)
   - cross-surface implementation rules → `.claude/rules/frontend-design.md`
   - AI-design-tool vocabulary and bans → [prompt-contract.md](./prompt-contract.md) /
     [client-prompt-contract.md](./client-prompt-contract.md) § Never Use
   - token or visual-language changes → root `DESIGN.md` + [language.md](./language.md)
     (bump `token_version` per [ARCHITECTURE.md](./ARCHITECTURE.md) § Version Coupling)
   The codified text cites its `DL-NNN` inline so the provenance stays traceable.
3. **Mechanical check** — only after a rule is violated post-codification, add enforcement at an
   existing point (a guard test beside the component, a `contracts[]` entry in
   `scripts/quality/check-skill-behavior-contracts.mjs`, or the design-token lint) — never a new
   standalone script.

## Ledger

| ID | Date | Decision | Rationale | Status | Codified into |
|----|------|----------|-----------|--------|---------------|
| DL-001 | 2026-04-07 | Interaction model is a complement: lift-and-press for cards, shape morph for buttons | Different elements get different physics; richer tactile vocabulary | codified | [language.md](./language.md) § Design Decisions Log |
| DL-002 | 2026-04-07 | Motion uses named spring tokens, never hardcoded beziers | Semantic names enable motion-scheme switching; consistent vocabulary | codified | [language.md](./language.md) § Motion System |
| DL-003 | 2026-04-07 | Button shape is context-dependent: capsule = primary, squircle = secondary | Shape as emphasis hierarchy; capsule draws the eye, squircle recedes | codified | [language.md](./language.md) § Shape System |
| DL-004 | 2026-04-07 | Component vocabulary scope is the admin-relevant subset, extended only as needed | Focus on what the revamp needs now; extend vocabulary later | codified | [language.md](./language.md) § Component Patterns |
| DL-005 | 2026-04-07 | `language.md` is a comprehensive standalone spec | Self-contained enough to guide implementation without file-hopping | codified | [language.md](./language.md) |
| DL-006 | 2026-04-07 | Spatial architecture integrates deeply: all beziers → tokens, radii → concentric types | Spatial architecture is the first Warm Earth consumer; coherence matters | codified | [language.md](./language.md) § Design Decisions Log |
| DL-007 | 2026-08-16 | Admin flows reuse the client composer grammar (what → how much → proof/protection → sectioned review, with an Advanced detour); admin gets denser fields, never parallel step patterns | Reuse shipping rhythms; one flow grammar across surfaces | codified | [interaction-patterns.md](./interaction-patterns.md) § 3 |
| DL-008 | 2026-08-16 | Workspace tabs that earn it use a two-column split — left column majority width, ~300–340px right rail — collapsing below ~900px with nothing hidden | Operational density with a stable status rail; no hidden critical data (pool-tab decision) | codified | [interaction-patterns.md](./interaction-patterns.md) § 4 |
| DL-009 | 2026-08-29 | Dark filled actions are tonal: the workspace `-200` fill with `-900` ink and a lighter `-100` hover; the deep-fill + white-text dark pair is retired | Afo locked it during the design-system review round — M3-dark convention and typical dark-mode reading beat the 2026-07 keep-saturation ruling; measured AA 4.58–11.74:1 across the five tones | codified | [language.md](./language.md) § Dark Mode Palette |
| DL-010 | 2026-08-29 | The admin FAB is a capsule at both sizes (`rounded-full`: 48px dock circle, 56px extended floating); the "FAB-large is 16px" clause is struck — capsule is the 9999 step of the fixed admin radius set | Shipped `Shell/FabButton` never implemented a 16px large variant, and the clause rode through two token bumps unchallenged; spec follows shipped truth (round-3 fix-everything lock) | codified | [language.md](./language.md) § Shape System |
| DL-011 | 2026-08-29 | The cockpit rides a compact control metric — 28/32/36/40/44: buttons 28/32/40 (sm/md/lg, `admin-hit-target` preserves 44px), fields 44 with 14px text, inline field 32 on the md-button axis, toolbar pills/tabs 36, chips 32, identity pill 36. Shell chrome (AppBar 56, FAB per DL-010, nav dock) is deliberately outside the scale | Afo locked "compact scale" in the critique round — the M3-default 40/56 proportions read oversized in a steward workbench, and the 40dp AdminInlineField already existed as the escape hatch; guard test `AdminDensityScale.guard` pins the tiers | codified | [packages/admin/DESIGN.md](../../../packages/admin/DESIGN.md) § M3 Strict Anatomy |
| DL-012 | 2026-08-29 | Button/action labels are Title Case in English across admin and client ("Create Garden", "Submit Work"); es/pt keep their native sentence-style casing; field labels, helper text, banners, and body copy stay sentence case | Afo locked it in the critique round, reversing the sentence-case rule — the ~20 pre-existing Title Case strings (every "Create Garden") were the ones that read right; 345-string en sweep applied | codified | [interaction-patterns.md](./interaction-patterns.md) § Voice |
| DL-013 | 2026-08-30 | The Title Case boundary is *named things and named acts*: card/section/dialog/flow/step titles and action labels (incl. aria-only action labels, uniformly) take Title Case; status and outcome copy ("Connection lost", "Update needs a restart"), empty/connect-state titles, kickers/eyebrows, placeholders, field labels, and validation stay sentence case — even when title-shaped keys hold them | The post-DL-011/012 adoption audit found both sweep tails (~95 missed actions, ~24 over-swept statuses) and a 7-vs-7 pool dialog-title split; the correction batch closed them and this row pins the boundary the sweep tripped on | codified | [interaction-patterns.md](./interaction-patterns.md) § Voice |
| DL-014 | 2026-09-12 | Installed-PWA bottom sheets use one height scale: `compact` (content-sized, 50% at most), `half` (50%), `tall` (70%), `full` (85%), plus full-screen viewers; each sheet names its tier and never sets its own height | Afo flagged too many sheet heights (15 distinct values at 390 x 844, from 22% to 85%); a named scale keeps sizes deliberate, and capping `compact` at the half height adds no extra percentage while keeping longer es/pt confirmations' actions on small phones | codified | [DESIGN.pwa.md](../../../packages/client/DESIGN.pwa.md) § Layout philosophy |
| DL-015 | 2026-09-12 | The installed PWA's bottom AppBar hides whenever any sheet or dialog is open; sheet primitives register themselves while open instead of the AppBar listing specific sheets | The AppBar hid for five named drawers only, so it sat over the Notifications sheet and the Profile photo sheet's only action (Afo: "a major regression"); self-registration covers every present and future sheet | codified | [DESIGN.pwa.md](../../../packages/client/DESIGN.pwa.md) § Layout philosophy |
| DL-016 | 2026-09-12 | Installed-PWA sheet actions live in one shared action bar pinned to the bottom of the sheet: below 640px they stack full width with the primary on top, the second action (Cancel included) is an outlined button, a destructive primary uses the error fill, and step navigation (Back / Continue) keeps its one row; from 640px the same bar is one right-aligned row with the primary rightmost | Afo picked stacked-primary-on-top, outlined Cancel, and the wide-screen row from live mocks after flagging six inconsistent action layouts, most scrolling with the sheet body. Measured on 10 two-button sheets in en/es/pt plus a German stress test: one row cut labels off in up to 22 of 40 bars at 360px with the medium Button, English included, while stacking cut none from 320 to 412px and Back / Continue never cut | codified | [DESIGN.pwa.md](../../../packages/client/DESIGN.pwa.md) § Layout philosophy |
| DL-017 | 2026-09-12 | Any green fill that carries text, a number, or a glyph (filled CTAs, count badges, step markers, selected chips, pills) uses `primary-action` with white `primary-action-foreground`; bright `tertiary` green stays on text-free marks only, and the token audit treats any text colour on a bright green fill as a contrast risk with no exceptions | Afo found the dark-green-on-bright count badges and step numbers hard to read and asked for white. White on today's bright green measures 2.36:1 and the dark pair 4.64:1, while white on `primary-action` is 5.72:1 in both app themes, so the fill moves rather than only the text; picked option A with chips, pills, and the Send and Withdraw buttons in scope (PWA Paper Cuts review) | codified | Root `DESIGN.md` § Relationship to Codebase; [language.md](./language.md) § Dark Mode Palette (state roles); [DESIGN.pwa.md](../../../packages/client/DESIGN.pwa.md) § Color Adaptation |
| DL-018 | 2026-09-12 | Installed-PWA form fields reserve two lines (`min-block-size: 2lh`) under the control for a hint or error and sit 8px apart; a longer message grows the slot rather than scrolling inside it | The 6 Sep three-line reserve left 68px between a control and the next label in Submit Work › Details. Afo chose two lines because many real messages wrap on a 360px phone in en/es/pt, with a smaller gap so a two-line error still sits close to the next field | codified | [DESIGN.pwa.md](../../../packages/client/DESIGN.pwa.md) § Forms and Lists |

## Related

- [SKILL.md](./SKILL.md) — activation routing; "check locked rows" step
- [interaction-patterns.md](./interaction-patterns.md) — primary codification target for admin interaction rules
- The qa-session skill — its close-phase decision lock gate is the primary append path
- [ARCHITECTURE.md](./ARCHITECTURE.md) — file map and version coupling
