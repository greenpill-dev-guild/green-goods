# Admin Home View — Design Spec

**Date:** 2026-04-14
**Branch:** `feature/admin-ui-revamp`
**Sub-project:** 3 of 3 (home view for unauthenticated state)

## Problem

Unauthenticated users currently land on `/hub/work` and see a `ConnectShell` rendered inline by CanvasLayout. This applies the hub workspace tint (blue) to an unauthenticated user who has no context for what "hub" means. There's no dedicated home/landing state with its own visual identity.

## Design

### Route

- **`/`** — root route, dedicated to unauthenticated state
- Unauthenticated users redirect to `/` from any route
- After wallet connect, redirect to `/hub`
- Authenticated users hitting `/` redirect to `/hub`

### Workspace Identity

- `data-workspace="home"` — new workspace with stone/brown neutral palette
- Warm, earthy tones using Tailwind stone scale
- Provides a neutral base that doesn't bias toward any workspace color

### Visual Treatment

- **AppBar:** Seedling icon + "Green Goods" branding on left. No action icons on right (no search, notifications, settings, profile)
- **MainSheet:** Connect prompt — seedling illustration, "Connect to continue" title, "Connect your wallet to access this feature" description, wallet connect button
- **NavigationBar:** Hidden (no routes to navigate)
- **Canvas gradient:** Stone-tinted atmospheric background

### CSS: Home Workspace Palette

```css
[data-workspace="home"] {
  --ws-primary: 120 113 108;        /* stone-500 */
  --ws-on-primary: 255 255 255;
  --ws-primary-container: 231 229 228; /* stone-200 */
  --ws-on-primary-container: 41 37 36; /* stone-800 */
  --ws-outline: 168 162 158;        /* stone-400 */
  --ws-surface-variant: 245 245 244; /* stone-100 */
  --ws-surface-tint-color: 120 113 108;
}
```

## Files Changed

- `packages/admin/src/index.css` — add `[data-workspace="home"]` palette
- `packages/admin/src/components/Layout/CanvasLayout.tsx` — home workspace detection, minimal AppBar, redirect logic
- `packages/admin/src/routes/Root.tsx` — add `/` route

## Out of Scope

- Marketing content, feature highlights
- No-garden-access state improvements (already handled in audit fixes)
- Home view for mobile PWA (separate concern)
