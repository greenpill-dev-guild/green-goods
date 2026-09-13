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

**Routing:** presentation-mode loaders gate browser vs PWA entry. Installed/authenticated PWA routes live under `/home` and render through `PwaRuntime` + `AppShell` with the bottom `AppBar`.

---

## The Field Tool

**Physical metaphor:** A gardener's well-worn journal. Practical, personal, tactile.

**Layout philosophy:**
- Mobile-first, thumb-zone optimized
- AppBar: 3 tabs — Home (with notification badge), Garden, Profile
- AppBar hides for immersive surfaces: garden routes (`/home/garden/*`), work detail (`/home/:id/work/:workId`), commitment detail/composer routes (`/home/:id/commitments/*` — they carry their own fixed action bar exactly where the nav would sit), and whenever any sheet or dialog is open (DL-015). Sheet primitives register themselves while open, so there is no list of sheets to keep in sync
- Sheet heights (DL-014): every bottom sheet names one tier and never sets its own height. `compact` sizes to its content up to 50% (confirmations, resume prompts, gardener and badge details, profile photo); `half` holds 50% (short choices: take a commitment up); `tall` holds 70% (lists and forms: notifications, garden filters, link work, request to join, withdraw an offer); `full` holds 85% (tabbed workspaces and long reviews: wallet, commitments, your work, endowment, vault checkout, confirm a commitment). Photo viewers and public records open full screen
- Sheet actions (DL-016): every sheet and dialog pins its actions in the shared action bar (`SheetActions`, through the `actions` prop of `PwaSheet`, `DialogShell`, `ConfirmDialog`, and `AppSheet`), under a body that scrolls above it; no sheet renders its own action buttons. Below 640px the actions stack full width with the primary on top: a filled primary (the error fill when destructive), then an outlined second action, Cancel included, and a text action only for a rare third choice. Step navigation (Back / Continue, as in wallet send) keeps one row. From 640px the same bar is one right-aligned row with the primary rightmost. Labels wrap rather than cut off, and a loading action stays focusable. Page-level bars (Submit Work, work approval, commitment detail) are not sheets and keep their own layout
- Garden header (DL-020): page actions (notifications, endowment, share) are 32px icon buttons stacked in the banner's top right, with Share last so the others keep their places. The title row carries at most one text action, Join Garden or Request to Join, at the `compact` button size (32px tall, 14px label, no icon, 48px tap area), and its location and founded lines truncate instead of running under the button
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
- Bright tertiary garden green stays on text-free marks: icons, active nav states, dots, progress lines, soft highlights, and value-flow indicators.
- Any green fill that carries text, a number, or a glyph (filled CTAs, count badges, step markers, selected chips, pills) uses the contrast-safe action tokens with white text, never bright green (DL-017).
- No PWA-specific token overrides; values come from shared tokens.

**Dynamic garden theming** (future): Each garden can tint the experience with accent color derived from its banner image. Foundation palette remains — only the accent shifts.

---

## Forms and Lists

- Every form field reserves two lines (`min-block-size: 2lh`, 32 px at 12/16 px type) under its control for a hint or error, and fields in a form sit 8 px apart. A longer message grows the slot instead of scrolling inside it (DL-018).
- Work and draft cards in lists use a fixed 88 px square thumbnail with the photo positioned inside it, so a photo's shape never sets the card's height (DL-019).

---

## Do's and Don'ts

**Do:**
- Test PWA layouts at 375px and on a real phone when layout or navigation changes
- Preserve the bright green accent rhythm in `/home`, `/home/garden`, and `/home/profile`
- Use container queries for components that can appear in both client modes
- Keep copy warm, personal, and community-facing

**Don't:**
- Show `SiteHeader` or hamburger navigation in installed PWA mode
- Use editorial serif in the PWA — it is an app, not a magazine
- Replace bright accent states with admin workspace colors
- Make the funding or submission flow feel transactional
