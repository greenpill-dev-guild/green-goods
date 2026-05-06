---
version: alpha
name: Green Goods Client Design Index
description: Routing guide for the Green Goods client dialects. The installed PWA and public browser modes are separate Warm Earth overlays.
extends: ../../DESIGN.md
surface: client
dialects:
  pwa: packages/client/DESIGN.pwa.md
  browser: packages/client/DESIGN.browser.md
---

# Green Goods Client — Design Index

The client package serves two experiences from one codebase. Do not prompt, review, or implement client UI from this index alone; pair the root `DESIGN.md` with the dialect file that matches the surface.

| Dialect | Detection | Audience | Design File | Navigation |
|---------|-----------|----------|-------------|------------|
| Installed PWA | `display-mode: standalone` | Gardeners | `packages/client/DESIGN.pwa.md` | Bottom `AppBar` with Home, Garden, Profile |
| Public browser | Standard browser visit | Funders, community members | `packages/client/DESIGN.browser.md` | `SiteHeader` with mobile hamburger and desktop links |

Hard rule: Browser = website with `SiteHeader` at the top. Installed PWA = app with bottom `AppBar`. Never mix the chrome, typography emphasis, or copy voice between the two dialects.
