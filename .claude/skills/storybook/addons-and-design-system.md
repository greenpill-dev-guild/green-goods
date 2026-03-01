# Addons & Design System Documentation

Storybook addon configuration (a11y, themes, interactions) and design system documentation patterns (MDX pages, component API docs, story organization).

---

## Essential Addons

| Addon | Purpose | Status |
|-------|---------|--------|
| `@storybook/addon-essentials` | Controls, actions, viewport, docs | Included |
| `@storybook/addon-a11y` | Accessibility testing | Required |
| `@storybook/addon-themes` | Theme switching | Required |
| `@storybook/addon-interactions` | Play function testing | Included |

## Accessibility Addon

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

## Theme Switching

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

---

## Design System Documentation

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

```text
Components/           # Reusable UI primitives
  Button
  Card
  Input
  Badge
Domain/               # Business-specific components
  GardenCard
  WorkCard
  ActionCard
  GardenerCard
Patterns/             # Composition examples
  Forms
  Lists
  Layouts
Design System/        # Documentation pages
  Colors
  Typography
  Spacing
```
