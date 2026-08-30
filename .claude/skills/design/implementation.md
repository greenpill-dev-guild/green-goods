# Design Implementation

Execution companion to the `design` skill: how to express Warm Earth *in code*. Direction lives in [SKILL.md](./SKILL.md) / [language.md](./language.md); runtime tokens in `packages/shared/src/styles/theme.css`. Generic Tailwind v4 / Radix / WCAG mechanics are model-known — this file holds only the repo-specific parts. Tailwind's shared-scan gotcha is in root `CLAUDE.md § Known Gotchas`; token roles + the 13 sins in `CLAUDE.md § Design System` and [quick-reference.md](./quick-reference.md).

## New Component Runbook

Linear path from blank file to merge-ready.

| # | Step | Decide / Do | Source |
|---|------|-------------|--------|
| 1 | Paradigm | Command / Ambient / Data Landscape / Conversational / Ritual. One-line comment at top of file. | [SKILL.md § Paradigm Selection](./SKILL.md) |
| 2 | Material | Thickness by density: ultrathin/thin = glanceable, regular = default, thick/solid = text-dense. Admin dense = solid. | [surfaces.md](./surfaces.md) |
| 3 | Shape | Fixed (badges), Capsule (primary CTA / icon button), Concentric (`child_radius = parent_radius − padding`). Shape alone = hierarchy. Admin carve-out: fixed 4/8/12/16/9999 scale — the FAB is a capsule at both sizes (DL-010); `AdminButton` stays pill. | [language.md § Shape System](./language.md) |
| 4 | Motion | `var(--spring-*)` only; never hardcode `cubic-bezier`/`duration`. Standard for admin; Expressive only for client hero moments. | [language.md § Motion System](./language.md) |
| 5 | Primitive | Compose Radix + `tv()`. Dialogs → `DialogShell` (client/shared) or `AdminDialog` (admin). | Dialogs below |
| 6 | Responsive | Container queries (`@container`, `@[480px]:`) for component-internal layout; `sm:`/`md:` for page-level. | — |
| 7 | A11y | Label inputs, errors via `aria-describedby`, color never the sole indicator, hit targets ≥ 44px, focus via Radix. | — |
| 8 | i18n | Every string via `intl.formatMessage` / `FormattedMessage`; update en/es/pt; keep `lint:vocab` terms out. | i18n below |
| 9 | Storybook | CSF3, `tags: ["autodocs"]`, default + loading + error + empty variants. | Storybook below |
| 10 | Review | Four-lens self-review (Regenerative → Spatial → Ecosystem → Compliance); `bun run check:design-tokens` before merge. | [review-checklist.md](./review-checklist.md) |

**Admin shortcut**: steps 1–4 are pre-answered (Command + solid + the reduced 4/8/12/16/9999 M3 shape scale + Standard motion) — start at step 5.
**Client shortcut**: hero components (garden creation, hypercert mint) override step 4 → Expressive, step 2 → dramatic material. See [language.md § Hero Moments](./language.md).

## Dialogs — two project wrappers over Radix `Dialog.*`

Both own mobile bottom-sheet + viewport width cap — consumers must **not** restate `max-w-*` (guarded; see frontend-design Rule 14). Raw Radix `Dialog.*` only when neither wrapper fits.

- **`DialogShell`** — client / shared default. `packages/shared/src/components/Dialog/ConfirmDialog.tsx`, exported from `@green-goods/shared`. Props: `open`, `onOpenChange`, `title`, `description?`, `icon?`, `size` (`md|lg|xl|2xl`), `children`, `preventClose?`. `glass-floating`; owns z-layering. **Never in admin.**
- **`AdminDialog`** — admin dashboard default, strict M3. `packages/admin/src/components/AdminDialog.tsx` (+ `AdminConfirmDialog`). Props: `open`, `onOpenChange`, `title`, `description?`, `icon?`, `children`, `actions?`, `size` (`sm|md|lg` — three tiers by action weight), `variant` (`standard|confirm|palette|flow`), `tone` (`hub|garden|community|actions|home` — required in-portal; the portal escapes `[data-tone]`, so unset falls back to green), `preventClose?`. `palette` backs the command palette; `flow` + `ADMIN_FLOW_DIALOG_CLASS` (with `size="lg"`) backs full-surface flows (Submit Work, Create Assessment, Create Hypercert). No `size="fullscreen"` — retired and enforced by check-tokens.sh. Size/variant standard: [prompt-contract.md § Dialog size & variant standard](./prompt-contract.md).

## Admin layout & component palette

- Layout default: `CanvasRouteFrame` + `CanvasRouteHeader` (`packages/admin/src/components/Layout/`) → one primary workspace → every detail/inspection flow in a centered `AdminDialog` (`RightSheet`/`LeftSheet`/`BottomSheet` renderers retired; `AdminSideSheet` only for the 3 global AppBar surfaces). Model new admin surfaces on the `/hub` route (`packages/admin/src/views/Hub/`). Actions go in the header `actions` slot, never beside the title.
- Cards / elevated surfaces = records or bounded interactions, not page structure. One dominant workspace surface per route; avoid nested rounded-panel stacks.
- Chrome & skins: the admin shell is forked — `packages/admin/src/components/Shell/` owns AppBar/NavigationBar/MainSheet styling in JSX, independent of the shared Canvas components. Admin-owned component skins and motion live in `packages/admin/src/styles/admin-m3-components.css`, tokens in `admin-m3-tokens.css` (`admin-m3-overrides.css` is retired). Depth is the single `--m3-elevation-0/1/2` ladder; workspace tone appears in exactly 4 places (active tab/nav pill, one filled header action, faint canvas wash, nav-shell FAB fill).
- Canonical palettes (do not invent component names — flag a missing primitive instead): admin → [prompt-contract.md § Canonical Component Palette](./prompt-contract.md); client → [client-prompt-contract.md § Canonical Component Palette](./client-prompt-contract.md).

## Storybook

Unified instance hosted from `packages/shared`, indexing shared + admin + client stories.

| Command (in `packages/shared`) | Purpose |
|---|---|
| `bun run storybook` | Dev server, port 3004 |
| `bun run build-storybook` | Static build |
| `bun run check:stories` | Coverage gate — `scripts/quality/check-story-coverage.ts` |
| `bun run check:story-quality` | Determinism / agent-readability gate — `scripts/quality/check-story-quality.ts` |
| `bun run test:stories:ci` | Curated browser-mode `play()` smoke |

- Co-locate story with component. CSF3 + `tags: ["autodocs"]`; cover default / loading / error / empty / permission via named stories or a `StateCatalog` (never `Gallery`).
- **Tags (clean-room)**: `autodocs` always; `visual-harness` only when a real component can't render deterministically (wallet / contract / live-service seams) — harness stories don't count as real-component coverage without an audited exception; `storybook-ci` only for stable high-value `play()` behavior (keep the CI lane curated).
- **Determinism**: use `.storybook/fixtures.ts` / `adminFixtures.ts` fixtures and `.storybook/decorators.tsx` helpers (`withRouter`, `withCanvasFrame`, `withAdminIdentity`, `withSeededQueryClient`). Never `Date.now()`, zero-arg `new Date()`, `picsum.photos`, live IPFS, or placeholder CIDs — use `STORYBOOK_NOW_SECONDS`, `hoursAgo`/`daysAgo`/`daysFromNow`, and `FIXTURE_*` data-URL images.
- Title families are enforced by `check:story-quality` — match the nearest existing family (`Shared/*`, `Admin/*`, `Client/*`); don't invent one.
- Icons: Remixicon (`@remixicon/react`), not lucide. Dark mode via the theme toolbar (`data-theme="dark"`), not duplicate `DarkMode` stories.

## i18n

react-intl, 3 bundled locales. Every user-facing string via `FormattedMessage` / `intl.formatMessage`; format dates/numbers with `Intl`, never by hand. **Coverage gate**: every new key must land in all three of `packages/shared/src/i18n/{en,es,pt}.json` in the same change — parity is mandatory. Keys are semantic (`app.feature.action`). Keep banned copy out (`bun run lint:vocab`).

## View Transitions

Baseline + directional (forwards / backwards / fade) + reduced-motion gating are already implemented in `packages/client/src/styles/view-transitions.css`. Named classes: `.vt-main`, `.vt-page`, `.vt-header`, `.vt-garden-card`, `.vt-work-card`. Persistent entities morph by sharing a `viewTransitionName` (e.g. `garden-${id}`) across list + detail — **unique per entity per page, stable across routes**. Full-page morphs use the spatial-slow spring token family (`--spring-spatial-slow-*`); smaller swaps the spatial one. Reduced motion is handled in CSS — no per-component work.

## Validation roll-up

`bun run check:design-tokens` (spec ↔ theme.css drift + version coupling) · `bun run lint:vocab` · when a component / story / Storybook surface changes: `bun run --filter @green-goods/shared check:stories` + `check:story-quality`.
