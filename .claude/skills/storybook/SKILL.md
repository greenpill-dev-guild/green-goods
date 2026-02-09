---
name: storybook
description: Storybook development - CSF3 stories, visual testing, design system documentation, addon configuration. Use for component stories, visual regression, and design system docs.
version: "1.0"
last_updated: "2026-02-08"
last_verified: "2026-02-09"
status: proven
packages: [shared]
dependencies: [react, radix-ui]
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

```
packages/shared/
├── .storybook/
│   ├── main.ts           # Storybook configuration
│   ├── preview.ts         # Global decorators and parameters
│   └── manager.ts         # UI customization
├── src/
│   └── components/
│       ├── Button/
│       │   ├── Button.tsx
│       │   ├── Button.stories.tsx   # Stories co-located with component
│       │   └── index.ts
│       └── Card/
│           ├── Card.tsx
│           └── Card.stories.tsx
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

## Part 4: Addons

### Essential Addons

| Addon | Purpose | Status |
|-------|---------|--------|
| `@storybook/addon-essentials` | Controls, actions, viewport, docs | Included |
| `@storybook/addon-a11y` | Accessibility testing | Required |
| `@storybook/addon-themes` | Theme switching | Required |
| `@storybook/addon-interactions` | Play function testing | Included |

### Accessibility Addon

The a11y addon runs axe-core checks on every story:

```typescript
// In preview.ts
parameters: {
  a11y: {
    config: {
      rules: [
        { id: "color-contrast", enabled: true },
        { id: "label", enabled: true },
      ],
    },
  },
},
```

**Every component MUST pass a11y checks** — this is enforced by the `ui-compliance` skill.

### Theme Switching

```typescript
// preview.ts
import { withThemeByClassName } from "@storybook/addon-themes";

decorators: [
  withThemeByClassName({
    themes: {
      light: "",
      dark: "dark",
    },
    defaultTheme: "light",
  }),
],
```

## Part 5: Design System Documentation

### Documenting Component APIs

Use `tags: ["autodocs"]` and JSDoc comments:

```typescript
interface ButtonProps {
  /** Visual style variant */
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  /** Size preset */
  size?: "sm" | "md" | "lg";
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Click handler */
  onClick?: () => void;
  /** Button content */
  children: React.ReactNode;
}
```

### MDX Documentation Pages

```mdx
{/* docs/Colors.mdx */}
import { Meta, ColorPalette, ColorItem } from "@storybook/blocks";

<Meta title="Design System/Colors" />

# Colors

## Primary Palette

<ColorPalette>
  <ColorItem title="Green" subtitle="Primary brand" colors={{
    "Default": "#1FC16B",
    "Light": "#86efac",
    "Dark": "#15803d",
  }} />
  <ColorItem title="Earth" subtitle="Secondary" colors={{
    "Warm": "#92400e",
    "Sand": "#fef3c7",
  }} />
</ColorPalette>
```

### Story Organization

```
Components/           # Reusable UI primitives
├── Button
├── Card
├── Input
├── Badge
Domain/               # Business-specific components
├── GardenCard
├── WorkCard
├── ActionCard
├── GardenerCard
Patterns/             # Composition examples
├── Forms
├── Lists
├── Layouts
Design System/        # Documentation pages
├── Colors
├── Typography
├── Spacing
```

## Part 6: Visual Testing

### Snapshot Testing with Play Functions

```typescript
export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="ghost">Ghost</Button>
    </div>
  ),
};
```

### Responsive Stories

```typescript
export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: "mobile1",
    },
  },
  args: {
    garden: createMockGarden(),
  },
};

export const Tablet: Story = {
  parameters: {
    viewport: {
      defaultViewport: "tablet",
    },
  },
};
```

### Testing States

Every component should have stories for:
- [ ] Default state
- [ ] Loading state
- [ ] Error state
- [ ] Empty state
- [ ] Disabled state
- [ ] Mobile viewport
- [ ] Dark theme
- [ ] RTL layout (if text-heavy)

## Part 7: Visual Regression Testing

### Chromatic Integration

[Chromatic](https://www.chromatic.com/) captures visual snapshots of every story and detects pixel-level changes on PRs.

#### Setup

```bash
# Install
bun add -D chromatic

# Add to package.json scripts (packages/shared)
# "chromatic": "chromatic --project-token=$CHROMATIC_PROJECT_TOKEN"

# Run visual tests
cd packages/shared
bunx chromatic --project-token=$CHROMATIC_PROJECT_TOKEN
```

#### CI Integration (GitHub Actions)

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression
on: pull_request

jobs:
  chromatic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for baseline comparison
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - run: bun --filter shared build
      - uses: chromaui/action@latest
        with:
          projectToken: ${{ secrets.CHROMATIC_PROJECT_TOKEN }}
          workingDir: packages/shared
          buildScriptName: build-storybook
```

#### Workflow

```
1. PR opened → Chromatic builds Storybook
2. Chromatic detects visual changes → flags for review
3. Team reviews changes in Chromatic UI
4. Approve or reject visual diffs
5. PR can merge after visual review passes
```

### Storybook Test Runner (Alternative)

For local visual regression without Chromatic:

```bash
# Install test runner
bun add -D @storybook/test-runner

# Add script
# "test-storybook": "test-storybook"

# Run (requires Storybook running on port 6006)
cd packages/shared
bun run storybook &  # Start Storybook
bunx test-storybook  # Run all play functions and a11y checks
```

### Snapshot Strategy

| Level | Tool | What It Catches |
|-------|------|-----------------|
| **Component** | Storybook play functions | Interaction bugs |
| **Visual** | Chromatic | Unintended pixel changes |
| **Accessibility** | a11y addon + test runner | WCAG violations |
| **Responsive** | Viewport stories + Chromatic | Layout breakage |

### When to Review Visual Diffs

- **Accept**: Intentional style changes, new components
- **Reject**: Unintended regressions, broken layouts, contrast issues
- **Investigate**: Flaky diffs (animation timing, async content)

## Part 8: Advanced Interaction Testing

### Multi-Step Play Functions

For complex user flows (wizards, multi-field forms, conditional UI):

```typescript
import { within, userEvent, expect, waitFor } from "@storybook/test";

export const FormWizardFlow: Story = {
  args: { garden: createMockGarden() },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("Step 1: Fill basic info", async () => {
      await userEvent.type(canvas.getByLabelText("Title"), "Morning weeding");
      await userEvent.type(canvas.getByLabelText("Description"), "Removed invasive species");
      await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    });

    await step("Step 2: Upload photo", async () => {
      // Wait for step transition
      await waitFor(() => {
        expect(canvas.getByText("Add Photos")).toBeInTheDocument();
      });

      // Simulate file upload
      const fileInput = canvas.getByLabelText("Upload");
      const file = new File(["photo"], "work.jpg", { type: "image/jpeg" });
      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(canvas.getByAltText("work.jpg")).toBeInTheDocument();
      });

      await userEvent.click(canvas.getByRole("button", { name: "Next" }));
    });

    await step("Step 3: Review and submit", async () => {
      await waitFor(() => {
        expect(canvas.getByText("Morning weeding")).toBeInTheDocument();
      });

      await userEvent.click(canvas.getByRole("button", { name: "Submit" }));
      await waitFor(() => {
        expect(canvas.getByText("Work queued")).toBeInTheDocument();
      });
    });
  },
};
```

### Async State Testing

Test components that depend on async data loading or state transitions:

```typescript
export const AsyncDataLoading: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify loading state appears first
    await expect(canvas.getByRole("progressbar")).toBeInTheDocument();

    // Wait for data to resolve
    await waitFor(
      () => {
        expect(canvas.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(canvas.getByRole("list")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Verify rendered data
    const items = canvas.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
  },
};
```

### Testing Error States

```typescript
export const SubmissionFailure: Story = {
  parameters: {
    // Mock the mutation to fail
    msw: {
      handlers: [
        http.post("/api/submit", () => HttpResponse.error()),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(canvas.getByRole("alert")).toHaveTextContent(/failed/i);
    });

    // Verify retry button appears
    await expect(
      canvas.getByRole("button", { name: "Retry" })
    ).toBeInTheDocument();
  },
};
```

### Testing Offline Scenarios

Simulate offline state in stories for the offline-first PWA:

```typescript
export const OfflineSubmission: Story = {
  decorators: [
    (Story) => {
      // Mock navigator.onLine
      Object.defineProperty(navigator, "onLine", {
        value: false,
        writable: true,
        configurable: true,
      });
      return <Story />;
    },
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("button", { name: "Submit Work" }));

    // Verify offline queuing feedback
    await waitFor(() => {
      expect(canvas.getByText(/queued for sync/i)).toBeInTheDocument();
    });

    // Verify no error shown (offline is expected)
    expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
  },
};
```

### Play Function Best Practices

| Practice | Why |
|----------|-----|
| Use `step()` for multi-part flows | Named steps appear in Interactions panel for debugging |
| Use `waitFor()` for async states | Avoids flaky timing-dependent assertions |
| Set reasonable timeouts | Default 1s may be too short for complex transitions |
| Test keyboard navigation | Verifies accessibility alongside interactions |
| Avoid `sleep()`/`setTimeout()` | Use `waitFor()` to wait for DOM conditions instead |

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
│
├─► New component? ────────────► Part 2: Writing Stories
│                                 → Co-locate story with component
│                                 → Add tags: ["autodocs"]
│                                 → Cover all variants
│                                 → Add play function for interactions
│
├─► Design system docs? ───────► Part 5: Documentation
│                                 → MDX pages for tokens/patterns
│                                 → ColorPalette, Typeset blocks
│                                 → Organize under Design System/
│
├─► Visual regression? ────────► Part 7: Visual Regression
│                                 → Chromatic for CI
│                                 → Test runner for local
│                                 → Review diffs on PR
│
├─► Accessibility check? ──────► Part 4: Addons
│                                 → a11y addon (mandatory)
│                                 → axe-core rules in preview.ts
│                                 → Every story must pass
│
├─► Theme testing? ────────────► Part 4: Theme Switching
│                                 → withThemeByClassName decorator
│                                 → Test light + dark
│
└─► Responsive testing? ───────► Part 6: Responsive Stories
                                  → Viewport parameters
                                  → Mobile, tablet, desktop stories
```

## Related Skills

- `react` — Component composition patterns
- `ui-compliance` — Accessibility requirements verified in Storybook
- `frontend-design` — Visual design system with Storybook-first workflow
- `testing` — Integration between Storybook play functions and Vitest
