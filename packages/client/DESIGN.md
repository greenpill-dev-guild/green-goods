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

# Green Goods Client: Design Index

The client package serves two experiences from one codebase. Do not prompt, review, or implement client UI from this index alone; pair the root `DESIGN.md` with the dialect file that matches the surface.

| Dialect | Detection | Audience | Design File | Navigation |
|---------|-----------|----------|-------------|------------|
| Installed PWA | `display-mode: standalone` | Gardeners | `packages/client/DESIGN.pwa.md` | Bottom `AppBar` with Home, Garden, Profile |
| Public browser | Standard browser visit | Funders, community members | `packages/client/DESIGN.browser.md` | `SiteHeader` with mobile hamburger and desktop links |

Hard rule: Browser = website with `SiteHeader` at the top. Installed PWA = app with bottom `AppBar`. Never mix the chrome, typography emphasis, or copy voice between the two dialects.

## Waits

Both dialects follow the waiting rule in the quality contract (PRD-1495). Within 2 seconds a wait names what it waits for, and a send's stage is said in the shared words (`modules/transactions/send-stage`): "Confirm in your wallet" while the wallet is asked, "Confirming…" while the network confirms, and "Still confirming…" once a send outlasts its 120 second receipt wait, with the sentence that it went out and the gardener can leave without sending it again. The queue reports each send's stage on the work it carries, however the send started (Upload now, Upload all, or the background send), so the Work page's footer and Your Work's rows say it without wiring it themselves. A wait on the wallet has no cut-off: at 20 seconds it says to open the wallet and offers Cancel. Nothing reads as failed while a send may still land.
