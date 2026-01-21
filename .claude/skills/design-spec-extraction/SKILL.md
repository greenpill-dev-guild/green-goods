# Design Specification Extraction Skill

Transform visual design inputs (Figma, mockups, screenshots) into production-ready JSON design specifications and code.

## Activation

Use when:
- Extracting design tokens from Figma
- Creating component specs from mockups
- Syncing design system with code
- User shares design files/screenshots

## Process

### 7-Pass Architecture

Each pass writes output to disk before proceeding.

#### Pass 1: Layout Analysis
Output: `.design-specs/pass-1-layout.json`

Extract:
- Page structure
- Component hierarchy
- Grid systems
- Responsive breakpoints

#### Pass 2: Color Extraction
Output: `.design-specs/pass-2-colors.json`

Extract:
- Primary/secondary/accent colors
- Semantic colors (success, warning, error)
- Background/foreground pairs
- Opacity variants

Map to TailwindCSS v4 format:
```json
{
  "colors": {
    "primary": {
      "50": "#f0fdf4",
      "500": "#22c55e",
      "900": "#14532d"
    }
  }
}
```

#### Pass 3: Typography
Output: `.design-specs/pass-3-typography.json`

Extract:
- Font families
- Size scale
- Line heights
- Font weights
- Letter spacing

Map to Tailwind format:
```json
{
  "fontSize": {
    "xs": ["0.75rem", { "lineHeight": "1rem" }],
    "sm": ["0.875rem", { "lineHeight": "1.25rem" }]
  }
}
```

#### Pass 4: Components
Output: `.design-specs/pass-4-components.json`

Extract:
- Component boundaries
- Atomic classification (atom, molecule, organism)
- Prop variants
- State variations

Map to Radix UI primitives where applicable:
```json
{
  "components": {
    "Button": {
      "radixPrimitive": "Button",
      "variants": ["primary", "secondary", "ghost"],
      "sizes": ["sm", "md", "lg"]
    }
  }
}
```

#### Pass 5: Spacing & Dimensions
Output: `.design-specs/pass-5-spacing.json`

Extract:
- Spacing scale
- Border radii
- Shadows
- Border widths

```json
{
  "spacing": {
    "1": "0.25rem",
    "2": "0.5rem",
    "4": "1rem"
  },
  "borderRadius": {
    "sm": "0.125rem",
    "md": "0.375rem",
    "lg": "0.5rem"
  }
}
```

#### Pass 6: States & Accessibility
Output: `.design-specs/pass-6-states.json`

Extract:
- Hover states
- Focus states
- Active states
- Disabled states
- Contrast ratios (WCAG compliance)

```json
{
  "states": {
    "Button": {
      "hover": { "backgroundColor": "primary-600" },
      "focus": { "ring": "2px", "ringColor": "primary-500" },
      "disabled": { "opacity": "0.5" }
    }
  },
  "accessibility": {
    "contrastRatios": {
      "primary-text": 7.2,
      "secondary-text": 4.8
    }
  }
}
```

#### Pass 7: Consolidation
Output: `.design-specs/design-spec.json`

Merge all passes into single specification with:
- All design tokens
- Component hierarchy
- Accessibility analysis
- Confidence scores

### Green Goods Integration

After extraction, map to existing project structure:

1. **TailwindCSS v4 Config**
   - Update `tailwind.config.ts` with extracted tokens
   - Use CSS custom properties format

2. **Radix UI Components**
   - Map to existing components in shared package
   - Identify new components needed

3. **Variable Mapping**
   - Match extracted colors to existing design variables
   - Identify conflicts/additions

### Output Structure

```
.design-specs/
├── pass-1-layout.json
├── pass-2-colors.json
├── pass-3-typography.json
├── pass-4-components.json
├── pass-5-spacing.json
├── pass-6-states.json
├── design-spec.json          # Final consolidated spec
└── tailwind-updates.json     # Ready-to-apply Tailwind changes
```

## Using Figma MCP

When Figma file provided, use MCP tools:

```
mcp__figma-remote-mcp__get_design_context
mcp__figma-remote-mcp__get_variable_defs
mcp__figma-remote-mcp__get_screenshot
```

Extract node IDs from Figma URLs:
- URL: `https://figma.com/design/:fileKey/:fileName?node-id=1-2`
- fileKey: `:fileKey`
- nodeId: `1:2`

## Validation

After extraction:
1. Cross-reference all token usage
2. Verify WCAG contrast compliance
3. Check for missing tokens
4. Validate component mappings

## Key Principles

- **File-based persistence** - Every pass writes to disk
- **Sequential execution** - Each pass builds on previous
- **Validation** - Cross-references must resolve
- **Confidence scoring** - Rate certainty of extractions
