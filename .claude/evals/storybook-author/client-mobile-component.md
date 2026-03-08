# Storybook Author Eval: Client Mobile-First Component Story

## Brief

Write a story file for the `ActionCard` component in client at `packages/client/src/components/ActionCard.tsx`. This is a mobile-first card component used by gardeners to view available actions. It should include mobile viewport parameters.

## Requirements

1. Create story at `packages/client/src/components/ActionCard.stories.tsx`
2. CSF3 format with `tags: ["autodocs"]`
3. Title: `Client/Cards/ActionCard` (following client hierarchy convention)
4. Required exports: Default, DarkMode, Gallery
5. Mobile viewport parameters (client components are mobile-first)
6. Realistic mock data representing actual garden actions

## Passing Criteria

- MUST read `ActionCard.tsx` source before writing story
- MUST use title `Client/Cards/ActionCard`
- MUST include Default, DarkMode, Gallery exports
- MUST include viewport parameters for mobile (375px) and tablet (768px)
- MUST use `data-theme="dark"` attribute for DarkMode
- MUST use Remixicon icons (not lucide)
- MUST use semantic tokens from theme.css
- MUST NOT add global decorators
- MUST use realistic mock data (actual action types, descriptions)
- SHOULD show multiple action states in Gallery (available, completed, disabled)

## Common Failure Modes

- Missing mobile viewport parameters (client components are mobile-first)
- Using `Cards/ActionCard` instead of `Client/Cards/ActionCard`
- Using generic placeholder data instead of domain-specific action data
- Not showing different action states in Gallery
- Using lucide icons instead of Remixicon
- Missing DarkMode export
- Not reading the component source before writing the story
