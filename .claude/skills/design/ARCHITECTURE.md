# Design Skill Architecture

One-page map. Read this first when you need design context — it points to the right artifact for the question you actually have.

---

## The four-skill stack

| Layer | Skill | Owns |
|-------|-------|------|
| Direction (what/why) | **`design`** (project, v2.3.1) | Paradigms, Warm Earth language, prompt contracts, 4-lens review, spec |
| Implementation (how) | **`ui`** (project, v1.4.1, depends on design) | Tailwind v4, Radix, Storybook, a11y, i18n, 10-step component runbook |
| AI code pipeline | **`stitch`** (project, v1.1.0) | Fetch from Stitch MCP → implement using existing components |
| AI prompt work | **`stitch-design`** (user, v2.0.0) | Prompt enhancement, DESIGN.md synthesis, generate/edit screens |

Dependency chain: `stitch → ui + design → language.md → theme.css`.

---

## Creative briefs vs canonical token spec

`DESIGN.md` files set **atmosphere** and **role hierarchy** (prose-first, AI-feedable). `language.md` is the **exhaustive token spec**. When they disagree, `language.md` wins.

| Artifact | Role |
|----------|------|
| Root `DESIGN.md` | Warm Earth creative brief + 4-role color volume hierarchy |
| `packages/admin/DESIGN.md` | Restrained operator cockpit, M3 strict anatomy, Plus Jakarta Sans |
| `packages/client/DESIGN.md` | Dual-mode adaptive shell (browser vs installed PWA), Inter |
| `design/language.md` | Canonical token spec — shape, motion, color, material, hero moments |
| `design/quick-reference.md` | One-page scannable cheat sheet (derivative of language.md) |
| `packages/shared/src/styles/theme.css` | Actual implementation — springs, materials, blur, colors |
| `packages/client/src/styles/typography.css` | Client type scale utilities |

---

## Where to look for…

| I need… | Start here |
|---------|-----------|
| Token values (radius, spring, color, material) | `design/quick-reference.md` → `language.md` for full detail |
| Prompt vocabulary for Stitch / Claude Design / Antigravity / Figma Make | `design/prompt-contract.md` (admin) or `client-prompt-contract.md` |
| Decision: which paradigm for this surface? | `design/SKILL.md § Paradigm Selection` |
| Decision: which component / primitive? | `ui/SKILL.md § New Component Runbook` (10 steps) |
| Surface-specific brief | `packages/{admin,client}/DESIGN.md` |
| PR review | `design/review-checklist.md` (4 lenses: Regenerative → Spatial → Ecosystem → Compliance) |
| Ecosystem / cascade / archetype analysis | `design/ecosystem.md` |
| Regenerative lens specifics | `design/regenerative.md` |
| Inspiration / books / designers | `design/SKILL.md § Appendix` |
| Build a screen from a Stitch project | `stitch` skill (triggers on "build from stitch" / "implement screen") |
| Write or enhance a Stitch prompt | `stitch-design` user skill (symlink at `~/.claude/skills/stitch-design`) |
| View transitions API | `ui/view-transitions.md` |

---

## Version coupling

`design/SKILL.md` carries `token_version`. `ui/SKILL.md` carries `design_token_version`. They **must match**.

| When you change… | Bump |
|------------------|------|
| Tokens in `language.md` (radii, springs, materials, color roles) | Both `token_version` and `design_token_version` |
| Only implementation guidance in `ui/` sub-files | `ui/SKILL.md version` only |
| Only direction in `design/` | `design/SKILL.md version` only |

**Drift detection** (wire into CI + pre-commit):
```bash
bun run check:design-tokens   # verifies tokens spec'd in language.md exist in theme.css AND versions are synced
bun run lint:vocab            # banned terms in i18n strings (streak/countdown/leaderboard/FOMO/…)
```

---

## Canonical component palettes

AI design tools should map output to these exports. Full palette lives in the prompt contracts; here's the quick locator.

**Admin** (`packages/admin/src/components/`):
- Layout shell: `CanvasLayout`, `TopContextBar` (AppBar), `MainSheet`, `LeftSheet`, `RightSheet`, `BottomSheet`, `NavigationBar`, `AdminFab`
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
- [language.md](./language.md) — Canonical token spec
- [quick-reference.md](./quick-reference.md) — One-page cheat sheet
- [review-checklist.md](./review-checklist.md) — 4-lens PR review
- [prompt-contract.md](./prompt-contract.md) — Admin AI prompt vocabulary + palette
- [client-prompt-contract.md](./client-prompt-contract.md) — Client AI prompt vocabulary + palette
- Root `DESIGN.md`, `packages/{admin,client}/DESIGN.md` — creative briefs
- `../ui/SKILL.md` — implementation skill + runbook
- `../stitch/SKILL.md` — Stitch-to-code pipeline
