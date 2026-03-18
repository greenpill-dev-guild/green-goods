---
name: storybook
user-invocable: false
description: Storybook development - CSF3 stories, visual testing, design system documentation, addon configuration. Use for component stories, visual regression, and design system docs.
version: "1.0.0"
status: active
packages: ["shared"]
dependencies: ["react"]
last_updated: "2026-02-19"
last_verified: "2026-02-19"
---

# Storybook Skill

Storybook development guide: writing stories, visual testing, design system documentation, and addon configuration.

---

## Activation

When invoked:
- Check `packages/shared/` for existing stories and component patterns.
- Storybook runs on port 6006: `cd packages/shared && bun run storybook`.
- All shared components should have stories.
- Load `.claude/context/shared.md` for component patterns.

## Part 1: Project Setup

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

## Part 2: Writing Stories (CSF3)

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

## Part 3: Global Configuration

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

---

## Reference Files

For detailed addon configuration, design system documentation, and testing patterns:

- **[addons-and-design-system.md](./addons-and-design-system.md)** -- Essential addon configuration (a11y, themes, interactions), accessibility addon rules, theme switching setup, component API documentation with JSDoc, MDX documentation pages, and story organization hierarchy.

- **[visual-and-interaction-testing.md](./visual-and-interaction-testing.md)** -- Visual snapshot testing, responsive stories, component state coverage checklist, Chromatic visual regression setup and CI integration, Storybook test runner, multi-step play functions, async state testing, error state testing, offline scenario testing, and play function best practices.

---

## Anti-Patterns

- **Never skip `tags: ["autodocs"]`** — all components need auto-generated docs
- **Never hardcode data in stories** — use mock factories from test-utils
- **Never skip a11y addon checks** — accessibility is mandatory
- **Never put stories in client/admin** — all stories in shared package
- **Never forget loading/error/empty states** — cover all UI states
- **Never inline styles in stories** — use Tailwind classes matching production

## Quick Reference Checklist

### Before Adding a New Component

- [ ] Story file co-located with component
- [ ] `tags: ["autodocs"]` for auto-documentation
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
+--> New component? ----------------> Part 2: Writing Stories
|                                      -> Co-locate story with component
|                                      -> Add tags: ["autodocs"]
|                                      -> Cover all variants
|                                      -> Add play function for interactions
|
+--> Design system docs? -----------> addons-and-design-system.md
|                                      -> MDX pages for tokens/patterns
|                                      -> ColorPalette, Typeset blocks
|                                      -> Organize under Design System/
|
+--> Visual regression? ------------> visual-and-interaction-testing.md
|                                      -> Chromatic for CI
|                                      -> Test runner for local
|                                      -> Review diffs on PR
|
+--> Accessibility check? ----------> addons-and-design-system.md
|                                      -> a11y addon (mandatory)
|                                      -> axe-core rules in preview.ts
|                                      -> Every story must pass
|
+--> Theme testing? ----------------> addons-and-design-system.md
|                                      -> withThemeByClassName decorator
|                                      -> Test light + dark
|
+--> Responsive testing? -----------> visual-and-interaction-testing.md
                                       -> Viewport parameters
                                       -> Mobile, tablet, desktop stories
```

## Related Skills

- `react` — Component composition patterns
- `ui-compliance` — Accessibility requirements verified in Storybook
- `frontend-design` — Visual design system with Storybook-first workflow
- `testing` — Integration between Storybook play functions and Vitest
