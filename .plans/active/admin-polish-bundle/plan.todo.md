# Admin Polish Bundle

**Slug**: `admin-polish-bundle`
**Status**: `ACTIVE`
**Created**: `2026-04-25`
**Priority**: `p3`
**Branch**: per-item — see Items section. Run independent worktrees if parallelizing.

## Why this exists

Four small admin defects identified across recent feedback (`feedback_admin_audit_2026_04_14`, `project_admin_known_pains_2026_04_19`) that don't warrant their own plan but together push admin from "functional" to "trusted." Each item is independently dispatchable — this hub keeps the rolling polish queue visible.

## Items

### A. Nav flash on first paint
**Branch**: `bug/admin-nav-flash`

- **Symptom**: `NavigationBar` / `AdminAppBar` renders default state and snaps to authenticated state on every session start.
- **Hypothesis**: hydration order — auth resolution arrives after nav has already painted defaults.
- **Approach**: gate first nav paint on auth-resolved state, OR render the nav with a skeleton that matches eventual layout dimensions so the snap is invisible.
- **Files**: `packages/admin/src/components/Layout/`, `AuthProvider` in `packages/shared/src/providers/Auth.tsx` (treat as `critical` per CLAUDE.md criticality matrix — read every touched line).

### B. Missing tooltips on icon-only controls
**Branch**: `chore/admin-tooltip-coverage`

- **Symptom**: icon-only controls (FAB, AppBar actions, toolbar buttons) lack accessible names and hover hints.
- **Approach**: audit `AdminFab`, `AdminAppBar` action slots, `AdminToolbar` icon buttons. Ensure every icon-only button has `aria-label` and a Radix Tooltip wrapper.
- **Files**: `grep -rn 'IconButton\|<button' packages/admin/src/components/` to enumerate; tooltip primitive lives in `@green-goods/shared`.

### C. Icon library inconsistency
**Branch**: `refactor/admin-icon-consolidation`

- **Symptom**: icon weight/style mixes Material Symbols + Lucide + ad-hoc SVGs — visible drift across views.
- **Approach**: pick canonical set (likely Material Symbols given strict M3 anatomy), document choice in `DESIGN.md`, replace stragglers per view.
- **Files**: `grep -rn 'lucide-react\|material-symbols' packages/admin/src/`. Track count before/after.

### D. RightSheet width too narrow at desktop
**Branch**: `feature/right-sheet-width-variants`

- **Symptom**: `RightSheet` feels cramped at desktop, especially for forms or multi-column content.
- **Approach**: introduce width variants (`default` | `wide`) keyed by content density. Apply where create/edit forms live (Action, Garden, Hypercerts wizards).
- **Files**: `packages/shared/src/components/Canvas/RightSheet.tsx` + admin views consuming it.

## Constraints (apply to all items)

- Strict M3 anatomy in admin.
- Tokens only — no raw `cubic-bezier`, duration, color, or radius literals.
- No console.log — use `logger` from `@green-goods/shared`.
- No `Wagmi`/`useEffect` async without `useAsyncEffect`; no raw `setTimeout` (`useTimeout`); no raw `addEventListener` (`useEventListener`). See `.claude/rules/react-patterns.md`.
- `bun run check:design-tokens && bun run lint:vocab && bun run test` must pass per item.

## Checklist

- [ ] A. Nav flash on first paint — own commit.
- [ ] B. Tooltip coverage on icon-only controls — own commit.
- [ ] C. Icon library consolidation — own commit.
- [ ] D. RightSheet width variants — own commit.

Items A–D are independently dispatchable. If running in parallel, use separate worktrees.
