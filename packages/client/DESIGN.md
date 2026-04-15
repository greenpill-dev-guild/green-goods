# Green Goods Client — Design Brief

> Surface-specific creative direction for the client package. **Must be combined with the root DESIGN.md** when feeding to AI tools: `cat ../../DESIGN.md DESIGN.md | pbcopy`

## Surface Identity

The client serves **two experiences** from one codebase:

| Mode | Detection | Audiences | Metaphor | Paradigm | Navigation |
|------|-----------|-----------|----------|----------|------------|
| **Browser** | Standard browser visit | Funders, Community members | Walking through the garden | Per-route: Ambient Display (editorial) / Data Landscape (browse/fund) | SiteHeader: hamburger (mobile) + horizontal links (desktop) |
| **PWA** | `display-mode: standalone` | Gardeners | Working in the garden | Command Surface | AppBar: bottom nav (Home, Garden, Profile) |

**Hard rule:** Browser = website (SiteHeader at top). PWA = app (AppBar at bottom). Never mix.

**Routing:** PlatformRouter checks `isInstalled`. PWA → `/home`. Browser → `/gardens`.

---

## Browser Mode — The Garden Gallery

**Physical metaphor:** A coffee-table book about community gardens crossed with a farmers market directory.

**Layout split:**
- **Garden & impact pages** → Editorial lookbook. Full-width imagery, large typographic headings over images. Serif display headlines. The visitor feels *in* the place where the garden grows.
- **Funding & browsing pages** → Marketplace directory. Structured cards, auto-fill grid, filter toolbar. Each garden is a market stall — colorful, distinct, alive.

**Typography:**
- Headlines use the **serif display font** (Fraunces/Lora/Newsreader) — the one surface with editorial weight
- Body stays Inter — the serif is the chapter heading, not the paragraph
- Large typographic headings over imagery, luxury-travel-magazine scale

**Navigation (SiteHeader):**
- Desktop (≥768px): horizontal links — Gardens, Actions, Impact, Fund — plus Connect Wallet button
- Mobile (<768px): hamburger icon → left-slide drawer (w-72) with stacked nav links
- Sticky, with backdrop blur

**Imagery direction:**
- Real community gardens, real people, real soil — not stock photography
- Cinematic photography of the places where gardens grow — the neighborhood, the context
- Show the *scale* and *place*, not cliché "hands holding seedlings"
- Garden cards should feel like market stalls — each one distinct and alive

**Content hierarchy:**
1. Hero statement — what Green Goods is, one emotional sentence
2. Featured gardens — editorial spread, 2-3 spotlights
3. All gardens — marketplace browse (auto-fill grid)
4. Impact metrics — community-wide numbers, understated but present
5. Fund — clear CTAs, garden-specific funding flows

**Progressive disclosure applied:**
- Glance: garden card shows name, location, season status
- Scan: garden card shows member count, recent action count, funding status
- Engage: garden detail page with full story, work timeline, impact data
- Deep Dive: on-chain verification, attestation details, audit trail

---

## PWA Mode — The Field Tool

**Physical metaphor:** A gardener's well-worn journal. Practical, personal, tactile.

**Layout philosophy:**
- Mobile-first, thumb-zone optimized
- AppBar: 3 tabs — Home (with notification badge), Garden, Profile
- AppBar hides on `/garden` and `/work/:id` routes (immersive content)
- SyncStatusBar positioned above AppBar
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

Both modes inherit the foundation color hierarchy. No client-specific token overrides — all from shared.

Browser mode may use slightly more generous tertiary (green) in CTAs since editorial layouts have more breathing room. PWA stays tighter — green only on primary actions.

**Dynamic garden theming** (future): Each garden can tint the experience with accent color derived from its banner image. Foundation palette remains — only the accent shifts.

---

## Do's and Don'ts

**Do:**
- Test every browser layout at 1440px, 1024px, 768px, 375px
- Use container queries for components that live in both modes
- Give garden cards enough visual variety that the marketplace feels alive
- Use `content-visibility: auto` for long garden/work lists

**Don't:**
- Show AppBar (bottom nav) in browser mode
- Show SiteHeader (hamburger) in PWA mode
- Use editorial serif in the PWA — it's an app, not a magazine
- Make the funding flow feel transactional — it should feel like watering a garden
