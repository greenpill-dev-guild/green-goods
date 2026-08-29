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

## Related

- [SKILL.md](./SKILL.md) — activation routing; "check locked rows" step
- [interaction-patterns.md](./interaction-patterns.md) — primary codification target for admin interaction rules
- The qa-session skill — its close-phase decision lock gate is the primary append path
- [ARCHITECTURE.md](./ARCHITECTURE.md) — file map and version coupling
