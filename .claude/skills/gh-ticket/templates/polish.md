# Polish Template - Green Goods Extension

> This template extends the generic org-level polish template with Green Goods-specific sections.

## Template Structure

```markdown
# [POLISH]: {Title}

## Priority
`critical` | `high` | `medium` | `low`

## Polish Type
`visual` | `interaction` | `accessibility` | `performance` | `responsive`

---

## Green Goods Context

### Package Detection
- [ ] client - PWA (port 3001)
- [ ] admin - Dashboard (port 3002)
- [ ] shared - Hooks & modules

---

## Current State
{Screenshot or description of current state}

## Desired State
{Mockup or description of desired state}

### Before/After Comparison
| Aspect | Current | Desired |
|--------|---------|---------|
| {e.g., Spacing} | {8px} | {16px} |
| {e.g., Color} | {#gray} | {#blue} |

---

## Components Affected
| Component | File | Change |
|-----------|------|--------|
| `{ComponentName}` | `packages/{pkg}/src/components/{Name}.tsx` | {change description} |

---

<details>
<summary>Implementation Details</summary>

### CSS/Styling Changes
```typescript
// Before
className="gap-2 p-2"

// After
className="gap-4 p-4"
```

### Tailwind Classes Reference
- Spacing: `gap-{n}`, `p-{n}`, `m-{n}`
- Colors: Use design tokens from `tailwind.config.ts`
- Typography: `text-{size}`, `font-{weight}`

### GG Design Patterns
- Use Radix UI primitives for accessible components
- Follow existing component patterns in `packages/client/src/components/ui/`
- Check TailwindCSS v4 syntax

</details>

<details>
<summary>Accessibility Checklist</summary>

- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] Focus states visible (ring-2 ring-offset-2)
- [ ] Screen reader compatible (aria-labels)
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Touch targets 44x44px minimum
- [ ] Reduced motion supported (@media prefers-reduced-motion)

### Accessibility Testing
```bash
# Run axe-core audit
npx axe-core packages/client/dist
```

</details>

---

## Related Issues
{AI searches existing issues}
- #{issue} - {title} (relevance: high/medium/low)

---

## Effort Estimate
**AI Suggested:** {X hours}
**Final Estimate:** {user confirms}

---

## CLAUDE.md Compliance
- [ ] TailwindCSS v4 patterns followed
- [ ] No hardcoded colors (use design tokens)
- [ ] Responsive design (mobile-first)
- [ ] i18n for any new text

---

## Best Practices Reference
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Inclusive Components](https://inclusive-components.design/)
- [Radix UI](https://www.radix-ui.com/)
- [TailwindCSS v4](https://tailwindcss.com/docs)
```

## Section Visibility

| Section | Visibility |
|---------|------------|
| Priority, Polish Type | Always visible |
| GG Context (Package) | Always visible |
| Current/Desired State | Always visible |
| Before/After Comparison | Always visible |
| Components Affected | Always visible |
| Implementation Details | Collapsible |
| Accessibility Checklist | Collapsible |
| Related Issues | Always visible |
| Effort Estimate | Always visible |
| Compliance | Always visible |

## Polish Type Detection

```typescript
const POLISH_TYPE_KEYWORDS = {
  visual: ['color', 'spacing', 'typography', 'icon', 'image', 'layout'],
  interaction: ['animation', 'transition', 'hover', 'click', 'feedback'],
  accessibility: ['a11y', 'screen reader', 'keyboard', 'contrast', 'aria'],
  performance: ['loading', 'skeleton', 'lazy', 'optimize', 'speed'],
  responsive: ['mobile', 'tablet', 'breakpoint', 'viewport', 'resize'],
};
```
