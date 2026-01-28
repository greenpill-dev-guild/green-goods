# Code Review Checklist

Comprehensive checklist for reviewing pull requests in the Green Goods codebase. Use this to ensure consistent, high-quality reviews across all contributions.

---

## All PRs (General)

### Code Quality
- [ ] Code follows existing patterns in neighboring files
- [ ] No unnecessary complexity (KISS principle applied)
- [ ] No premature abstractions (Rule of Three followed)
- [ ] No duplicate code that should be extracted (DRY principle)
- [ ] Changes are minimal and focused (Single Responsibility)
- [ ] No dead code, commented-out code, or unused imports
- [ ] Self-documenting names for functions, variables, and types
- [ ] Comments explain "why" not "what" (only where logic isn't obvious)

### Architecture
- [ ] Follows monorepo package boundaries (hooks in `@green-goods/shared`)
- [ ] No circular dependencies between packages
- [ ] Changes don't break build order (contracts → shared → indexer → apps)
- [ ] No package-specific `.env` files (uses root `.env` only)
- [ ] Contract addresses imported from deployment artifacts, not hardcoded

### Testing
- [ ] Tests added for new functionality
- [ ] Tests updated for changed functionality
- [ ] Test names describe behavior, not implementation
- [ ] No flaky tests (time-dependent, order-dependent, etc.)
- [ ] Coverage requirements met:
  - Client/Admin: 70%+
  - Shared: 80%+
  - Contracts: 100% for mainnet
  - Auth/encryption paths: 100%

### Git Hygiene
- [ ] Commits follow conventional commit format (`feat(scope): message`)
- [ ] Each commit is atomic and focused
- [ ] PR description explains "why" and includes test plan
- [ ] Branch is up to date with target branch
- [ ] No merge commits (rebased)

---

## Frontend PRs (React/TypeScript)

### React Patterns
- [ ] Hooks follow Rules of Hooks (top-level, consistent order)
- [ ] No hooks defined in client/admin packages (use `@green-goods/shared`)
- [ ] State lifted appropriately (local vs. Zustand vs. TanStack Query)
- [ ] Effects have correct dependency arrays
- [ ] Effects include proper cleanup functions
- [ ] Memoization (`useMemo`, `useCallback`, `memo`) used appropriately:
  - Expensive computations
  - Callbacks passed to memoized children
  - Objects in dependency arrays
- [ ] No anonymous functions in JSX that could cause re-renders

### TypeScript
- [ ] No `any` types (use `unknown` with type guards)
- [ ] Discriminated unions for state variants
- [ ] `as const` for literal types
- [ ] Zod schemas for runtime validation
- [ ] AbortSignals for cancellable async operations
- [ ] Proper error typing (no bare `catch (e)`)

### Component Quality
- [ ] Components are focused (single responsibility)
- [ ] Props have appropriate types and defaults
- [ ] Loading states handled gracefully
- [ ] Error states handled with user-friendly messages
- [ ] Empty states designed and implemented
- [ ] Components are accessible (see Accessibility section)

### Styling
- [ ] Uses Tailwind CSS semantic tokens from theme
- [ ] No hardcoded colors (use `text-text-strong`, `bg-bg-white`, etc.)
- [ ] Responsive design considered (mobile-first)
- [ ] No z-index conflicts (follows established layers)
- [ ] CSS animations respect reduced-motion preferences

### Data Fetching
- [ ] TanStack Query used for server state
- [ ] Appropriate `staleTime` configured
- [ ] Error boundaries around query-dependent components
- [ ] Optimistic updates where appropriate
- [ ] Query keys follow established patterns

---

## Accessibility (WCAG 2.1 AA)

### Semantic HTML
- [ ] Correct heading hierarchy (h1 → h2 → h3)
- [ ] Lists use `<ul>`, `<ol>`, `<dl>` appropriately
- [ ] Tables have proper `<th>`, `scope`, and captions
- [ ] Landmarks used (`<main>`, `<nav>`, `<aside>`)
- [ ] Buttons are `<button>`, links are `<a>`

### Forms
- [ ] Every input has associated `<label>` with `htmlFor`
- [ ] Required fields marked with `aria-required="true"`
- [ ] Error messages linked via `aria-describedby`
- [ ] Invalid fields have `aria-invalid="true"`
- [ ] Errors announced with `role="alert"`
- [ ] Focus moves to first error on validation failure
- [ ] Autocomplete attributes set for common fields

### Modals & Dialogs
- [ ] `role="dialog"` or `role="alertdialog"` present
- [ ] `aria-modal="true"` set
- [ ] `aria-labelledby` points to visible title
- [ ] Focus moves to modal on open
- [ ] Focus is trapped within modal
- [ ] Focus returns to trigger element on close
- [ ] Escape key closes modal
- [ ] Background content is inert

### Keyboard Navigation
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators visible (not removed)
- [ ] Tab order is logical
- [ ] No keyboard traps
- [ ] Custom widgets have appropriate key handlers

### Visual
- [ ] Color contrast ratios met (4.5:1 text, 3:1 UI elements)
- [ ] Information not conveyed by color alone
- [ ] Focus indicators visible and high contrast
- [ ] Touch targets minimum 44x44px
- [ ] Text resizable to 200% without loss of functionality

### Screen Readers
- [ ] Images have meaningful `alt` text (or `alt=""` for decorative)
- [ ] Icons have `aria-hidden="true"` when decorative
- [ ] Icon-only buttons have accessible names
- [ ] Dynamic content announced with `aria-live`
- [ ] Loading states communicated

---

## Performance

### Bundle Size
- [ ] No unnecessary dependencies added
- [ ] Heavy libraries lazy-loaded or dynamically imported
- [ ] Code-split at route boundaries
- [ ] Bundle analyzer run if adding new dependencies
- [ ] Images optimized and lazy-loaded

### React Performance
- [ ] No render loops (infinite re-renders)
- [ ] Large lists virtualized (50+ items)
- [ ] Expensive computations memoized
- [ ] No objects created in render that could break memoization
- [ ] Profiler used for suspicious performance issues

### Data
- [ ] Queries batched where possible
- [ ] Appropriate caching strategies
- [ ] Prefetching for anticipated navigation
- [ ] IndexedDB operations batched in transactions
- [ ] Pagination for large data sets

### Network
- [ ] API calls minimized (no duplicate fetches)
- [ ] Images served in modern formats (WebP)
- [ ] Appropriate cache headers
- [ ] Service worker caching strategies correct

---

## Security

### General
- [ ] No sensitive data in logs (keys, tokens, PII)
- [ ] No secrets in client-side code
- [ ] User input validated and sanitized
- [ ] No `innerHTML` with user content (use `textContent`)
- [ ] Content Security Policy not weakened

### Authentication
- [ ] Auth state checked before protected actions
- [ ] Session expiry handled gracefully
- [ ] Tokens not exposed in URLs
- [ ] Logout clears all sensitive state

### Data Handling
- [ ] PII handled according to privacy requirements
- [ ] Encryption used for sensitive storage
- [ ] No unnecessary data exposure in API responses
- [ ] IndexedDB data cleared on logout

---

## Contract PRs (Solidity)

### Security Patterns
- [ ] Checks-Effects-Interactions (CEI) pattern followed
- [ ] Reentrancy guards on external calls
- [ ] Pull-over-Push for payments
- [ ] No `tx.origin` for authorization
- [ ] Access control on all state-changing functions
- [ ] Events emitted for all state changes

### Visibility & Safety
- [ ] All functions have explicit visibility
- [ ] State variables use appropriate visibility
- [ ] `external` preferred over `public` for gas
- [ ] No floating pragma (exact version specified)
- [ ] SafeMath not needed (Solidity 0.8+)

### Upgradeability
- [ ] UUPS proxy pattern followed correctly
- [ ] Storage layout preserved (no gaps broken)
- [ ] Initializers protected with `initializer` modifier
- [ ] No `constructor` logic (use `initialize`)
- [ ] Version tracking for upgrades

### Gas Optimization
- [ ] Storage reads minimized (cache in memory)
- [ ] Batch operations where possible
- [ ] Tight variable packing in structs
- [ ] `unchecked` blocks for safe arithmetic
- [ ] Appropriate use of `calldata` vs `memory`

### Testing
- [ ] Unit tests for all functions
- [ ] Fuzz tests for functions with parameters
- [ ] Invariant tests for critical properties
- [ ] Integration tests for multi-contract interactions
- [ ] Gas snapshot updated and reviewed
- [ ] Fork tests for mainnet interactions

### Documentation
- [ ] NatSpec for all public/external functions
- [ ] Events documented
- [ ] Errors documented
- [ ] Complex logic explained

---

## Offline-First (Client PWA)

- [ ] Operations work without network
- [ ] Job queue used for sync-dependent operations
- [ ] Graceful degradation when offline
- [ ] Clear offline indicators for users
- [ ] Data persisted to IndexedDB
- [ ] Conflict resolution strategy defined
- [ ] Service worker updated appropriately

---

## Quick Reference: Severity Guide

| Issue | Severity | Action |
|-------|----------|--------|
| Security vulnerability | **Blocker** | Must fix before merge |
| Accessibility regression | **Blocker** | Must fix before merge |
| Test coverage below threshold | **Blocker** | Must add tests |
| Performance regression (>20%) | **High** | Should fix before merge |
| Missing error handling | **High** | Should fix before merge |
| Code style inconsistency | **Medium** | Prefer to fix |
| Minor refactoring opportunity | **Low** | Nice to have |
| Documentation missing | **Low** | Can follow up |

---

## Review Etiquette

1. **Be specific**: Point to exact lines, suggest fixes
2. **Explain why**: Share the reasoning, not just the rule
3. **Distinguish severity**: Blocking vs. suggestions vs. nitpicks
4. **Acknowledge good work**: Call out well-done code
5. **Ask questions**: "Could you explain..." vs. "This is wrong"
6. **Be timely**: Review within 24 hours when possible
7. **Follow up**: Verify fixes before approving

---

*Last updated: January 2026*
