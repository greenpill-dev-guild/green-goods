# Figma Make Prompts — Phase 2: Content Design (Additive)

**Created**: 2026-04-07
**Purpose**: Add real content, atmosphere, and interaction design to the existing Phase 1 spatial state frames
**Strategy**: Each prompt MODIFIES an existing frame — no new pages. Saves credits, maintains consistency.

## Base Frames (from Phase 1)
- **Resting State** — cockpit at rest with placeholder blocks
- **Right Sheet** — right sheet open with placeholder content

---

## Prompt 1 → Modify Resting State into Hub (Impact Pipeline)

> Take the existing resting state frame and replace all placeholder content — don't create a new frame:
>
> **Ground:** Add warm amber atmosphere — rgba(245, 158, 11, 0.05) radial gradient, centered, ellipse shape, fading to transparent. Barely visible, just a warm glow in the 24px margins around the canvas.
>
> **Top axis:** Keep the floating elements. Change the chip text to "Milpa Alta" with a seedling icon. Keep right-side icons.
>
> **Nav bar:** 4 items — "Hub" (active, green icon + pill), "Garden" (gray), "Community" (gray), "Actions" (gray).
>
> **Canvas content — this is the Hub workspace:**
>
> 1. HEADER: "Hub" in 28px semibold. Below: "Milpa Alta — impact pipeline" 14px gray.
>
> 2. PIPELINE TABS (16px below header): 4 pill-shaped segments in a segmented control bar, full canvas width, 36px tall:
>    - "Review" — active (white bg, shadow), with amber badge "12"
>    - "Assess" — inactive, with small badge "5"
>    - "Certify" — inactive, with small badge "3"
>    - "History" — inactive, no badge
>
> 3. TOOLBAR (12px below): search input left (300px, pill, border), sort dropdown right ("Newest").
>
> 4. WORK CARD LIST (12px below, full width, 8px gap between cards — keep it tight and dense):
>
>    Each card: full width, 12px rounded corners, 1px border #E5E5E5, white bg, 14px padding. A 3px colored left-edge stripe indicates status. Layout: 64×64px photo thumbnail (rounded-8px) on left, then text stack on right.
>
>    Card 1: Amber left stripe. Garden photo thumbnail. "Planted 50 native saplings" 15px semibold. "Maria Garcia · Milpa Alta" 13px gray. Bottom row: green "Agro" chip (leaf icon) + 4 small circles (1 green filled, 3 hollow — meaning "submitted") + "2h ago" right-aligned 12px gray.
>
>    Card 2: Amber stripe. Compost photo. "Composting workshop completed" · "Juan Perez · Xochimilco" · orange "Waste" chip · 1 filled dot · "3h ago"
>
>    Card 3: Green stripe. Solar panel photo. "Installed 2 solar panels" · "Ana Lopez · Milpa Alta" · amber "Solar" chip · 2 filled dots · "1d ago"
>
>    Card 4: Green stripe. Garden beds photo. "Built 3 raised garden beds" · "Carlos Mendez · Milpa Alta" · "Agro" chip · 3 filled dots · "2d ago"
>
>    Card 5: Red stripe. Slightly faded (opacity 90%). Low-quality photo. "Planted herbs in containers" · "Diego Flores · Xochimilco" · "Agro" chip · 1 red filled dot, 3 hollow · "5h ago"
>
>    Fit all 5 cards in the visible canvas without scrolling. The photo thumbnails ground each card in real work. Status stripes create a visual rhythm: amber-amber-green-green-red.
>
> 5. FAB: Bottom-right of canvas, 24px from right and bottom edges of the canvas (inside the canvas, not the viewport). 56px green circle, white "+" icon, soft green shadow.
>
> Make the cards dense and content-rich, not spacious. This is a work queue — operators scan quickly. Photos and status stripes do the heavy lifting, not whitespace.

---

## Prompt 2 → Modify Resting State into Actions Registry

> Take the resting state frame and make these changes — or duplicate the Work Pipeline frame and modify it:
>
> **Ground atmosphere:** Change the gradient from amber to earth terracotta — use rgba(217, 119, 6, 0.04) instead.
>
> **Canvas content — replace everything inside with:**
>
> Heading "Actions" 28px semibold, subtitle "Browse and manage action templates" 14px gray.
>
> Toolbar row: search input (300px, pill-shaped), then a row of 5 filter chips (8px gap between them, each 32px tall, pill-shaped): "All" is active (light green background, green text, checkmark icon), "Solar" inactive (gray background, sun icon in amber), "Agro" (leaf icon in green), "Education" (book icon in blue), "Waste" (recycle icon in orange). Sort dropdown on the right.
>
> Below: a 3-column grid of cards, 16px gap, 2 rows = 6 cards total. These are HERO IMAGE cards — each card has:
> - A full-width photo on top, about 160px tall, covering the card width, with rounded top corners
> - Below the image: 16px padding, title in 16px semibold, 2-line description in 13px gray, bottom row with domain chip and date range
>
> Cards:
> 1. Photo of tree planting. "Plant Native Trees" · description · Agro chip · "Mar 1 – Jun 30"
> 2. Photo of solar installation. "Install Solar Panels" · Solar chip · "Apr 1 – Sep 30"
> 3. Photo of outdoor classroom. "Composting Workshop" · Education chip · "Ongoing"
> 4. Photo of rain garden. "Build Rain Gardens" · Agro chip · "May – Aug"
> 5. Photo of waste sorting. "Community Waste Audit" · Waste chip · "Monthly"
> 6. Photo of seedling nursery. "Native Seedling Nursery" · Agro chip · "Year-round"
>
> Cards should feel like seed packets — visual, inviting. No left-edge stripes (those are for status, actions don't have status).
>
> **Nav bar:** Make the 4th item (Actions) active green. Others gray.

---

## Prompt 3 → Modify Resting State into Garden Overview

> Take the resting state frame and modify:
>
> **Ground atmosphere:** Change to sage green — rgba(52, 211, 153, 0.05).
>
> **Canvas content:**
>
> Heading "Garden" 28px semibold. Below: small pin icon + "Milpa Alta · Mexico City, Mexico" 14px gray.
>
> Segmented buttons (320px, 3 segments): "Overview" active, "Impact" inactive, "Settings" inactive.
>
> Below: a 4-column stats grid, 12px gap. Each stat card is a small rectangle (border, rounded 12px, white, 16px padding) with:
> - A 40px colored icon circle (green for gardeners, blue for work, amber for assessments, purple for TVL)
> - Below the icon: label in 11px uppercase gray tracking-wide (like "GARDENERS")
> - Below the label: large value in 24px semibold (like "24") with a small green trend indicator "↑12%" next to it
>
> Stats: Gardeners 24 ↑12%, Work Submitted 147 ↑8, Assessments 12 ↑3, TVL $4,280 ↑8.2%
>
> Below stats (32px gap): section header "Recent Activity" 16px semibold.
>
> Below: 3 panoramic activity cards, full width, 10px gap. Each card has:
> - A 3px left stripe (green or amber for status)
> - A full-width panoramic photo, 100px tall, with a gradient overlay fading from transparent to near-white at the bottom
> - Text overlaid on the gradient at bottom: title + person name 14px, and value chain dots on the right
>
> Card 1: Green stripe. Photo of planted saplings. "Planted 50 native saplings · Maria Garcia" ●●○○
> Card 2: Amber stripe. Photo of composting. "Composting workshop · Juan Perez" ●○○○
> Card 3: Green stripe. Photo of solar panels. "Installed 2 solar panels · Ana Lopez" ●●●○
>
> **Nav bar:** Garden (2nd item) active green.

---

## Prompt 4 → Modify Work Pipeline to Show Hover State

> Take the Work Pipeline frame (with real content) and modify just the cards to show interaction states:
>
> **Card 2** (the composting card) — show it in a HOVER state:
> - Make it very slightly larger than the other cards (barely perceptible, like 1-2px bigger on each side)
> - Change its shadow to a soft green-tinted glow: something like a 4px spread, 16px blur, using the green brand color (#1FC16B) at about 10% opacity
> - Change its border to a subtle green tint (the green at about 20% opacity)
> - Add an expanded section below the existing card content: a thin gray divider line, then 2 lines of description text in 13px ("Strong evidence of composting with clear before/after photos. Workshop documentation includes attendance records."). This expands the card by about 48px.
>
> **Card 4** (the garden beds card) — show it in FOCUS state:
> - Keep it the same size (no scale change)
> - Add a soft green ring around the entire card: 3px green glow (#1FC16B at 20% opacity) around the outside
> - No content expansion
>
> **All other cards** stay in their normal rest state for comparison.
>
> Everything else stays the same — atmosphere, layout, nav bar, top axis.

---

## Prompt 5 → Modify Right Sheet with Settings Content

> Take the existing right sheet frame and make these changes:
>
> **Make the sheet wider** — instead of its current width, make it roughly 50% of the content zone width (about half the space between the left and right margins).
>
> **Replace the placeholder rows inside the sheet with real settings content:**
>
> Top: "Settings" in 20px semibold, with a close X button on the right. Divider line below.
>
> Profile section: user avatar circle (56px, with a small green dot), next to it: name "Afo" in 16px semibold, below that a small green-tinted pill chip saying "Deployer", below that a short address "0x1a2b...3c4d" in monospace gray with a tiny copy icon.
>
> Divider.
>
> Theme section: label "THEME" in small uppercase gray. Below: a segmented control spanning the full sheet width with 3 options — "Light" (active), "Dark", "System".
>
> Divider.
>
> Network section: label "NETWORK". Below: a small card with a chain icon, "Arbitrum One" in semibold, and a green status dot. Below that: "Chain ID: 42161" in small gray text.
>
> Divider.
>
> Sync section: label "SYNC". Below: green dot + "Synced 2 minutes ago" in 13px.
>
> Divider.
>
> At the bottom: "Disconnect Wallet" as a text button in red (#FB3748), centered.
>
> **The canvas behind should still show the receded Work Pipeline content** (faded, scaled down, slightly blurred). Keep the amber atmosphere visible in the margins.
>
> Top axis and nav bar stay visible — the sheet lives between them.

---

## Prompt 6 → New Frame: Connect Wallet

> Create a new frame, 1440×900px. This is the non-authenticated state — before the user enters the cockpit.
>
> Background: #F7F7F7 with a very subtle green radial gradient — rgba(31, 193, 107, 0.04) centered. Just a whisper of green.
>
> No top axis elements. No navigation bar. No white canvas surface. The screen is completely open — unframed.
>
> Center content (vertically and horizontally centered):
> - A simple seedling illustration, about 120×120px. Line-art style: a small plant with two leaves growing from a soil line. Use green (#1FC16B) for the leaves and stem, earth brown (#A3886A) for the soil. Friendly, hand-drawn feel.
> - Below (32px gap): "Green Goods" in 36px semibold, dark text.
> - Below (8px): "Connect your wallet to continue" in 16px regular gray.
> - Below (28px): a pill-shaped button, 220px wide, 48px tall, green (#1FC16B) background, white text "Connect Wallet" 16px semibold. Give it a soft green shadow (the green color at 25% opacity, 4px spread, 16px blur).
> - Below (16px): "Admin dashboard for garden operators" in 14px light gray.
>
> The feeling: standing at the garden gate before entering. Calm, patient, inviting. The green atmosphere on the empty ground says "welcome."

---

## Usage Notes

- **Prompts 1-5 modify existing frames** — tell Figma Make to update, not create new. This saves credits.
- **Prompt 6 is the only new frame** — Connect Wallet has no spatial chrome so it can't build on the resting state.
- **Order matters**: Do Prompt 1 first (Work Pipeline), then Prompt 4 (hover state) since it modifies Prompt 1's output. Do Prompt 5 after Prompt 1 since the receded canvas should show Work Pipeline content.
- If Figma Make creates a new page despite being asked to modify, use **point-and-edit** to adjust the existing frame instead of re-prompting.
