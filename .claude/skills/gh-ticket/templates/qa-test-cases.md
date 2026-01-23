# QA Test Cases Template

> **Purpose**: Define test cases for a feature before/during implementation.
> **Use when**: Feature spec is approved and ready for implementation.
> **Storage**: Database + Docs (linked in GitHub Story issue as checklist)

---

## Template Structure

```markdown
# QA Test Cases: {Feature Name}

## Metadata

| Field | Value |
|-------|-------|
| **Feature Spec** | {Feature Spec link} |
| **Tech Spec** | {Tech Spec link} |
| **GitHub Story** | #{story_number} |
| **Author** | {name} |
| **Created** | {date} |
| **Last Updated** | {date} |

---

## Test Coverage Summary

| Category | Total | Automated | Manual |
|----------|-------|-----------|--------|
| Happy Path | {N} | {N} | {N} |
| Error Cases | {N} | {N} | {N} |
| Edge Cases | {N} | {N} | {N} |
| Accessibility | {N} | {N} | {N} |
| Offline | {N} | {N} | {N} |
| **Total** | {N} | {N} | {N} |

---

## Test Environment

### Prerequisites
- [ ] Test account with {role} permissions
- [ ] Test garden with sample data
- [ ] Network throttling tools (for offline tests)
- [ ] Screen reader (for a11y tests)

### Test Data
| Data | Value | Purpose |
|------|-------|---------|
| Test Garden ID | `0x{...}` | Primary test garden |
| Test User | `gardener@test.com` | Standard user |
| Test Operator | `operator@test.com` | Elevated permissions |

---

## Happy Path Tests

### HP-1: {Primary User Flow}

**Priority**: P0 (Must Pass)

**Preconditions**:
- User is authenticated as {role}
- {Other preconditions}

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | {action} | {expected} | ☐ |
| 2 | {action} | {expected} | ☐ |
| 3 | {action} | {expected} | ☐ |

**Automation**: `tests/e2e/{feature}.spec.ts:test('primary flow')`

---

### HP-2: {Secondary User Flow}

**Priority**: P1

**Preconditions**:
- {preconditions}

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | {action} | {expected} | ☐ |
| 2 | {action} | {expected} | ☐ |

**Automation**: `tests/e2e/{feature}.spec.ts:test('secondary flow')`

---

## Error Case Tests

### EC-1: {Validation Error}

**Priority**: P1

**Preconditions**:
- {preconditions}

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Enter invalid {field} | Show validation error: "{message}" | ☐ |
| 2 | Correct the error | Error clears, form submittable | ☐ |

**Error Code**: `{ERROR_CODE}`
**i18n Key**: `{feature}.errors.{key}`

---

### EC-2: {Network Error}

**Priority**: P1

**Preconditions**:
- Network available initially

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Start action | Loading indicator shown | ☐ |
| 2 | Disconnect network mid-request | Error toast with retry option | ☐ |
| 3 | Reconnect and retry | Action completes successfully | ☐ |

---

### EC-3: {Permission Error}

**Priority**: P0

**Preconditions**:
- User lacks {permission}

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Attempt restricted action | Access denied message | ☐ |
| 2 | - | No state change occurs | ☐ |

---

## Edge Case Tests

### EDGE-1: {Empty State}

**Priority**: P2

**Preconditions**:
- No {items} exist

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to {screen} | Empty state illustration shown | ☐ |
| 2 | - | CTA to create first {item} | ☐ |

---

### EDGE-2: {Large Data Set}

**Priority**: P2

**Preconditions**:
- {100+} items exist

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Load {screen} | Initial batch loads in < 2s | ☐ |
| 2 | Scroll to bottom | Pagination/infinite scroll works | ☐ |
| 3 | - | No performance degradation | ☐ |

---

### EDGE-3: {Concurrent Modification}

**Priority**: P1

**Preconditions**:
- Two users viewing same {item}

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | User A edits {item} | Changes saved | ☐ |
| 2 | User B attempts edit | Conflict detected, refresh prompted | ☐ |

---

## Offline Tests

### OFF-1: {Offline Read}

**Priority**: P1 (if offline required)

**Preconditions**:
- Data previously cached
- Network disconnected

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate to {screen} | Cached data displayed | ☐ |
| 2 | - | Offline indicator shown | ☐ |
| 3 | - | Stale data warning (if applicable) | ☐ |

---

### OFF-2: {Offline Write}

**Priority**: P1 (if offline required)

**Preconditions**:
- Network disconnected

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Submit {action} | "Queued for sync" message | ☐ |
| 2 | - | Optimistic UI update | ☐ |
| 3 | Reconnect | Action syncs automatically | ☐ |
| 4 | - | Success confirmation | ☐ |

**Job Type**: `{JOB_TYPE}`

---

## Accessibility Tests

### A11Y-1: {Keyboard Navigation}

**Priority**: P1

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Tab through {screen} | Logical focus order | ☐ |
| 2 | Enter on {element} | Activates element | ☐ |
| 3 | Escape in {modal} | Closes modal | ☐ |

---

### A11Y-2: {Screen Reader}

**Priority**: P1

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Navigate with VoiceOver/NVDA | All content announced | ☐ |
| 2 | Interact with {form} | Labels read correctly | ☐ |
| 3 | Trigger {error} | Error announced | ☐ |

---

### A11Y-3: {Color Contrast}

**Priority**: P2

| Element | Contrast Ratio | WCAG AA (4.5:1) | Pass/Fail |
|---------|---------------|-----------------|-----------|
| Body text | {ratio} | ☐ | ☐ |
| Button text | {ratio} | ☐ | ☐ |
| Error text | {ratio} | ☐ | ☐ |

**Tool**: Axe DevTools, Lighthouse

---

## Responsive Tests

### RESP-1: {Mobile (375px)}

**Priority**: P1

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | View on 375px viewport | Layout adapts properly | ☐ |
| 2 | Touch {button} | Adequate touch target (44px) | ☐ |
| 3 | Complete {flow} | All functionality accessible | ☐ |

---

### RESP-2: {Tablet (768px)}

**Priority**: P2

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | View on 768px viewport | Layout adapts properly | ☐ |

---

## Performance Tests

### PERF-1: {Initial Load}

**Priority**: P1

| Metric | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| LCP | < 2.5s | {actual} | ☐ |
| FID | < 100ms | {actual} | ☐ |
| CLS | < 0.1 | {actual} | ☐ |

**Tool**: Lighthouse, WebPageTest

---

### PERF-2: {Action Response}

**Priority**: P1

| Action | Target | Actual | Pass/Fail |
|--------|--------|--------|-----------|
| {Action 1} | < 500ms | {actual} | ☐ |
| {Action 2} | < 1s | {actual} | ☐ |

---

## Contract Tests (if applicable)

### CONTRACT-1: {Contract Function}

**Priority**: P0

**Preconditions**:
- Test network (Base Sepolia)
- Test wallet with ETH

| Step | Action | Expected Result | Pass/Fail |
|------|--------|-----------------|-----------|
| 1 | Call {function} with valid params | Transaction succeeds | ☐ |
| 2 | - | Event {EventName} emitted | ☐ |
| 3 | - | State updated correctly | ☐ |

**Test File**: `packages/contracts/test/{Feature}.t.sol`

---

## Regression Tests

List of existing tests that must still pass:

| Test Suite | File | Status |
|------------|------|--------|
| {Suite 1} | `{path}` | ☐ Pass |
| {Suite 2} | `{path}` | ☐ Pass |

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| QA Lead | {name} | {date} | ☐ Approved |
| Dev Lead | {name} | {date} | ☐ Approved |
| Product | {name} | {date} | ☐ Approved |

---

## Notes

{Any additional testing notes, known issues, or special considerations}
```

---

## Converting to GitHub Story Checklist

When creating a Story issue, include QA test cases as checklist:

```markdown
## QA Checklist

📄 **Full Test Cases**: [Link to this doc]

### P0 Tests (Must Pass)
- [ ] HP-1: Primary user flow
- [ ] EC-3: Permission error handling
- [ ] CONTRACT-1: Contract function

### P1 Tests (Should Pass)
- [ ] HP-2: Secondary user flow
- [ ] EC-1: Validation error
- [ ] EC-2: Network error
- [ ] OFF-1: Offline read
- [ ] OFF-2: Offline write
- [ ] A11Y-1: Keyboard navigation
- [ ] A11Y-2: Screen reader
- [ ] RESP-1: Mobile (375px)
- [ ] PERF-1: Initial load
- [ ] PERF-2: Action response

### P2 Tests (Nice to Pass)
- [ ] EDGE-1: Empty state
- [ ] EDGE-2: Large data set
- [ ] A11Y-3: Color contrast
- [ ] RESP-2: Tablet (768px)
```
