---
version: alpha
name: Green Goods Installed PWA Dialect
description: Mobile-first gardener field-tool overlay for the Warm Earth core DesignMD tokens.
extends: ../../DESIGN.md
surface: client-pwa
dialect: installed-pwa
---

# Green Goods Client PWA — Design Brief

> Installed PWA creative direction for the gardener-facing field tool. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

## Surface Identity

| Mode | Detection | Audience | Metaphor | Paradigm | Navigation |
|------|-----------|----------|----------|----------|------------|
| **Installed PWA** | `display-mode: standalone` | Gardeners | Working in the garden | Command Surface | Bottom `AppBar`: Home, Garden, Profile |

**Hard rule:** Installed PWA = app. Use bottom `AppBar`; never show the browser `SiteHeader` or hamburger chrome.

**Routing:** `PlatformRouter` checks `isInstalled`. Installed PWA routes to `/home`.

---

## The Field Tool

**Physical metaphor:** A gardener's well-worn journal. Practical, personal, tactile.

**Layout philosophy:**
- Mobile-first, thumb-zone optimized
- AppBar: 3 tabs — Home (with notification badge), Garden, Profile
- AppBar hides on `/garden` and `/work/:id` routes for immersive work capture
- SyncStatusBar sits above AppBar
- Content height: `calc(100lvh - 69px)` minus AppBar
- Safe areas: `env(safe-area-inset-bottom)` for notched devices

**Typography:**
- Inter only — no serif. This is a tool, not a magazine.
- Client typography utilities: `.title-screen`, `.title-section`, `.body-md-regular`, `.label-md`
- Compact type scale — body-sm and label-md are the workhorses

**Content hierarchy:**
1. Active garden context — always visible, always grounding
2. Work in progress — drafts, submissions, the thing you're doing now
3. Garden activity — what others are contributing
4. Your impact — personal contribution history

**Offline behavior:**
- Warm, reassuring offline indicators — not error-red
- SyncStatusBar shows sync state above AppBar
- Draft persistence is invisible — you never lose work

**Window Controls Overlay:** CSS is ready for desktop PWA titlebar integration (`.app-titlebar` with `app-region: drag`). Currently prepared but not active in components.

---

## Color Adaptation

The PWA inherits the Warm Earth core. The current green rhythm is protected:
- Bright tertiary garden green stays on icons, active nav states, badges, progress, soft highlights, and value-flow indicators.
- Text-bearing filled CTAs use contrast-safe action tokens, not bright green with white body text.
- No PWA-specific token overrides; values come from shared tokens.

**Dynamic garden theming** (future): Each garden can tint the experience with accent color derived from its banner image. Foundation palette remains — only the accent shifts.

---

## Do's and Don'ts

**Do:**
- Test PWA layouts at 375px and on a real phone when layout or navigation changes
- Preserve the bright green accent rhythm in `/home`, `/garden`, and `/profile`
- Use container queries for components that can appear in both client modes
- Keep copy warm, personal, and community-facing

**Don't:**
- Show `SiteHeader` or hamburger navigation in installed PWA mode
- Use editorial serif in the PWA — it is an app, not a magazine
- Replace bright accent states with admin workspace colors
- Make the funding or submission flow feel transactional
