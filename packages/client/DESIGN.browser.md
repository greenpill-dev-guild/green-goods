---
version: alpha
name: Green Goods Public Browser Dialect
description: Editorial public-web overlay for the Warm Earth core DesignMD tokens.
extends: ../../DESIGN.md
surface: client-browser
dialect: public-browser
---

# Green Goods Public Browser — Design Brief

> Public browser creative direction for funders, community members, and visitors. Use with the root `DESIGN.md`; lint this overlay and the root file separately.

## Surface Identity

| Mode | Detection | Audiences | Metaphor | Paradigm | Navigation |
|------|-----------|-----------|----------|----------|------------|
| **Public browser** | Standard browser visit | Funders, community members | Walking through the garden | Ambient Display / Data Landscape | `SiteHeader`: hamburger on mobile, horizontal links on desktop |

**Hard rule:** Browser = website. Use `SiteHeader` at the top; never show installed-PWA bottom `AppBar` chrome.

**Routing:** `PlatformRouter` checks `isInstalled`. Browser routes to `/gardens`.

---

## The Garden Gallery

**Physical metaphor:** A coffee-table book about community gardens crossed with a farmers market directory.

**Layout split:**
- **Garden & impact pages** -> Editorial lookbook. Full-width imagery, large typographic headings over images. The visitor feels in the place where the garden grows.
- **Funding & browsing pages** -> Marketplace directory. Structured cards, auto-fill grid, filter toolbar. Each garden is a market stall — colorful, distinct, alive.

**Typography:**
- Headlines may use the serif display font (Fraunces, Lora, or Newsreader) — the one surface with editorial weight
- Body stays Inter — the serif is the chapter heading, not the paragraph
- Large typographic headings over imagery, luxury-travel-magazine scale

**Navigation (`SiteHeader`):**
- Desktop (`>=768px`): horizontal links — Gardens, Actions, Impact, Fund — plus Connect Wallet button
- Mobile (`<768px`): hamburger icon -> left-slide drawer (`w-72`) with stacked nav links
- Sticky, with backdrop blur

**Imagery direction:**
- Real community gardens, real people, real soil — not stock photography
- Cinematic photography of the places where gardens grow: neighborhood, context, scale
- Avoid cliché "hands holding seedlings" as the primary visual language
- Garden cards should feel like market stalls — each one distinct and alive

**Content hierarchy:**
1. Hero statement — what Green Goods is, one emotional sentence
2. Featured gardens — editorial spread, 2-3 spotlights
3. All gardens — marketplace browse with auto-fill grid
4. Impact metrics — community-wide numbers, understated but present
5. Fund — clear CTAs, garden-specific funding flows

**Progressive disclosure applied:**
- Glance: garden card shows name, location, season status
- Scan: garden card shows member count, recent action count, funding status
- Engage: garden detail page with full story, work timeline, impact data
- Deep Dive: on-chain verification, attestation details, audit trail

---

## Color Adaptation

The public browser inherits the Warm Earth core and can use green a little more generously than the PWA because editorial pages have more breathing room.

Text-bearing filled CTAs use contrast-safe action green. Bright tertiary garden green remains for accents, inline emphasis, active nav states, soft backgrounds, garden identity, and value-flow indicators.

---

## Do's and Don'ts

**Do:**
- Test browser layouts at 1440px, 1024px, 768px, and 375px
- Let real garden imagery carry the first impression
- Give garden cards enough visual variety that the marketplace feels alive
- Use `content-visibility: auto` for long garden/work lists

**Don't:**
- Show installed-PWA bottom `AppBar` in browser mode
- Make the public site feel like an admin dashboard or KPI grid
- Use utility copy where a visitor needs a warmer narrative bridge
- Make the funding flow feel transactional — it should feel like watering a garden
