# Storybook Author Eval: Admin Compound Component Story

## Brief

Write a story file for the `DepositModal` component in admin at `packages/admin/src/components/Vault/DepositModal.tsx`. This is a compound component with form fields, validation, and transaction flow. It requires wallet state mocking.

## Requirements

1. Create story at `packages/admin/src/components/Vault/DepositModal.stories.tsx`
2. CSF3 format with `tags: ["autodocs"]`
3. Title: `Admin/Vault/DepositModal` (following admin hierarchy convention)
4. Required exports: Default, DarkMode, Gallery
5. Interactive export with `play()` function that fills the deposit form
6. Realistic mock data (valid ETH amounts, addresses)
7. Mock wallet/provider state without duplicating global decorators

## Passing Criteria

- MUST read `DepositModal.tsx` source before writing story
- MUST use title `Admin/Vault/DepositModal`
- MUST include Default, DarkMode, Gallery, and Interactive exports
- MUST include `play()` function in Interactive story that interacts with the form
- MUST use `data-theme="dark"` attribute for DarkMode
- MUST NOT add IntlProvider/QueryClientProvider/ThemeDecorator (already global)
- MUST NOT use lucide icons
- MUST use semantic tokens from theme.css, not hardcoded colors
- MUST use realistic mock data (not placeholder values like "0x000...")
- SHOULD include argTypes for public props

## Common Failure Modes

- Using `Components/Vault/DepositModal` instead of `Admin/Vault/DepositModal`
- Missing Interactive story for a form component
- Using placeholder addresses instead of realistic checksummed addresses
- Adding redundant global decorators
- Not mocking wallet state (component requires connected wallet)
- Using class-based dark mode
- Missing `play()` function for form interaction testing
