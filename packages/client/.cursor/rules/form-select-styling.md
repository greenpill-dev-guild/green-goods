# FormSelect Styling Guide

## Overview
The `FormSelect` component now matches the design system used by `FormInput` and `FormText`, with enhanced tag styling that's more lively and cohesive.

## Key Updates

### 1. Control/Container Styling
- **Border**: Matches `FormInput` with `border-stroke-sub-300` (rgb(203 213 225))
- **Focus**: Green ring (`rgb(34 197 94)`) with subtle shadow
- **Border Radius**: `rounded-lg` (0.5rem) like other inputs
- **Padding**: `py-3 px-4` equivalent spacing
- **Min Height**: 3rem for consistency

### 2. Tag Styling (Multi-Value)
Tags are now more lively and align with the Green Goods brand:
- **Background**: `green-100` (rgb(220 252 231))
- **Border**: `green-200` (rgb(187 247 208))
- **Text**: `green-800` (rgb(22 101 52)) with medium font weight
- **Remove Button**: 
  - Default: `green-500`
  - Hover: `green-200` background with `green-800` text
- **Border Radius**: `rounded-md` (0.375rem)
- **Transitions**: Smooth 150ms transitions on all interactions

### 3. Dropdown Menu
- **Border Radius**: `rounded-lg` to match inputs
- **Shadow**: Soft shadow for depth
- **Options**: 
  - Selected: `green-100` background
  - Hover: `green-50` background
  - Active: `green-100` background

### 4. Typography
- **Label**: `font-semibold text-slate-800` matching other form components
- **Placeholder**: `text-slate-400` at 0.875rem
- **Input Text**: `text-slate-800` at 0.875rem

## Before vs After

### Before
- Plain react-select with default styles
- No visual consistency with FormInput/FormText
- Basic gray tags without brand identity
- No focus states matching the design system

### After
- Full design system integration
- Green-themed tags that feel lively and on-brand
- Consistent borders, padding, and focus states
- Smooth transitions and hover effects
- Error message support

## Usage

The component API remains the same:

```typescript
<FormSelect
  name="plantSelection"
  label="Select Plants"
  placeholder="Choose plants..."
  options={[
    { label: "Tomatoes", value: "tomatoes" },
    { label: "Lettuce", value: "lettuce" },
  ]}
  control={control}
  error={errors.plantSelection?.message}
/>
```

## Design Tokens Used

- **Green palette**: green-50, green-100, green-200, green-500, green-800
- **Slate palette**: slate-400, slate-800
- **Border**: stroke-sub-300
- **Focus ring**: green-500 with 10% opacity

All colors use RGB values for consistency with react-select's inline styles.














