# Storybook

> Sub-file of the [ui skill](./SKILL.md). Writing stories (CSF3), play functions, decorators, global configuration, and story organization.

Dedicated story authoring routes through the `ui` skill. The old `storybook-author` agent has been retired.

---

## Project Setup

Storybook is the local component documentation, state catalog, and light regression surface for Green Goods UI work. The unified Storybook instance is hosted from `packages/shared`, but it indexes stories from `packages/shared`, `packages/admin`, and `packages/client`.

### Commands

| Command | Purpose |
|---------|---------|
| `cd packages/shared && bun run storybook` | Start the unified Storybook dev server on port 6006 |
| `cd packages/shared && bun run build-storybook` | Build the static Storybook artifact |
| `cd packages/shared && bun run check:stories` | Verify required shared and curated admin surfaces have stories |
| `cd packages/shared && bun run check:story-quality` | Verify admin/shared Canvas stories are deterministic and agent-readable |
| `cd packages/shared && bun run test:stories:ci` | Run curated browser-mode story smoke and `play()` tests |

### Directory Structure

```text
packages/shared/
  .storybook/
    main.ts              # Unified Storybook config and cross-package aliases
    preview.tsx          # Global decorators and toolbar parameters
    decorators.tsx       # Router, theme, query, auth, wagmi, and canvas helpers
    fixtures.ts          # Shared deterministic fixtures
    adminFixtures.ts     # Admin-specific deterministic seeds
  src/components/
    Button.tsx
    Button.stories.tsx

packages/admin/src/
  components/
    AdminButton.tsx
    AdminButton.stories.tsx
  views/**/components/
    WorkflowComponent.tsx
    WorkflowComponent.stories.tsx
```

- Co-locate stories with the component or workflow surface they document.
- Package-local components in `packages/admin` and `packages/client` keep package-local stories.
- Shared primitives, Canvas foundations, and reusable hooks belong in `packages/shared` and should be consumed through package barrels.
- Storybook config and reusable story harness helpers live under `packages/shared/.storybook`.

## Green Goods Story Conventions

### Storybook-First Component Flow

When an agent builds or changes an admin UI component:

1. Read `packages/admin/AGENTS.md`, `docs/docs/builders/packages/admin.mdx`, and this file.
2. Decide ownership before coding: reusable primitive or hook goes in shared; admin-only workflow or shell composition goes in admin.
3. Build from existing shared/admin primitives before adding a new wrapper.
4. Add or update the story in the same change, before wiring the component deeply into a route.
5. Use deterministic fixtures and Storybook decorators instead of live services or ad-hoc mocks.
6. Inspect the component in Storybook, then wire it into the admin route.
7. Add focused Vitest/RTL tests for behavior that Storybook cannot honestly prove.
8. Run the lightest validation loop that covers the touched surface.

### Required Story Shape

Every story file should use CSF3 and include:

1. A `meta` default export with `tags: ["autodocs"]`.
2. A `Default` story or the nearest meaningful baseline state.
3. Explicit loading, empty, error, permission, and edge states when the component can render them.
4. A `StateCatalog` story for state matrices or consolidated visual review.
5. Viewport-specific stories when responsive behavior changes meaningfully.
6. A `play()` function only when it catches meaningful behavior without making the story brittle.

Do not add duplicate `DarkMode` stories just to prove theme support. Use the Storybook theme toolbar unless the component has a distinct dark-mode-specific behavior. Prefer `StateCatalog` over generic `Gallery`; keep axis catalogs such as `VariantCatalog`, `SizeCatalog`, or `ToneCatalog` only when the axis itself is the review target.

### Title Hierarchy

Use the title families enforced by the current Storybook docs:

| Prefix | Typical Scope |
|---|---|
| `Shared/Primitives/*` | Basic shared UI foundations |
| `Shared/Canvas/*` | Canvas shell pieces, sheets, navigation, workbench rows |
| `Shared/Form/*` | Inputs, selectors, wrappers, field helpers |
| `Shared/Feedback/*` | Toasts, dialogs, boundaries, status states |
| `Shared/Display/*` | Image, media, fallback, and preview surfaces |
| `Shared/Cards/*` | Reusable card patterns and domain cards |
| `Shared/Progress/*` | Sync, submission, timeline, progress indicators |
| `Shared/Tokens/*` | Color, typography, material, shadow, animation docs |
| `Admin/Primitives/*` | Admin-only `Admin*` wrappers |
| `Admin/Shell/*` | Admin-owned canvas shell and account surfaces |
| `Admin/Workflows/*` | Curated reusable admin workflow surfaces |
| `Client/*` | Client-only component stories |

Match the closest existing category before inventing a new one.

### Project-Specific Rules

- Use Remixicon (`@remixicon/react`), not lucide.
- Dark mode uses `data-theme="dark"`, controlled by the global Storybook theme toolbar.
- Use semantic tokens from `theme.css`, not hardcoded colors.
- Use deterministic fixture helpers from `packages/shared/.storybook/fixtures.ts` and `adminFixtures.ts`.
- Do not use `Date.now()`, zero-argument `new Date()`, `picsum.photos`, live IPFS URLs, or placeholder CIDs.
- Use `STORYBOOK_NOW_SECONDS`, `hoursAgo`, `daysAgo`, and `daysFromNow` for relative-time states.
- Use data URL fixture images such as `FIXTURE_WORK_MEDIA` and `FIXTURE_IMAGE_*`.
- Do not duplicate global Storybook decorators already configured in preview.
- Give public props useful `argTypes` with controls and descriptions.
- For wizard or multi-step UI, add a story per meaningful step plus a full-flow story when interaction coverage matters.
- Client-facing components are mobile-first. Admin components use standard responsive breakpoints and should add viewport coverage when layout changes on small screens.

### Real Components vs Harnesses

Stories should render real components by default.

Use `visual-harness` only when a real component cannot be rendered deterministically because it terminates in wallet-bound wagmi reads, contract writes, live services, or route/provider seams that do not yet have a stable story harness. Harness stories are useful for visual review, but they do not prove real-component coverage unless the coverage script has an explicit audited exception.

For provider-dependent stories, prefer helpers from `packages/shared/.storybook/decorators.tsx`:

- `withRouter([...])` for route context.
- `withCanvasFrame(...)` for admin canvas sizing and workspace tint.
- `withAdminIdentity` for mock wagmi plus dev auth.
- `withSeededQueryClient(...)` for React Query data.
- `withWagmi` or `withDevAuth` only when the story needs that narrower layer.

## Story Definition of Done

Treat a story task as complete only when all of these are true:

1. The story file is co-located with the component or workflow surface.
2. The story renders the real component unless it is explicitly tagged `visual-harness`.
3. The meta block uses CSF3 plus `tags: ["autodocs"]`.
4. The states a reviewer needs are covered as named stories or a `StateCatalog`.
5. Responsive variants exist where layout meaningfully changes.
6. Fixture data is deterministic and domain-shaped.
7. Focused `play()` interactions exist only for stable high-value behavior.
8. The relevant Storybook gates pass.

## Writing Stories (CSF3)

### Basic Story

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { AdminButton } from "./AdminButton";

const meta = {
  title: "Admin/Primitives/AdminButton",
  component: AdminButton,
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["filled", "tonal", "elevated", "outlined", "text", "danger"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof AdminButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Review work",
  },
};

export const Loading: Story = {
  args: {
    children: "Saving",
    loading: true,
  },
};
```

### Story with Admin Context

```typescript
import type { Meta, StoryObj } from "@storybook/react";
import { STORYBOOK_ADMIN_SHELL_SEEDS } from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
} from "../../../../shared/.storybook/decorators";
import { MyAdminWorkflow } from "./MyAdminWorkflow";

const meta = {
  title: "Admin/Workflows/MyAdminWorkflow",
  component: MyAdminWorkflow,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withRouter(["/hub/work"]),
    withCanvasFrame({ workspace: "hub", heightClassName: "h-[720px]" }),
  ],
} satisfies Meta<typeof MyAdminWorkflow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
```

### Interactive Story

```typescript
import { expect, userEvent, within } from "storybook/test";

export const OpensInspector: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /open details/i }));
    await expect(await canvas.findByRole("heading", { name: /details/i })).toBeVisible();
  },
};
```

## Validation

Run the checks that match the touched surface:

```bash
# Required for new or changed admin/shared stories
cd packages/shared && bun run check:stories
cd packages/shared && bun run check:story-quality

# Required when Storybook config, tokens, or broad story surfaces change
cd packages/shared && bun run build-storybook

# Required only when adding or changing curated storybook-ci coverage
cd packages/shared && bun run test:stories:ci
```

For frontend token or copy changes, also run:

```bash
bun run check:design-tokens
bun run lint:vocab
```

## Reference Files

- `docs/docs/builders/testing/storybook.mdx` -- canonical live Storybook contract and CI gate description.
- `packages/shared/.storybook/main.ts` -- unified Storybook config.
- `packages/shared/.storybook/decorators.tsx` -- reusable story harness helpers.
- `packages/shared/.storybook/fixtures.ts` -- deterministic shared fixture helpers.
- `packages/shared/.storybook/adminFixtures.ts` -- deterministic admin fixture seeds.
- `scripts/check-story-coverage.ts` -- required coverage contract.
- `scripts/check-story-quality.ts` -- deterministic story guardrails.
- **[storybook-addons.md](./storybook-addons.md)** -- addon configuration reference.
- **[storybook-testing.md](./storybook-testing.md)** -- extended interaction and visual testing notes.

## Anti-Patterns

- Rendering a mock component as `meta.component` without `visual-harness`.
- Tagging every story with `storybook-ci`; keep the CI lane curated.
- Using `Date.now()`, zero-argument `new Date()`, live media URLs, or placeholder IPFS data.
- Adding one-off decorators when a shared Storybook helper already exists.
- Adding duplicate dark-mode stories instead of using the theme toolbar.
- Naming consolidated matrices `Gallery` instead of `StateCatalog`.
- Inventing a new title family when an existing one fits.
- Treating Storybook as a replacement for focused tests of permissions, routing, mutation behavior, or data transforms.

## Quick Reference Checklist

### Before Adding a New Component

- [ ] Ownership decided: shared reusable foundation or admin-only workflow.
- [ ] Component uses existing shared/admin primitives before new wrappers.
- [ ] Story file co-located with component.
- [ ] `tags: ["autodocs"]` present.
- [ ] Real component rendered by default.
- [ ] Deterministic fixtures and shared decorators used.
- [ ] `StateCatalog` or named states cover loading, empty, error, permissions, and edge cases where applicable.
- [ ] Responsive story added when behavior changes by viewport.
- [ ] `play()` added only for stable high-value interactions.
- [ ] `check:stories`, `check:story-quality`, and any necessary build/smoke gates pass.

## Decision Tree

```text
What Storybook work?
|
+--> New admin component? ---------> Storybook-first component flow
|                                    -> Decide shared vs admin ownership
|                                    -> Build from existing primitives
|                                    -> Add real-component story + StateCatalog
|                                    -> Wire route only after story is coherent
|
+--> Shared primitive? ------------> Shared story + barrel export + focused tests
|                                    -> Use Shared/* title family
|                                    -> Run check:stories
|
+--> Provider-driven workflow? ----> Use decorators.tsx helpers
|                                    -> Seed React Query data
|                                    -> Prefer real component
|                                    -> Tag visual-harness only for audited exceptions
|
+--> CI story smoke? --------------> Add storybook-ci only for stable high-value behavior
|                                    -> Add a meaningful play() assertion
|                                    -> Run test:stories:ci
|
+--> Visual regression? -----------> storybook-testing.md / Chromatic notes
|
+--> Accessibility check? ---------> addon-a11y in Storybook UI
```
