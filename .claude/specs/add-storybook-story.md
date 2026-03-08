# Task: Add Storybook Story

## Trigger

A new component is added to `packages/shared/src/components/`, `packages/admin/src/components/`, or `packages/client/src/components/` and needs a story file. Or an existing component lacks story coverage for dark mode, interaction tests, or variant documentation.

## Acceptance Criteria

The story file is co-located with the component (`ComponentName.stories.tsx` next to `ComponentName.tsx`). CSF3 format with `tags: ["autodocs"]`. Minimum exports: Default, DarkMode, Gallery. Interactive components include a story with `play()` function. Title follows the hierarchy convention from the storybook-author agent. `bun run build-storybook` succeeds (run from `packages/shared/`).

## Decomposition

### Step 1: Read Component Source
**Packages**: `shared`, `admin`, or `client`
**Input**: Component file path
**Output**: Understanding of all public props (with types), variants, states (loading, error, empty), and dependencies (hooks, providers, context). Determine the correct title hierarchy category
**Verification**: All public props identified. Title category matches storybook-author convention table
**Complexity**: S

### Step 2: Check Existing Coverage
**Packages**: same as component
**Input**: Component path
**Output**: Check if a `.stories.tsx` file already exists. If yes, identify missing coverage (dark mode, variants, interaction tests). If no, proceed to Step 3
**Verification**: File presence confirmed
**Complexity**: S

### Step 3: Write Story File
**Packages**: same as component
**Input**: Component analysis from Step 1
**Output**: Story file with: meta (title, component, tags, argTypes for all public props with controls and descriptions), Default story, DarkMode story with `data-theme="dark"` wrapper, Gallery story showing all variants. For interactive components: Interactive story with `play()` function using `@storybook/test` imports. Use Remixicon (not lucide). Use semantic tokens (not hardcoded colors). Do not add decorators for providers that are configured globally (IntlProvider, QueryClientProvider, ThemeDecorator)
**Verification**: File exists with all required exports
**Complexity**: M

### Step 4: Mock Data Setup
**Packages**: same as component
**Input**: Component dependencies
**Output**: If the component depends on shared hooks or domain data, create mock data objects matching the domain types (`Garden`, `Work`, `Action`, etc.). Use realistic values, not placeholder strings. For admin/client components that call shared hooks, mock at the module level
**Verification**: Stories render without runtime errors
**Complexity**: S-M

### Step 5: Build Verification
**Packages**: `shared` (Storybook is built from shared)
**Input**: Story file from Step 3
**Output**: Storybook builds successfully
**Verification**: `cd packages/shared && bun run build-storybook`
**On Failure**: Fix story file issues (imports, mock data, decorator conflicts), then re-run build (max 3 attempts before escalating)
**Complexity**: S

## Edge Cases

- **Provider dependencies**: Components using `useIntl`, `useQuery`, or theme context get these from global decorators in `preview.tsx`. Do not re-wrap them. Only add local decorators for component-specific context (e.g., a custom provider not in the global chain).
- **Admin vs Client title hierarchy**: Admin stories use `Admin/{Category}/` prefix. Client stories use `Client/{Category}/` prefix. Shared stories use top-level categories (Primitives, Form Controls, Cards, etc.).
- **Package-scoped imports**: The `packageScopedAliasPlugin` in Storybook's `main.ts` resolves `@/` imports dynamically. Stories for admin components use `@/` which resolves to `packages/admin/src/`. This works automatically.
- **Dark mode wrapper**: Use `data-theme="dark"` attribute (not class-based). Wrap with `bg-bg-white-0` to get the dark background token.
- **Responsive stories for client components**: Client components are mobile-first. Consider adding viewport parameters for mobile and tablet views.

## Anti-Patterns

- Creating stories for components that don't exist yet
- Using lucide icons (project uses Remixicon: `@remixicon/react`)
- Adding IntlProvider or QueryClientProvider decorators (already global)
- Using hardcoded colors instead of semantic tokens from `theme.css`
- Using class-based dark mode instead of `data-theme="dark"` attribute
- Writing placeholder mock data ("Lorem ipsum", "Test 123") instead of realistic domain values
- Skipping argTypes for public props (prevents autodocs from generating useful documentation)
