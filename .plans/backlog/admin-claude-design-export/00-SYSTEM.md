# 00 — Green Goods Admin · Design System Context

> **Read this first, in every Claude Design session.** It establishes the design system, the constraints, and the validated direction signals. After reading this, switch to the per-view prompt (`01-HUB.md`, `02-GARDEN.md`, `03-COMMUNITY.md`, or `04-ACTIONS.md`) for what to actually produce.

---

## 1. Session model

- **Surface**: Desktop admin cockpit (operators, evaluators) — not the public client PWA.
- **Routes in scope (one per session)**: `/hub`, `/garden`, `/community`, `/actions`.
- **Each session asks for 2 direction variations** of one view. No multi-view requests in a single session.
- **Files to feed each session**: this file + the per-view prompt + `reference-image.png` + the design system files (`DESIGN.md`, `DESIGN.admin.md`, `theme.css`, `design-md.generated.json`) + the relevant screenshots subset (per the per-view prompt's "Screenshots" section).

---

## 2. Reference image — north star

`reference-image.png` is the aesthetic direction the user has already validated. **Match or exceed it.** It's not one option among many. The following elements are validated direction signals, not invitations to discard:

- **Card grammar (defined for `/hub`, adapt for other views)**: photo-collage top with `1/N` page indicator, work-category badge with leaf/trash/sun icon prefix, colored top-edge accent border for state (green / amber / red), title + author·garden, status-dot pipeline indicator (3–4 dots filled), relative time bottom-right.
- **Restrained green accent** with discipline (~3% pixel area). The accent appears in active tab fill, FAB, status dots, button primary, focus ring — and almost nowhere else. No flooding the canvas with green.
- **Segmented tab control** (full-width fill, mint-tinted active, count badges as small pills) instead of M3 underline tabs.
- **Floating chrome**: light top bar with garden-context pill (leading) + status / notifications / settings / avatar (trailing); floating bottom NavigationBar pill; primary green FAB anchored bottom-right.
- **Soft warm cream canvas** with a barely-perceptible pale-green wash gradient toward bottom-right.
- **Density without cramping**: generous gutters, clear breathing room around the tab rail.

**Important**: the reference image renders the `/hub` route. The per-view prompts show how the same grammar adapts to each view's content (different card composition for `/garden` vs `/community` vs `/actions`).

---

## 3. Tier 1 — Immutable (do not invent)

These are not negotiable. Variations that violate Tier 1 are rejected without further review.

### 3.1 Routes and IA

The admin has **exactly four workspace routes** — see per-view prompts for what each does. Do not propose new routes. Do not rename routes. Do not propose merging routes. Do not propose `/journals`, `/sites`, `/feed`, `/dashboard`, `/inbox`, `/settings` as top-level workspace routes.

### 3.2 Domain entities (vocabulary)

Canonical names — do not alias, do not "rebrand":

- **Garden** (a community of practice — NOT "site," "field," "project," "space," "node," "hub").
- **Operator** (the role tending a garden — NOT "steward," "captain," "manager," "lead").
- **Work** (the unit of regenerative work — NOT "submission," "entry," "task," "field note," "post," "story").
- **Action** (the template type that work fulfills — NOT "category," "type," "kind," "challenge").
- **Assessment** / **Certification** / **Hypercert** are the impact-bundling entities downstream of work — keep these names.

### 3.3 Banned vocabulary

Any surface: `streak`, `countdown`, `leaderboard`, `FOMO`, `urgent`, `limited time`, `re-engagement`, `retention hook`. Admin specifically: `hero moment`, `gallery`, `decorative gradient`, `marketing banner`, glass outside the AppBar, `KPI tile` framing, `dashboard` framing.

### 3.4 M3 strict anchor

Material Design 3 v0.192 is the **strict structural backbone**. Every component must resolve to one of M3's standard:

- **Sizes** (button / input heights): **40 / 48 / 56**. Pick one as default per variation; do not mix more than two in the same variation.
- **Shape scale**: none 0 / xs 4 / sm 8 / md 12 / lg 16 / xl 28 / full 9999.
- **Elevation scale**: 0–5 with M3 shadow values.
- **State layers**: hover 8% / focus 12% / pressed 12% / dragged 16%.

Spring motion tokens (`--spring-*`) are the sole permitted deviation from M3 standard easing.

### 3.5 Component palette (don't invent)

Variations must compose from the existing palette:

- **Admin primitives** (14): `AdminButton`, `AdminCard`, `AdminTextField`, `AdminCheckbox`, `AdminBadge`, `AdminFilterChip`, `AdminTabRail`, `AdminListItem`, `AdminTooltip`, `AdminLinearProgress`, `AdminFab`, `AdminDialog`, `AdminSearchToolbar`, `ConnectButton`.
- **Canvas shells**: `CanvasLayout`, `AppBar`, `NavigationBar`, `MainSheet`, `LeftSheet`, `RightSheet`, `BottomSheet`, `FabContext`, `EmptyStateShell`.

If a variation needs something the palette can't express, **flag it as a missing primitive** in the rationale — don't smuggle it in as a one-off.

### 3.6 Shell composition

The shell is locked across all four routes. Do not propose alternative shell structures per view.

- **Top**: AppBar with garden-context pill (leading) + status / notifications / settings / avatar (trailing).
- **Center**: MainSheet hosting the route content.
- **Bottom**: floating NavigationBar pill (4 tabs: Hub / Garden / Community / Actions) + AdminFab anchored bottom-right.
- **Sheets**: LeftSheet / RightSheet / BottomSheet open over MainSheet for detail / filters / forms.

What can vary across views: page header weight, card composition, filter affordances, default sort, empty-state messaging — see per-view prompts.

---

## 4. Tier 2 — Preferred (tunable within the spirit)

Honor unless explicit Tier 3 divergence in the per-view prompt; divergence must be justified.

- **Warm Earth palette** (`design-md.generated.json`): warm cream / off-white canvas, deep warm charcoal ink, warm stone secondary, single confident accent green at the tertiary role, terracotta amber for warning, sky for info. **Codebase's `--color-primary` resolves to the green accent** (internal naming legacy — don't rename).
- **4-role volume hierarchy**: canvas 80–90% / ink 8–15% / stone 3–5% / accent green 1–3%. Flooding the canvas with green is the failure mode to avoid.
- **Typography**: Plus Jakarta Sans for the admin dialect (operator cockpit voice — not the client's Inter). No serif display faces in admin. Type scale: body-md 16/24, label-md 12/16, app-title 22/28.
- **Spring motion**: 6 tokens for sheet transitions, FAB lift, tab change, hover. No raw `cubic-bezier` invention.
- **Liquid Glass restricted to AppBar** — no blur / translucency on M3 components, sheets, or cards.

---

## 5. Quantitative anti-patterns (current admin pain → constraint)

The current admin has known structural drift. Variations must explicitly resolve it. These are quantitative — verify against your output:

- **Nesting**: compose from at most **2 nesting levels under `MainSheet`**. No `Surface → Surface → Card` stacks. The current admin has 4+ padding-bearing wrappers in places; this is the single biggest source of visual drift.
- **Control sizing**: every button, input, chip, filter must resolve to one of M3's three standard heights (**40 / 48 / 56**). Zero bespoke heights.
- **Dark-mode contrast**: every surface / text token pair must hit **WCAG AA (4.5:1 body, 3:1 large text)** in dark mode. Show the contrast table.
- **Tertiary accent budget**: the green accent occupies **≤ 3% of pixel area** on the rendered route at rest. Measure it.
- **Padding ownership**: padding lives on **the outermost component only**. Inner components do not double-pad.
- **Card affordance**: each card has at most **one primary affordance** (click → detail). Multi-action cards split into list rows or expanded sheet.

---

## 6. Output format (per session)

Each per-view session produces **2 direction variations**. For each variation:

1. **Name + 200–300 word rationale** — what's the design idea, which structural pain it solves, which 2–3 Tier 3 axes it leans on (Tier 3 axes are listed in the per-view prompt), what the user is asked to give up.
2. **Light + dark renders** of the route at desktop viewport (~1440×1024).
3. **Token contrast table** for dark mode showing surface / text token pairs and their WCAG ratios.
4. **Composition note** — list the `Admin*` primitives and Canvas shells used. Flag any missing primitives.
5. **Pixel-area budget check** — confirm tertiary accent ≤ 3% on the rendered route.

Skip cover slides, decks, marketing framing.

---

## 7. Asset map (in this folder)

| File | Role |
|------|------|
| `READ-ME-FIRST.md` | Bundle entry doc — session model and feeding order. |
| `00-SYSTEM.md` | This file — read once per session. |
| `01-HUB.md` … `04-ACTIONS.md` | Per-view prompts — pick one per session. |
| `reference-image.png` | North star (see § 2). Include in every session. |
| `DESIGN.md` | Root canonical design system (Warm Earth core). |
| `DESIGN.admin.md` | Admin cockpit dialect — strict M3 + Plus Jakarta Sans. |
| `theme.css` | Runtime token projection (CSS custom properties). |
| `design-md.generated.json` | Machine-readable token export. |
| `screenshots/shell/` | AppBar, NavigationBar, MainSheet, FAB, sheets. Include in every session. |
| `screenshots/primitives/` | All 14 `Admin*` primitives. Include in every session. |
| `screenshots/tokens/` | Color, typography, animation, shadow surfaces. Include in every session. |
| `screenshots/hub/`, `screenshots/garden/`, `screenshots/community/`, `screenshots/actions/` | Per-route renders. Include only the relevant route's folder per session. |

**Fallback intake**: if claude.ai/design does not accept folder drops, the text bundle (DESIGN.md dialects, theme.css, generated tokens, manifest) is also fetchable at `https://design.greengoods.app/` — see `storybook-design-manifest.json` `toolImports[1]` for the documented Claude Design entry. Only the screenshots and these prompt files are local-bundle-only.

---

## 8. What "good" looks like across all variations

A successful variation will:

- Make the user say "yes, that's the system, evolved" — not "is this still Green Goods?"
- Solve the dark-mode contrast problem visibly.
- Compose from at most 2 nesting levels under `MainSheet`.
- Use one default control height across the variation.
- Stay inside the ~3% tertiary accent budget.

A failed variation will:

- Propose new routes, components, or vocabulary.
- Flood the canvas with green.
- Defer dark mode ("light only for now").
- Mix more than two control heights.
- Add nested padding-bearing wrappers (Surface → Surface → Card).

---

End of system context. Switch to the per-view prompt for what to produce in this session.
