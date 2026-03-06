# Storybook & Design System Plan

> **Created**: 2026-02-23
> **Status**: Planning
> **Scope**: Storybook audit, Figma bridge, component organization, AI agent workflow

---

## 1. Current State Audit

### Configuration (Grade: A)

Storybook lives exclusively in `@green-goods/shared` at `packages/shared/.storybook/`.

| File | Purpose | Status |
|------|---------|--------|
| `main.ts` | CSF3 + React-Vite + Tailwind v4 via `@tailwindcss/vite` | Solid |
| `preview.tsx` | Theme toggle decorator (light/dark via `data-theme`) | Partial — missing i18n, Query, Wagmi |
| `manager.ts` | Branded sidebar with `showRoots: true` | Good |
| `theme.ts` | Green Goods palette (#1FC16B primary, Inter font) | Good |
| `storybook.css` | Imports shared `theme.css` + typography/shadow/animation tokens | Good |

**Version**: Storybook 10.2.8 (package.json) — stale `storybook-static/` from v8.6.15 still present.

**Addons**: `@storybook/addon-essentials` + `@storybook/addon-a11y`

### Coverage (Grade: F)

| Package | Components | Stories | Coverage |
|---------|-----------|---------|----------|
| `shared` | 44 | 15 | **34%** |
| `admin` | 54 | 0 | **0%** |
| `client` | 44 | 0 | **0%** |
| **Total** | **142** | **15** | **11%** |

### Existing Stories (15 total)

All use CSF3 with `Meta<typeof Component>` + `StoryObj` typing + `tags: ["autodocs"]`.

| Story | Grade | argTypes | Variants | Interactions | Dark Mode |
|-------|-------|----------|----------|-------------|-----------|
| Badge | B+ | Good | Excellent (AllVariants, AllTints) | None | None |
| CardBase | B | Fair | Basic | None | None |
| GardenCard | A- | Fair | Excellent (CardGrid, SelectionList) | None | None |
| WorkCard | B | Fair | Basic | None | None |
| ImageWithFallback | B- | Basic | Basic | None | None |
| FormCheckbox | B | Good | Good | None | None |
| FormInput | B | Good | Good (AllStates) | None | None |
| FormLayout | B+ | Good | Excellent (AllWidths) | None | None |
| FormTextarea | B | Good | Good | None | None |
| Select | B | Good | Good | None | None |
| HydrationFallback | C+ | Minimal | Basic | None | None |
| Spinner | B- | Basic | Basic | None | None |
| StatusBadge | A- | Excellent | Excellent (AllStatuses, SemanticVariant) | None | None |
| Toast | A | Limited | Good | Manual buttons (not `play()`) | None |
| TranslationBadge | B | Fair | Basic | None | None |

### Cross-Cutting Quality Gaps (all 15 stories)

1. **Zero dark mode stories** — toolbar toggle exists but no programmatic side-by-side comparisons
2. **Zero `play()` functions** — no automated interaction testing
3. **No i18n provider** — components using `react-intl` show raw keys
4. **No mock providers** — `QueryClient`, `WagmiConfig`, auth context missing from decorators
5. **No documentation pages** — zero `.stories.mdx` files
6. **No CI integration** — no build, no Chromatic, no visual regression testing
7. **Stale build artifacts** — 1GB `storybook-static/` from v8.6.15 still present

---

## 2. Design Token System Analysis

### Token Inventory (567 tokens total)

| Category | Count | Source File | Figma-Ready? |
|----------|-------|-------------|-------------|
| Color primitives | 119 | `theme.css` | Yes |
| Semantic colors | 118 | `theme.css` | Yes |
| Typography | 25 | `storybook.css` | Partially (split across 2 files) |
| Shadows | 16 | `storybook.css` | Yes |
| Animations | 3 | `storybook.css` | N/A (no Figma equivalent) |
| Overlay & helpers | 35 | `theme.css` | Yes |
| @property defs | 10 | `theme.css` | N/A |
| Container queries | 5 | `theme.css` | N/A |

### Dark Mode Strategy (9/10)

Four-layer architecture — single source of truth:
```
Layer 1: :root { --gray-950, --green-500 }          ← Constant primitives
Layer 2: :root { --bg-white-0, --text-strong-950 }   ← Light mode semantics
Layer 3: :root[data-theme="dark"] { overrides }       ← Dark mode swaps
Layer 4: @theme { --color-bg-white-0: rgb(var()) }    ← Tailwind bridge
```

### Known Issue: "Visual Strength" Naming

Token names represent **visual weight**, NOT literal color:
- `bg-white-0` = weakest bg → white in light, near-black (#171717) in dark
- `bg-strong-950` = strongest bg → near-black in light, near-white (#F5F5F5) in dark
- This is intentional but confusing for Figma designers who think in literal colors

### Token File Separation (correct, non-obvious)

| Concern | `theme.css` | `storybook.css` |
|---------|------------|-----------------|
| Color variables | Defined (primitives + semantic) | Imports via `@import` |
| Typography | `@property` syntax defs only | Full `@theme` block (Tailwind values) |
| Shadows | Not defined | Full `@theme` block |
| Animations | Not defined | `@keyframes` + `@theme` tokens |
| Container queries | 5 utilities | Not present |

No problematic duplication — separation is by consumer concern.

---

## 3. Figma ↔ Storybook Bridge Strategy

### Target Architecture

```
theme.css (source of truth)
    ↓ extract script
tokens.json (DTCG format)
    ↓ sync                    ↓ consume
Figma Variables              Storybook Token Gallery
(Tokens Studio plugin)       (Tokens.stories.tsx)
    ↓ export                  ↓ visual regression
Updated tokens.json          Chromatic baselines
    ↓ generate
Updated theme.css
```

### DTCG Token Format

```json
{
  "color": {
    "bg": {
      "white-0": {
        "$value": "{color.neutral.0}",
        "$type": "color",
        "$description": "Weakest background surface — white in light, near-black in dark"
      },
      "strong-950": {
        "$value": "{color.neutral.950}",
        "$type": "color",
        "$description": "Strongest background surface — near-black in light, near-white in dark"
      }
    }
  },
  "typography": {
    "title": {
      "h1": {
        "$value": { "fontSize": "56px", "lineHeight": "64px", "letterSpacing": "-0.01em", "fontWeight": 500 },
        "$type": "typography"
      }
    }
  }
}
```

### Steps to Enable

1. **Extract script**: `scripts/extract-tokens.ts` — parses `theme.css` + `storybook.css` → `tokens.json`
2. **Figma plugin**: Install [Tokens Studio](https://tokens.studio/), import `tokens.json` as variable collections
3. **Token gallery**: `Tokens.stories.tsx` — renders all tokens with dark mode comparison
4. **Bidirectional sync**: Designer exports from Figma → `tokens.json` → regenerate `theme.css`

---

## 4. Component Organization Strategy

### Current Hierarchy (flat)

```
Components/Badge
Components/Cards/GardenCard
Components/Cards/WorkCard
Components/Form/FormInput
...
```

### Recommended Hierarchy (Atomic Design)

```
📖 Getting Started
   ├── Introduction
   ├── Installation
   └── Contributing

🎨 Design Tokens
   ├── Colors (primitives + semantic + dark comparison)
   ├── Typography (specimen page, all 25 tokens)
   ├── Shadows & Elevation
   ├── Spacing & Layout
   └── Animation (interactive playground)

🧱 Primitives (shared)
   ├── Badge
   ├── Button
   ├── Spinner
   ├── StatusBadge
   └── TranslationBadge

📝 Form Controls (shared)
   ├── FormInput
   ├── FormTextarea
   ├── FormCheckbox
   ├── FormSelect
   ├── Select
   ├── DatePicker
   ├── DateRangePicker
   ├── ConfidenceSelector
   └── MethodSelector

📦 Cards (shared)
   ├── CardBase
   ├── GardenCard
   └── WorkCard

💬 Feedback (shared)
   ├── Toast
   ├── ConfirmDialog
   ├── ErrorBoundary
   └── SyncIndicator

🖼️ Media (shared)
   ├── ImageWithFallback
   ├── AudioPlayer
   └── AudioRecorder

📊 Progress (shared)
   ├── ENSProgressTimeline
   ├── SubmissionProgress
   └── SyncStatusBar

🏠 Admin / Layout
   ├── DashboardLayout
   ├── Header + Sidebar
   └── PageHeader

🏠 Admin / Garden Management
   ├── GardenHeroSection
   ├── GardenStatsGrid
   ├── AddMemberModal + MembersModal
   └── GardenAssessmentsPanel + GardenRolesPanel

🏠 Admin / Vault
   ├── DepositModal + WithdrawModal
   ├── PositionCard
   └── VaultEventHistory

🏠 Admin / Hypercerts
   ├── HypercertWizard + Steps
   ├── MintingDialog + CreateListingDialog
   └── ActiveListingsTable + TradeHistoryTable

📱 Client / Navigation
   ├── AppBar + TopNav
   ├── StandardTabs
   └── LandingHeader + LandingFooter

📱 Client / Cards
   ├── ActionCard + DraftCard
   ├── GardenCard
   └── FormCard

📱 Client / Dialogs
   ├── ConvictionDrawer
   ├── DraftDialog
   ├── TreasuryDrawer
   └── ModalDrawer
```

Maps to story `title`:
```typescript
const meta: Meta<typeof Badge> = {
  title: "Primitives/Badge",    // was "Components/Badge"
};
const meta: Meta<typeof Header> = {
  title: "Admin/Layout/Header", // new
};
```

---

## 5. AI Agent Development Flow

### Story-First Workflow

```
1. SPEC     Developer describes component (or AI reads Figma token JSON)
2. STORY    AI generates *.stories.tsx FIRST (template + tokens)
3. REVIEW   Storybook renders → visual check in browser
4. IMPL     AI implements component to satisfy the story
5. VRT      Chromatic captures visual baselines
6. REGRESS  Future changes validated against baselines
```

### Story Template Convention

Every component story MUST include:

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within, userEvent } from "storybook/test";

const meta: Meta<typeof Component> = {
  title: "Category/ComponentName",
  component: Component,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: { component: "One-line purpose of this component" },
    },
  },
  argTypes: {
    // ALL public props with controls + descriptions
  },
};

export default meta;
type Story = StoryObj<typeof Component>;

// 1. Default — all props at default values
export const Default: Story = {};

// 2. Variants — each visual variant gets a story
export const Primary: Story = { args: { variant: "primary" } };
export const Secondary: Story = { args: { variant: "secondary" } };

// 3. States — error, loading, disabled, empty
export const Error: Story = { args: { error: "Something went wrong" } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };

// 4. Dark mode — explicit side-by-side via decorator
export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

// 5. Edge cases — overflow, empty content, max values
export const LongContent: Story = {
  args: { children: "A".repeat(500) },
};

// 6. Gallery — composite for VRT baseline
export const Gallery: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Component variant="primary" />
      <Component variant="secondary" />
      <Component variant="error" />
    </div>
  ),
};

// 7. Interaction test — primary user flow
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button"));
    await expect(canvas.getByText("Result")).toBeInTheDocument();
  },
};
```

### Preview Decorators Needed

Add to `packages/shared/.storybook/preview.tsx`:

```typescript
import { IntlProvider } from "react-intl";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import messages from "../src/i18n/en.json";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const I18nDecorator = (Story: ComponentType) => (
  <IntlProvider locale="en" messages={messages} onError={() => {}}>
    <Story />
  </IntlProvider>
);

const QueryDecorator = (Story: ComponentType) => (
  <QueryClientProvider client={queryClient}>
    <Story />
  </QueryClientProvider>
);

// Add to decorators array:
decorators: [ThemeDecorator, I18nDecorator, QueryDecorator],
```

### CI Pipeline Addition

```yaml
# .github/workflows/storybook.yml
name: Storybook
on:
  pull_request:
    paths:
      - "packages/shared/src/components/**"
      - "packages/shared/.storybook/**"
      - "packages/admin/src/components/**"
      - "packages/client/src/components/**"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun run --filter @green-goods/shared build-storybook
      - uses: actions/upload-artifact@v4
        with:
          name: storybook-static
          path: packages/shared/storybook-static

  # Optional: Chromatic for visual regression
  visual-regression:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Chromatic needs full history
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_TOKEN }}
          workingDir: packages/shared
          buildScriptName: build-storybook
```

### Pre-commit Story Existence Check

```bash
# In a pre-commit hook or CI lint step:
# Ensure every new component in shared/src/components/ has a story
for file in $(git diff --cached --name-only --diff-filter=A | grep 'packages/shared/src/components/.*\.tsx$' | grep -v '\.stories\.tsx$' | grep -v 'index\.tsx$'); do
  story="${file%.tsx}.stories.tsx"
  if [ ! -f "$story" ]; then
    echo "ERROR: Missing story for new component: $file"
    echo "       Expected: $story"
    exit 1
  fi
done
```

---

## 6. Missing Components Inventory

### Shared — 29 Missing Stories

**Form Controls (7)**
- `FormFieldWrapper` — base wrapper for all form fields
- `FormSelect` — form-integrated select
- `ConfidenceSelector` — domain-specific confidence level picker
- `MethodSelector` — domain-specific method picker
- `DatePicker` — single date selection
- `DateRangePicker` — date range selection
- `AssetSelector` — vault asset picker

**Feedback & Status (5)**
- `ConfirmDialog` — destructive action confirmation (CRITICAL: has dark mode contrast bug)
- `ErrorBoundary` — React error boundary with fallback UI
- `SyncStatusBar` — offline sync progress bar
- `SyncIndicator` — compact sync status indicator
- `ToastViewport` — toast positioning container

**Progress (3)**
- `ENSProgressTimeline` — ENS registration step tracker
- `SubmissionProgress` — work submission progress display
- `HydrationFallback` — SSR hydration loading state (has story, but needs expansion)

**Media (2)**
- `AudioPlayer` — playback of recorded evidence
- `AudioRecorder` — evidence recording interface

### Admin — 54 Missing Stories (Tier 2)

**Layout Shell (6)**: DashboardLayout, DashboardLayoutSkeleton, Header, Sidebar, PageHeader, UserProfile
**Primitives (4)**: Button, Card, EmptyState, StatCard
**Garden CRUD (11)**: GardenHeroSection, GardenStatsGrid, GardenMetadata, GardenCommunityCard, GardenYieldCard, GardenAssessmentsPanel, GardenRolesPanel, AddMemberModal, MembersModal, CreateGarden steps (3)
**Vault (4)**: DepositModal, WithdrawModal, PositionCard, VaultEventHistory
**Hypercerts (12)**: HypercertWizard, wizard steps (5), MintingDialog, CreateListingDialog, MarketplaceApprovalGate, ActiveListingsTable, TradeHistoryTable, DistributionChart
**Work (3)**: MediaEvidence, WorkCard, WorkSubmissionsView
**Action Config (4)**: DetailsConfigSection, InstructionsBuilder, MediaConfigSection, ReviewConfigSection
**Assessment (3)**: DomainActionStep, SdgHarvestStep, StrategyKernelStep
**Form (2)**: FormWizard, StepIndicator
**Other (5)**: AddressDisplay, ConnectButton, FileUploadField, StatusBadge (admin variant)

### Client — 44 Missing Stories (Tier 3)

**Cards (6)**: ActionCard, ActionCardSkeleton, Card, FormCard, GardenCard, GardenCardSkeleton, DraftCard, WorkCard
**Dialogs (5)**: ConvictionDrawer, DraftDialog, ImagePreviewDialog, ModalDrawer, TreasuryDrawer
**Navigation (5)**: AppBar, TopNav, StandardTabs, LandingHeader, LandingFooter
**Inputs (4)**: Input, Text, FormSelect, Select, AddressCopy, PullToRefresh
**Display (4)**: Avatar, Carousel, ImageWithFallback, Faq (Accordion)
**Layout (3)**: Hero, Splash
**Features (5)**: Assessments, Gardeners, Work, Profile, WorkView
**Feedback (3)**: Badge, OfflineIndicator, Loader, Progress
**Errors (2)**: AppErrorBoundary, ErrorBoundary

---

## 7. Implementation Roadmap

### Phase 1: Foundation (unblocks everything)

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1.1 | Add `IntlProvider` decorator to `preview.tsx` | Critical | S |
| 1.2 | Add `QueryClientProvider` decorator to `preview.tsx` | Critical | S |
| 1.3 | Add `storybook-static/` to `.gitignore`, remove from repo | High | S |
| 1.4 | Create `Tokens.stories.tsx` — color swatches + dark mode comparison | High | M |
| 1.5 | Create `Typography.stories.tsx` — all 25 type tokens at actual size | High | M |
| 1.6 | Create dark mode decorator pattern + add DarkMode story to all 15 existing stories | High | M |
| 1.7 | Reorganize existing 15 stories to new hierarchy (`Primitives/`, `Form Controls/`, etc.) | Medium | S |

### Phase 2: Shared Coverage (close the 66% gap)

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 2.1 | Stories for ConfirmDialog (includes dark mode contrast bug verification) | Critical | M |
| 2.2 | Stories for all Form components (FormFieldWrapper, FormSelect, DatePicker, etc.) | High | L |
| 2.3 | Stories for Audio components (AudioPlayer, AudioRecorder) | High | M |
| 2.4 | Stories for Progress/Sync components (ENSProgressTimeline, SyncStatusBar, etc.) | Medium | M |
| 2.5 | Stories for ErrorBoundary | Medium | S |
| 2.6 | Add `play()` interaction tests to all 15 existing stories | Medium | L |
| 2.7 | Create Shadow & Animation playground stories | Low | M |
| 2.8 | Create Icon Catalog story (all Remixicon usage) | Low | M |

### Phase 3: Admin + Client Expansion

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 3.1 | Extend Storybook glob or configure composition for admin/client packages | Critical | M |
| 3.2 | Stories for admin primitives (Button, Card, EmptyState, StatCard) | High | M |
| 3.3 | Stories for admin layout shell (DashboardLayout, Header, Sidebar, PageHeader) | High | L |
| 3.4 | Stories for admin garden management components | Medium | L |
| 3.5 | Stories for admin vault components (DepositModal, WithdrawModal, etc.) | Medium | M |
| 3.6 | Stories for client navigation components (AppBar, TopNav, Tabs) | Medium | M |
| 3.7 | Stories for client card components | Medium | M |
| 3.8 | Stories for client dialog components | Low | M |

### Phase 4: Automation & AI Integration

| # | Task | Priority | Effort |
|---|------|----------|--------|
| 4.1 | Add `build-storybook` to GitHub Actions CI | High | S |
| 4.2 | Set up Chromatic for visual regression testing | High | M |
| 4.3 | Create `scripts/extract-tokens.ts` → `tokens.json` (DTCG format) | Medium | M |
| 4.4 | Configure Tokens Studio plugin in Figma for bidirectional sync | Medium | M |
| 4.5 | Create `.claude/agents/storybook-author.md` agent skill | Medium | S |
| 4.6 | Add pre-commit hook: new component → must have story | Medium | S |
| 4.7 | Create `Introduction.mdx` getting-started documentation page | Low | S |
| 4.8 | Create `Contributing.mdx` with story template and conventions | Low | S |

### Effort Key
- **S** = Small (< 1 hour)
- **M** = Medium (1–3 hours)
- **L** = Large (3+ hours)

---

## 8. Decision Log

| Decision | Rationale |
|----------|-----------|
| Keep Storybook in `shared` only (extend via glob, not separate configs) | Avoids config duplication; shared owns all component primitives per hook boundary rule |
| Use DTCG format for tokens (not Style Dictionary) | DTCG is the W3C standard; Tokens Studio supports it natively |
| Use Chromatic over Percy for VRT | Chromatic is Storybook-native, supports interaction testing, better PR integration |
| Atomic Design hierarchy over flat | 142 components need navigation structure; maps to shared/admin/client boundary |
| Story-first AI workflow | Stories as executable specs — AI reads story to understand API, writes impl to satisfy it |
| "Visual strength" token naming preserved | Changing would break all 567 tokens + app styling; document with descriptions instead |

---

## References

- Figma design: https://www.figma.com/design/aNmqUjGZ5wR4eNaRqfhbQZ/Green-Goods
- Theme CSS: `packages/shared/src/styles/theme.css` (932 lines, 567 tokens)
- Storybook config: `packages/shared/.storybook/`
- Admin UI audit: `.claude/plans/admin-ui-overhaul.md`
- Garden view audit: `.claude/plans/garden-view-audit.md`
- Memory notes: `.claude/projects/-Users-afo-Code-greenpill-green-goods/memory/MEMORY.md`
