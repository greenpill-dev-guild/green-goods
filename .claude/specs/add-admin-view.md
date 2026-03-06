# Task: Add Admin View

## Trigger

A new page or major section in the admin dashboard: new management interface, new data visualization, new configuration panel, or new workflow (e.g., assessment creation, strategy management).

## Acceptance Criteria

The view renders correctly for all three roles (deployer, operator, user) with appropriate access control. Route is registered in `packages/admin/src/router.tsx` with lazy loading and correct guard nesting. All user-facing strings use `intl.formatMessage()` with entries in all three language files (en, es, pt). Dark mode renders without contrast issues (no hardcoded colors, use semantic tokens). Form validation uses Zod + React Hook Form. Transactions use `useToastAction` for loading/success/error feedback. Stories exist for the view and its key sub-components. `bun run test && bun lint && bun build` passes.

## Decomposition

### Step 1: Permission Model
**Packages**: `shared` (if new permission check needed), `admin`
**Input**: Feature requirements specifying who can access the view
**Output**: Determine which route guard to use: `RequireAuth` (any authenticated user), `RequireOperatorOrDeployer` (operator+), or `RequireDeployer` (admin only). If a new permission check is needed (e.g., `canManageStrategies`), add it to `useGardenPermissions` in shared
**Verification**: Identify the guard; confirm it exists in `packages/admin/src/routes/`
**Complexity**: S

### Step 2: Route Registration
**Packages**: `admin`
**Input**: Permission model from Step 1
**Output**: New route in `packages/admin/src/router.tsx` using lazy import pattern: `lazy: async () => ({ Component: (await import("@/views/NewView")).default })`. Nest under appropriate guard. Follow existing URL conventions (`/gardens/:id/feature`)
**Verification**: `cd packages/admin && bun build` (TypeScript resolves the lazy import)
**Complexity**: S

### Step 3: View Component
**Packages**: `admin`
**Input**: Route from Step 2, design specs or existing view as Cathedral Check reference
**Output**: View file at `packages/admin/src/views/FeatureName/index.tsx` (or `FeatureName.tsx`). Uses shared hooks for data (`useGardens`, `useRole`, etc.). Role-conditional rendering with `useRole()`. Loading state with skeleton or spinner. Empty state with `EmptyState` component. Error boundary wrapping
**Verification**: `cd packages/admin && bun build`
**Complexity**: M

### Step 4: Sub-Components
**Packages**: `admin`
**Input**: View from Step 3
**Output**: Domain-specific components at `packages/admin/src/components/FeatureName/`. Follow compound component pattern where applicable (Card with Card.Header, Card.Content, Card.Footer). Use `StatusBadge` for state display. Modals use Radix Dialog. Forms use React Hook Form + Zod resolver
**Verification**: `cd packages/admin && bun build`
**Complexity**: M-L

### Step 5: Shared Hook (if needed)
**Packages**: `shared`
**Input**: Data requirements from Steps 3-4
**Output**: New hook in `packages/shared/src/hooks/{domain}/useNewFeature.ts` if no existing hook provides the data. Add query key to `hooks/query-keys.ts`. Export from `hooks/index.ts` and `src/index.ts`. Never create hooks in admin
**Verification**: `cd packages/shared && bun run test`
**Complexity**: S-M

### Step 6: Internationalization
**Packages**: `shared`
**Input**: All user-facing strings from Steps 3-4
**Output**: New entries in `packages/shared/src/i18n/en.json`, `es.json`, `pt.json`. Use descriptive keys: `admin.featureName.title`, `admin.featureName.emptyState.message`. All three files updated simultaneously
**Verification**: `cd packages/shared && bun build` (i18n keys are compile-time checked)
**Complexity**: S

### Step 7: Stories
**Packages**: `admin` (story files), `shared` (if shared components added)
**Input**: Components from Steps 3-4
**Output**: Story file co-located with component: `Component.stories.tsx`. Include Default, Loading, Empty, Error, and role-variant stories. Title hierarchy: `Admin/Views/FeatureName` for views, `Admin/Components/FeatureName/ComponentName` for sub-components. Mock data using `createMock*` factories from test-utils
**Verification**: `cd packages/shared && bun run storybook` (visual check)
**Complexity**: S-M

### Step 8: Tests
**Packages**: `admin`
**Input**: View and components from Steps 3-4
**Output**: Tests in `packages/admin/src/__tests__/` or co-located. Role-based testing: deployer sees all, operator sees assigned, user sees unauthorized. Permission checks verified. Form validation tested (valid + invalid inputs). Transaction error paths tested (mock contract failures)
**Verification**: `cd packages/admin && bun run test`
**Complexity**: M

### Step 9: Full Stack Verification
**Packages**: all affected
**Input**: All prior steps
**Output**: Full stack passes
**Verification**: `bun run test && bun lint && bun build`
**On Failure**: Fix issues in the originating step, then re-run this verification (max 3 attempts before escalating)
**Complexity**: S

## Edge Cases

- **Dark mode contrast**: Admin uses semantic tokens (`bg-strong`, `text-strong`, etc.) where naming is "visual strength" not "darkness". `bg-strong` is the LIGHTEST bg in dark mode (#F5F5F5), `bg-white` is the DARKEST (#171717). Test both themes. Never hardcode `border-gray-*` or similar Tailwind color utilities.
- **Operator scope filtering**: Operators see only their assigned gardens. Always branch on `isDeployer` vs `operatorGardens` when rendering garden-scoped data. Never expose `allGardens` to operators.
- **Nested buttons**: Radix Dialog `Trigger asChild` can create invalid nested `<button>` elements if the trigger already wraps a button. Check rendered HTML.
- **Form re-render loops**: React Hook Form `reset()` called in `useEffect` with form reference in dependency array causes infinite loops. Use `useCallback` for the reset or call `reset` outside effects.
- **Lazy loading failures**: If the lazy import path is wrong, the error manifests at runtime as a blank page with no console error. Verify the import path resolves during `bun build`.
- **Transaction feedback**: All write operations must use `useToastAction` or `toastService` with loading/success/error states. Never fire-and-forget a contract call.
- **Responsive design**: Admin views are used on tablet and desktop. Test at 768px and 1280px widths minimum.

## Anti-Patterns

- Creating hooks in `packages/admin/src/hooks/` instead of shared
- Hardcoding permission checks (`if (address === '0x...')`) instead of using `useRole`
- Using `console.log` instead of `logger` from shared
- Skipping i18n for "temporary" strings (they are never temporary)
- Importing from `@green-goods/shared/hooks/domain/useHook` instead of barrel import
- Using native `confirm()` or `alert()` instead of Radix Dialog
- Rendering the same content for all roles without permission-scoped data filtering
- Writing stories without dark mode and loading state variants
