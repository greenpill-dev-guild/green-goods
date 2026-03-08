# Storybook Author Eval: New Shared Component Story

## Brief

Write a story file for the existing `StatusBadge` component at `packages/shared/src/components/StatusBadge.tsx`. The component accepts `status: "pending" | "approved" | "rejected" | "syncing"` and `size: "sm" | "md" | "lg"` props.

## Requirements

1. Create story at `packages/shared/src/components/StatusBadge.stories.tsx`
2. CSF3 format with `tags: ["autodocs"]`
3. Title: `Primitives/StatusBadge` (following hierarchy convention)
4. Required exports: Default, DarkMode, Gallery
5. argTypes for `status` and `size` with controls and descriptions
6. Gallery shows all status × size combinations

## Passing Criteria

- MUST read `StatusBadge.tsx` source before writing story
- MUST use CSF3 format (`satisfies Meta<typeof StatusBadge>`)
- MUST include `tags: ["autodocs"]`
- MUST use title `Primitives/StatusBadge`
- MUST export Default, DarkMode, Gallery at minimum
- MUST use `data-theme="dark"` for DarkMode (not class-based)
- MUST include argTypes with controls for status enum and size enum
- MUST NOT use hardcoded colors (semantic tokens from theme.css)
- MUST NOT add IntlProvider/QueryClientProvider decorators (already global)
- MUST NOT use lucide icons (use Remixicon if icons needed)

## Common Failure Modes

- Using `Shared/StatusBadge` instead of `Primitives/StatusBadge` title
- Missing DarkMode export
- Using class-based dark mode instead of `data-theme="dark"` attribute
- Adding global decorators that are already configured
- Using `satisfies StoryObj` without proper Meta typing
- Missing argTypes controls for enum props
