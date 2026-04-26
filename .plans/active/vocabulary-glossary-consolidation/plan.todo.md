# Vocabulary Glossary Consolidation

**Slug**: `vocabulary-glossary-consolidation`
**Status**: `ACTIVE`
**Created**: `2026-04-25`
**Priority**: `p2`
**Branch**: `develop` (working from current)

## Why this exists

Today the Green Goods vocabulary lives in five places:

1. `DESIGN.md § Voice & Copy` — root creative brief, 11-row "Use / Don't Use" table.
2. `.claude/skills/design/prompt-contract.md § Required Vocabulary` + `§ Never Use` — admin-surface AI-prompt contract.
3. `.claude/skills/design/client-prompt-contract.md § Required Vocabulary` + `§ Never Use` — client-surface AI-prompt contract.
4. `CLAUDE.md § Design System § Banned vocabulary` — summary block for project agents.
5. `scripts/design/check-vocab.sh` + `docs/docs/reference/banned-vocabulary.json` — already partly extracted; the JSON sidecar exists, the script reads it, but the human-readable canonical glossary it points at (`docs/docs/reference/glossary-community.md`) has never been written.

`bun run lint:vocab` already reads `banned-vocabulary.json`. The remaining gap is the canonical human-readable glossary that every doc and the JSON sidecar reference.

## Constraints (load-bearing, brief-stipulated)

- **Hard scope** — only these terms in the canonical glossary:
  - 10 domain entities: Garden, Action, Work, Assessment, Hypercert, Vault, Cookie Jar, Attestation, Hat, Season.
  - 5 personas: Gardener, Operator, Evaluator, Funder, Community Member.
  - 4 surfaces: Admin, Client PWA, Agent (telegram/SMS/WhatsApp), Public browser.
  - Banned cross-surface: streak, countdown, leaderboard, FOMO, growth-hacking language (umbrella for the existing lint-enforced terms `urgent | limited time | re-engagement | retention hook`).
  - Banned admin-only: hero moment, gallery, decorative gradient, marketing banner, glass outside admin AppBar.
  - Banned client-only: operator cockpit, utility copy, KPI tile, dashboard, Plus Jakarta Sans.
- **Excluded by brief** — Sites (Garden alias), Field Notes (Work alias), Volumes (Season alias), Steward (public-facing Operator alias), Verified Site badge, JournalHero, EditorialStatTile, "Vol. I — Cultivation" framing, or any other Stitch-derived rename. These are NOT canonical Green Goods vocabulary.
- **No enforcement-set change.** `bun run lint:vocab` must pass before/after with identical output: same 8 terms enforced (`streak | countdown | leaderboard | FOMO | urgent | limited time | re-engagement | retention hook`), same i18n JSON globs, same exit code.
- **No `.claude/rules/` or ESLint config edits** — that's the parallel rules-executable agent's lane.
- **No reorganization of the design skill stack** — modify only the prompt-contract files' vocabulary references; keep their narrative structure (component palette, motion rules, hero-moment carve-out) intact.

## Discriminating check

After consolidation, run `bun run lint:vocab` against the same i18n corpus and confirm identical output to the pre-change run. If any term silently drops or appears, the consolidation changed enforcement — revert and rework.

## Approach

### 1. Glossary home (decided)

The brief named `docs/docs/glossary.md` and said "extend if it exists, else create." Neither `docs/docs/glossary.md` nor `docs/docs/reference/glossary-community.md` exists on disk today. But:

- The Docusaurus sidebar already wires `{type: 'doc', id: 'reference/glossary-community', label: 'Glossary'}` and `slug: /glossary` is reserved for it.
- `banned-vocabulary.json` cites it as the human-readable companion.
- `check-vocab.sh` references it in error messages.
- Both prompt-contracts deep-link into it: `#design-vocabulary`, `#admin-only-banned-ai-prompt-vocabulary`.

Creating `docs/docs/glossary.md` would either collide with the existing `slug: /glossary` mapping or fragment canonical vocabulary across two surfaces.

**Decision**: write the file at `docs/docs/reference/glossary-community.md`. Anchors must slugify to `#design-vocabulary` and `#admin-only-banned-ai-prompt-vocabulary` (Docusaurus auto-slug from heading text) so existing cross-references resolve without edits.

### 2. JSON sidecar (already exists — verify)

`docs/docs/reference/banned-vocabulary.json` already carries:
- `linter_enforced.terms` — the 8-term enforced set.
- `prompt_vocabulary_admin_banned` — admin-only AI-prompt bans.
- `prompt_vocabulary_client_banned` — client-only AI-prompt bans.

No edits needed. The glossary copy quotes / cites the JSON; the linter reads the JSON.

### 3. Linter (already reads sidecar — verify)

`scripts/design/check-vocab.sh` already reads `linter_enforced.terms` from the JSON via `jq` / `python3` / awk fallback. No edits needed unless the verification run reveals drift.

### 4. Write the canonical glossary

Sections in this order:
- Front matter — `title`, `slug: /glossary`, `audience: all`, `owner: docs`, `last_verified: 2026-04-25`.
- `## Domain Entities` — 10 terms (Garden, Action, Work, Assessment, Hypercert, Vault, Cookie Jar, Attestation, Hat, Season). Each: canonical form, type, allowed surfaces, one-line definition.
- `## Personas` — 5 personas (Gardener, Operator, Evaluator, Funder, Community Member). Each: canonical form, type, allowed surfaces, one-line definition.
- `## Surfaces` — 4 surfaces (Admin, Client PWA, Agent, Public browser). Each: canonical form, type, allowed surfaces (self), one-line definition.
- `## Design Vocabulary` — anchor target for prompt-contracts; cross-references the three sections above plus a pointer to `banned-vocabulary.json`.
- `## Banned Vocabulary` — three subsections:
  - `### Lint-Enforced (cross-surface)` — 8 terms enforced by `bun run lint:vocab`.
  - `### Admin-Only Banned (AI Prompt Vocabulary)` — admin-surface bans; anchor `#admin-only-banned-ai-prompt-vocabulary`.
  - `### Client-Only Banned (AI Prompt Vocabulary)` — client-surface bans; anchor `#client-only-banned-ai-prompt-vocabulary`.

### 5. Add cross-references in design contracts + DESIGN.md + CLAUDE.md

- `prompt-contract.md`: existing pointers already use `#design-vocabulary` and `#admin-only-banned-ai-prompt-vocabulary` — verify they resolve.
- `client-prompt-contract.md`: add a header pointer to the canonical glossary above `§ Required Vocabulary` and a footer pointer near `§ Never Use`.
- `DESIGN.md § Terminology`: replace the "Banned terms live in language.md" sentence with a pointer to the glossary; keep the positive table.
- `CLAUDE.md § Banned vocabulary`: keep the bulleted summary (it's load-bearing context for project agents); add a one-line pointer to the canonical glossary so the source of truth is unambiguous.

### 6. Validation

```bash
# Pre-change baseline
bun run lint:vocab
# => "✅ check-vocab: no banned vocabulary found in 3 i18n file(s)."

# Post-change: identical
bun run lint:vocab

# Spot-check sidecar
jq '.linter_enforced.terms' docs/docs/reference/banned-vocabulary.json
```

## Out of scope

- Changing what's enforced.
- Touching `.claude/rules/`.
- Reorganizing the design skill stack.
- Re-introducing journal aliases (Sites / Field Notes / Volumes / Steward) — explicitly excluded by brief.
- Renaming canonical types (`Garden` stays `Garden` everywhere).

## Checklist

### Step 1 — Verify sidecar + linter
- [x] `bun run lint:vocab` passes pre-change. Output: "✅ check-vocab: no banned vocabulary found in 3 i18n file(s)."
- [x] `docs/docs/reference/banned-vocabulary.json` exists with `linter_enforced.terms`.
- [x] `scripts/design/check-vocab.sh` reads `linter_enforced.terms` from JSON.

### Step 2 — Write canonical glossary
- [x] Extended `docs/docs/reference/glossary-community.md` with new sections: Domain Entities (10), Personas (5), Surfaces (4), Design Vocabulary (anchor), Banned Vocabulary (Lint-Enforced + Admin-Only + Client-Only), How to Update. Existing community-facing prose entries preserved under "Term Reference (Community-Facing Definitions)".
- [x] Heading slugs verified: `#domain-entities`, `#personas`, `#surfaces`, `#design-vocabulary`, `#banned-vocabulary`, `#lint-enforced-cross-surface`, `#admin-only-banned-ai-prompt-vocabulary`, `#client-only-banned-ai-prompt-vocabulary`.

### Step 3 — Cross-references
- [x] `client-prompt-contract.md`: header pointer above `§ Required Vocabulary` + footer pointer in `§ Never Use`.
- [x] `DESIGN.md § Terminology`: pointer replaces stale "Banned terms live in language.md" sentence.
- [x] `CLAUDE.md § Banned vocabulary`: pointer to canonical glossary + JSON sidecar; bulleted summary preserved; growth-hacking-language umbrella expanded inline (`urgent`, `limited time`, `re-engagement`, `retention hook`).
- [x] `prompt-contract.md`: existing pointer updated — removed `Operator/Steward, ... Volume` (excluded by brief), expanded entity list to canonical 10 + 5 personas.

### Step 4 — Validation
- [x] `bun run lint:vocab` pre + post change: identical output ("✅ check-vocab: no banned vocabulary found in 3 i18n file(s).").
- [x] `jq '.linter_enforced.terms' docs/docs/reference/banned-vocabulary.json` returns the same 8 terms (`streak`, `countdown`, `leaderboard`, `FOMO`, `urgent`, `limited time`, `re-engagement`, `retention hook`).
- [x] Glossary anchors `#design-vocabulary` and `#admin-only-banned-ai-prompt-vocabulary` resolve to existing prompt-contract cross-references.

### Step 5 — Done
- [x] Canonical glossary: `docs/docs/reference/glossary-community.md` (slug `/glossary`, sidebar already wired).
- [x] Term count: 10 entities + 5 personas + 4 surfaces = 19 canonical terms; 8 lint-enforced bans + 5 admin-only bans + 5 client-only bans = 18 banned phrases (plus the broader prompt-vocabulary lists in JSON sidecar).
- [x] `check-vocab.sh` already reads `linter_enforced.terms` from `banned-vocabulary.json` — no script change needed; the glossary is the human mirror.
- [x] Files that now reference the canonical glossary: `DESIGN.md`, `CLAUDE.md`, `.claude/skills/design/prompt-contract.md`, `.claude/skills/design/client-prompt-contract.md`, `scripts/design/check-vocab.sh` (comment), `docs/docs/reference/banned-vocabulary.json`.
