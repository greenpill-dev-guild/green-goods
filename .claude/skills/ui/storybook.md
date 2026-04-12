# Storybook

> Sub-file of the [ui skill](./SKILL.md). Writing stories (CSF3), play functions, decorators, global configuration, and story organization.

Dedicated story authoring routes through the `ui` skill. The old `storybook-author` agent has been retired.

---

## Project Setup

### Commands

| Command | Purpose |
|---------|---------|
| `cd packages/shared && bun run storybook` | Start dev server (port 6006) |
| `cd packages/shared && bun run build-storybook` | Build static Storybook |
| `bun dev` | Starts Storybook via PM2 (alongside other services) |

### Directory Structure

```text
packages/shared/
  .storybook/
    main.ts           # Storybook configuration
    preview.ts         # Global decorators and parameters
    manager.ts         # UI customization
  src/
    components/
      Button/
        Button.tsx
        Button.stories.tsx   # Stories co-located with component
        index.ts
      Card/
        Card.tsx
        Card.stories.tsx
```

- Check `packages/shared/` for existing stories and component patterns.
- Storybook runs on port 6006.
- All shared components should have stories.
- Package-local components in `packages/admin` and `packages/client` may keep package-local stories when that is the established pattern.
- Load `.claude/context/shared.md` for component patterns.

## Green Goods Story Conventions

### Required Exports

Every story file includes at minimum:

1. `Default`
2. `DarkMode`
3. `Gallery`

Interactive components also include:

4. `Interactive` with a `play()` function

### Title Hierarchy

Use the established title families already present in the repo:

| Prefix | Typical Scope |
|---|---|
| `Primitives/` | Basic shared UI foundations |
| `Form Controls/` | Inputs, selectors, wrappers, field helpers |
| `Cards/` | Reusable card patterns and domain cards |
| `Feedback/` | Toasts, dialogs, boundaries, status states |
| `Media/` | Image, audio, upload, capture surfaces |
| `Progress/` | Sync, submission, timeline, progress indicators |
| `Admin/...` | Admin-only or admin-framed stories |
| `Client/...` | Client-only or client-framed stories |
| `Design Tokens/` | Colors, typography, spacing, animation docs |

Match the closest existing category before inventing a new one.

### Project-Specific Rules

- Use Remixicon (`@remixicon/react`), not lucide.
- Dark mode uses `data-theme="dark"`, not class toggles.
- Use semantic tokens from `theme.css`, not hardcoded colors.
- Do not duplicate global Storybook decorators already configured in preview.
- Give public props useful `argTypes` with controls and descriptions.
- For wizard or multi-step UI, add a story per meaningful step plus a full-flow story when interaction coverage matters.
- Client-facing components are mobile-first. Add viewport coverage when layout meaningfully changes on small screens.

## Story Definition of Done

Treat a story task as complete only when all of these are true:

1. The story file is co-located with the component.
2. The meta block uses CSF3 plus `tags: ["autodocs"]`.
3. Minimum exports are present: `Default`, `DarkMode`, and `Gallery`.
4. Interactive components add an `Interactive` story with a `play()` function.
5. Public props have useful `argTypes` with controls and descriptions.
6. Mock data is realistic and uses project factories or domain-shaped objects, not placeholders.
7. `cd packages/shared && bun run build-storybook` passes before completion.

## Writing Stories (CSF3)

### Basic Story

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";

const meta = {
  title: "Components/Button",
  component: Button,
  tags: ["autodocs"],  // Auto-generate docs
  argTypes: {
    variant: {
      control: "select",
      options: ["primary", "secondary", "destructive", "ghost"],
    },
    size: {
      control: "select",
      options: ["sm", "md", "lg"],
    },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// Named exports = individual stories
export const Primary: Story = {
  args: {
    variant: "primary",
    children: "Click me",
  },
};

export const Secondary: Story = {
  args: {
    variant: "secondary",
    children: "Secondary",
  },
};

export const Loading: Story = {
  args: {
    variant: "primary",
    children: "Saving...",
    disabled: true,
  },
};
```

### Story with Decorators

```typescript
// Wrap story in providers or layout
export const WithTheme: Story = {
  decorators: [
    (Story) => (
      <div className="p-8 bg-background">
        <Story />
      </div>
    ),
  ],
  args: {
    children: "Themed Button",
  },
};
```

### Interactive Stories (Play Functions)

```typescript
import { within, userEvent, expect } from "@storybook/test";

export const ClickInteraction: Story = {
  args: { children: "Click me" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByRole("button");

    await userEvent.click(button);
    await expect(button).toHaveFocus();
  },
};
```

### Stories for Complex Components

```typescript
// GardenCard.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { GardenCard } from "./GardenCard";
import { createMockGarden } from "../../__tests__/test-utils/mock-factories";

const meta = {
  title: "Domain/GardenCard",
  component: GardenCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="max-w-sm">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GardenCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    garden: createMockGarden(),
  },
};

export const WithManyActions: Story = {
  args: {
    garden: createMockGarden({ actionCount: 12 }),
  },
};

export const Offline: Story = {
  args: {
    garden: createMockGarden(),
    isOffline: true,
  },
};
```

## Global Configuration

### Preview (Decorators & Parameters)

```typescript
// .storybook/preview.ts
import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: "^on[A-Z].*" },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "centered",
    backgrounds: {
      default: "light",
      values: [
        { name: "light", value: "#ffffff" },
        { name: "dark", value: "#0a0a0a" },
        { name: "green", value: "#f0fdf4" },
      ],
    },
  },
  decorators: [
    // Global decorator for all stories
    (Story) => (
      <div className="font-sans antialiased">
        <Story />
      </div>
    ),
  ],
};

export default preview;
```

## Reference Files

For detailed addon configuration, design system documentation, and testing patterns:

- **[storybook-addons.md](./storybook-addons.md)** -- Essential addon configuration (a11y, themes, interactions), accessibility addon rules, theme switching setup, component API documentation with JSDoc, MDX documentation pages, and story organization hierarchy.

- **[storybook-testing.md](./storybook-testing.md)** -- Visual snapshot testing, responsive stories, component state coverage checklist, Chromatic visual regression setup and CI integration, Storybook test runner, multi-step play functions, async state testing, error state testing, offline scenario testing, and play function best practices.

## Anti-Patterns

- **Never skip `tags: ["autodocs"]`** -- all components need auto-generated docs
- **Never hardcode data in stories** -- use mock factories from test-utils
- **Never skip a11y addon checks** -- accessibility is mandatory
- **Never invent a new title family when an existing one fits** -- keep Storybook navigation stable
- **Never forget loading/error/empty states** -- cover all UI states
- **Never inline styles in stories** -- use Tailwind classes matching production

## Quick Reference Checklist

### Before Adding a New Component

- [ ] Story file co-located with component
- [ ] `tags: ["autodocs"]` for auto-documentation
- [ ] Default, DarkMode, and Gallery exports present
- [ ] All variants shown as separate stories
- [ ] Loading, error, empty states covered
- [ ] Play function for key interactions
- [ ] Passes a11y addon checks
- [ ] Works in both light and dark themes
- [ ] Responsive viewports tested
- [ ] Mock data from test-utils factories

## Decision Tree

```
What Storybook work?
|
+--> New component? ----------------> Writing Stories (above)
|                                      -> Co-locate story with component
|                                      -> Add tags: ["autodocs"]
|                                      -> Cover all variants
|                                      -> Add play function for interactions
|
+--> Design system docs? -----------> storybook-addons.md
|                                      -> MDX pages for tokens/patterns
|                                      -> ColorPalette, Typeset blocks
|                                      -> Organize under Design System/
|
+--> Visual regression? ------------> storybook-testing.md
|                                      -> Chromatic for CI
|                                      -> Test runner for local
|                                      -> Review diffs on PR
|
+--> Accessibility check? ----------> storybook-addons.md
|                                      -> a11y addon (mandatory)
|                                      -> axe-core rules in preview.ts
|                                      -> Every story must pass
|
+--> Theme testing? ----------------> storybook-addons.md
|                                      -> withThemeByClassName decorator
|                                      -> Test light + dark
|
+--> Responsive testing? -----------> storybook-testing.md
                                       -> Viewport parameters
                                       -> Mobile, tablet, desktop stories
```
