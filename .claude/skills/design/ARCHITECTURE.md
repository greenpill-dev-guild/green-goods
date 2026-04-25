# Design Skill Architecture

One-page map. Read this first when you need design context — it points to the right artifact for the question you actually have.

---

## The two-skill stack

| Layer | Skill | Owns |
|-------|-------|------|
| Direction (what/why) | **`design`** (project) | Paradigms, Warm Earth language, prompt contracts, 4-lens review, spec, stack self-audit |
| Implementation (how) | **`ui`** (project, depends on design) | Tailwind v4, Radix, Storybook, a11y, i18n, 10-step component runbook |

Dependency chain: `ui → design → root DESIGN.md front matter → generated artifacts → runtime projections`.

**AI design tools** (Stitch, Claude Design, Figma Make, Antigravity, etc.) are platform-agnostic consumers of this stack — fed `DESIGN.md` + the surface-specific prompt contract, their output is mapped back to existing components. No platform-specific skill — see `design/SKILL.md § Working with AI Design Tools` for the contract.

---

## DesignMD Source And Projections

Root `DESIGN.md` front matter is the canonical DesignMD token source. Surface `DESIGN.md` files extend it with dialect rules. `language.md`, prompt contracts, generated CSS/JSON, and `theme.css` are projections that explain or consume those sources; if prose and root DesignMD front matter disagree, update the projection or regenerate the artifact.

| Artifact | Role |
|----------|------|
| Root `DESIGN.md` | Canonical Warm Earth DesignMD front matter + creative brief |
| `packages/admin/DESIGN.md` | Restrained operator cockpit, M3 strict anatomy, Plus Jakarta Sans |
| `packages/client/DESIGN.pwa.md` | Installed PWA field tool, Inter, bottom AppBar |
| `packages/client/DESIGN.browser.md` | Public browser site, editorial browser treatment |
| `docs/DESIGN.md` | Docusaurus documentation dialect, Manrope/Bricolage/IBM Plex Mono |
| `design/language.md` | Implementation guide — shape, motion, color, material, hero moments |
| `design/quick-reference.md` | One-page scannable cheat sheet (derivative of language.md) |
| `packages/shared/src/styles/design-md.generated.css` | Generated DesignMD CSS projection |
| `packages/shared/src/styles/theme.css` | Runtime consumer — springs, materials, blur, colors |
| `packages/client/src/styles/typography.css` | Client type scale utilities |

---

## Where to look for…

| I need… | Start here |
|---------|-----------|
| DesignMD color/radius values | Root `DESIGN.md` front matter |
| Runtime spring/material usage | `design/quick-reference.md` → `language.md` for full detail |
| Prompt vocabulary for any AI design tool | `design/prompt-contract.md` (admin) or `client-prompt-contract.md` (client) |
| How to feed an AI design tool the right context | `design/SKILL.md § Working with AI Design Tools` |
| Decision: which paradigm for this surface? | `design/SKILL.md § Paradigm Selection` |
| Decision: which component / primitive? | `ui/SKILL.md § New Component Runbook` (10 steps) |
| Surface-specific brief | `packages/admin/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, `docs/DESIGN.md` |
| PR review (per-change, 4 lenses) | `design/review-checklist.md` — Regenerative → Spatial → Ecosystem → Compliance |
| Self-audit the design-system skill stack (narrow) | `design/stack-review.md` — meta-review of `design/` + `ui/` infrastructure only |
| Full design-system alignment across the repo | `design/system-alignment-review.md` — DesignMD files, Warm Earth, `theme.css`, Storybook, admin, client PWA/browser, docs, agentic guidance, Claude + Codex instructions |
| Ecosystem / cascade / archetype analysis | `design/ecosystem.md` |
| Regenerative lens specifics | `design/regenerative.md` |
| Inspiration / books / designers | `design/SKILL.md § Appendix` |
| View transitions API | `ui/view-transitions.md` |

---

## Version Coupling

`design/SKILL.md` carries `token_version`. `ui/SKILL.md` carries `design_token_version`. They **must match**. Root DesignMD front matter changes also require regenerating DesignMD artifacts.

| When you change… | Bump |
|------------------|------|
| Root `DESIGN.md` front matter tokens or token implementation aliases | Regenerate artifacts; bump both `token_version` and `design_token_version` if implementation guidance changes |
| Tokens in `language.md` (radii, springs, materials, color roles) | Both `token_version` and `design_token_version` |
| Only implementation guidance in `ui/` sub-files | `ui/SKILL.md version` only |
| Only direction in `design/` | `design/SKILL.md version` only |

**Drift detection** (wire into CI + pre-commit):
```bash
bun run check:design-generated # verifies DesignMD generated artifacts are current
bun run check:design-tokens   # verifies implementation tokens and versions are synced
bun run lint:vocab            # banned terms in i18n strings (streak/countdown/leaderboard/FOMO/…)
```

---

## Canonical component palettes

AI design tools should map output to these exports. Full palette lives in the prompt contracts; here's the quick locator.

**Admin** (`packages/admin/src/components/`):
- Layout shell: `CanvasLayout`, `AppBar` (admin top context bar), `MainSheet`, `LeftSheet`, `RightSheet`, `BottomSheet`, `NavigationBar`, `AdminFab`
- M3 wrappers (13): `AdminBadge`, `AdminButton`, `AdminCard`, `AdminCheckbox`, `AdminDialog`, `AdminFab`, `AdminFilterChip`, `AdminLinearProgress`, `AdminListItem`, `AdminSearchToolbar`, `AdminTabRail`, `AdminTextField`, `AdminTooltip`

**Client / shared** (`packages/shared/src/components/`, exported from `@green-goods/shared`):
- Shell: `SiteHeader` (browser), `AppBar` (installed PWA), `PlatformRouter`
- Dialogs: `DialogShell` (default across client + admin)
- Cards / status: `Card`, `StatCard`, `StatusBadge`, `Alert`
- Primitives: `Button`, `Skeleton`, `Spinner`, `FileUploadField`, `ListPrimitives`, `Surface`, `SyncStatusBar`, `AddressDisplay`, `DomainBadge`

Full palettes with file paths live in `prompt-contract.md` and `client-prompt-contract.md`.

---

## Always-loaded context

The highest-frequency rules are mirrored in root `CLAUDE.md` and `AGENTS.md` under "Design System" / "Design Language" so trivial edits (padding, copy, a single component touch) don't require a full skill load. The full spec is this file + `language.md` + the prompt contracts.

If you're editing more than one component, changing layout composition, creating a new view, or reviewing a PR → **explicitly load `design` + `ui`**.

---

## Skill registry

`.claude/registry/skills.json` is the source of truth for skill metadata (triggers, dependencies, sub-files, version fields). Keep it in sync when adding or moving files within a skill.

## Related

- [SKILL.md](./SKILL.md) — Design philosophy, paradigms, decision tree
- [language.md](./language.md) — Implementation guide
- [quick-reference.md](./quick-reference.md) — One-page cheat sheet
- [review-checklist.md](./review-checklist.md) — 4-lens PR review (per-change)
- [stack-review.md](./stack-review.md) — Narrow self-audit of `design/` + `ui/` skill stack only
- [system-alignment-review.md](./system-alignment-review.md) — Full-repo design-system alignment review (DesignMD, tokens, Storybook, admin/client/docs, agentic guidance)
- [prompt-contract.md](./prompt-contract.md) — Admin AI prompt vocabulary + palette
- [client-prompt-contract.md](./client-prompt-contract.md) — Client AI prompt vocabulary + palette
- Root `DESIGN.md`, `packages/admin/DESIGN.md`, `packages/client/DESIGN.pwa.md`, `packages/client/DESIGN.browser.md`, `docs/DESIGN.md` — DesignMD source and dialect briefs
- `../ui/SKILL.md` — implementation skill + runbook
