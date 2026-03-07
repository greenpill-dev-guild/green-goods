---
name: radix-ui
user-invocable: false
description: Radix UI primitives with TailwindCSS v4 - accessible, unstyled components. Use for dialogs, selects, accordions, popovers, and other interactive UI patterns.
---

# Radix UI Skill

Composing Radix UI primitives with TailwindCSS v4 for accessible, consistent interactive components.

---

## Activation

When invoked:
- Check which Radix primitives are already used in the codebase before adding new ones.
- Follow existing composition patterns in `packages/shared/src/components/`.
- Use TailwindCSS v4 classes for styling — never CSS-in-JS or inline styles.
- Import from the specific `@radix-ui/react-*` package, not a barrel.

## Part 1: Radix Primitives in Use

### Component Map

| Radix Package | Used In | Component |
|--------------|---------|-----------|
| `@radix-ui/react-dialog` | shared, client, admin | ConfirmDialog, DraftDialog, ModalDrawer, MintingDialog |
| `@radix-ui/react-select` | shared, client, admin | Select (form component) |
| `@radix-ui/react-popover` | shared | DatePicker, DateRangePicker |
| `@radix-ui/react-accordion` | client | Faq |
| `@radix-ui/react-avatar` | client, admin | Avatar |
| `@radix-ui/react-tabs` | client, admin | Tab navigation |
| `@radix-ui/react-slot` | client | Button (polymorphic `asChild`) |

### Import Pattern

```typescript
// ✅ Correct: Namespace import for primitives
import * as Dialog from "@radix-ui/react-dialog";
import * as Select from "@radix-ui/react-select";
import * as Popover from "@radix-ui/react-popover";

// ✅ Correct: Named import for Slot
import { Slot } from "@radix-ui/react-slot";

// ❌ Wrong: Don't destructure from namespace
import { Root, Trigger, Content } from "@radix-ui/react-dialog";
```

## Part 2: Composition Patterns

### Dialog Pattern (Most Common)

Based on `packages/shared/src/components/Dialog/ConfirmDialog.tsx`:

```typescript
import * as Dialog from "@radix-ui/react-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  trigger?: React.ReactNode;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  trigger,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-lg">
          <Dialog.Title className="text-lg font-semibold">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {description}
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button className="rounded-lg px-4 py-2 text-sm">Cancel</button>
            </Dialog.Close>
            <button
              onClick={onConfirm}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white"
            >
              Confirm
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

### Select Pattern

Based on `packages/shared/src/components/Form/Select/Select.tsx`:

```typescript
import * as SelectPrimitive from "@radix-ui/react-select";

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export function Select({ value, onValueChange, options, placeholder }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm">
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon />
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="z-50 rounded-lg border bg-white shadow-lg">
          <SelectPrimitive.Viewport className="p-1">
            {options.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="cursor-pointer rounded-md px-3 py-2 text-sm outline-none hover:bg-accent"
              >
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
```

### Polymorphic Button with Slot

Based on `packages/client/src/components/Actions/Button/Base.tsx`:

```typescript
import { Slot } from "@radix-ui/react-slot";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

export function Button({ asChild, variant = "primary", className, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants[variant], className)} {...props} />;
}

// Usage with asChild — renders as <a> but inherits button styles
<Button asChild variant="primary">
  <a href="/gardens">View Gardens</a>
</Button>
```

## Part 3: Accessibility (Built-in)

Radix primitives handle accessibility automatically:

| Feature | Radix Handles | You Must Handle |
|---------|--------------|-----------------|
| Focus management | Dialog traps focus, Select manages focus ring | Visual focus indicators (TailwindCSS `focus-visible:`) |
| ARIA attributes | `role`, `aria-expanded`, `aria-haspopup` | `aria-label` for icon-only triggers |
| Keyboard navigation | Arrow keys, Enter, Escape, Tab | Custom keyboard shortcuts |
| Screen reader text | Announces state changes | Descriptive `Dialog.Title` and `Dialog.Description` |

### Required Accessibility Props

```typescript
// Dialog: MUST have Title and Description (or aria-describedby)
<Dialog.Content>
  <Dialog.Title>Edit Garden</Dialog.Title>          {/* Required */}
  <Dialog.Description>Update settings</Dialog.Description> {/* Required */}
</Dialog.Content>

// If you want to visually hide the title:
<Dialog.Title className="sr-only">Edit Garden</Dialog.Title>
```

## Part 4: Animation with TailwindCSS

```typescript
// Dialog with entry/exit animations
<Dialog.Overlay className="
  fixed inset-0 z-50 bg-black/50
  data-[state=open]:animate-in data-[state=open]:fade-in-0
  data-[state=closed]:animate-out data-[state=closed]:fade-out-0
" />

<Dialog.Content className="
  fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
  data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95
  data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95
" />
```

**Key**: Radix sets `data-state="open"` and `data-state="closed"` on components. Use TailwindCSS `data-[state=*]:` selectors for animations.

## Part 5: Shared vs Client/Admin Components

| Location | Pattern | Example |
|----------|---------|---------|
| `packages/shared/src/components/` | Reusable primitives, form elements | Select, ConfirmDialog, DatePicker |
| `packages/client/src/components/` | Client-specific compositions | DraftDialog, ModalDrawer, Faq |
| `packages/admin/src/components/` | Admin-specific compositions | MintingDialog, MembersModal |

**Rule**: If a Radix composition is used in both client and admin, move it to `shared/src/components/`.

## Anti-Patterns

- **Never use `@radix-ui/themes`** — Green Goods uses primitives + TailwindCSS, not the Radix theme system
- **Never skip `Dialog.Title`** — Required for accessibility (use `sr-only` class to visually hide)
- **Never style Radix components with CSS-in-JS** — Use TailwindCSS classes
- **Never forget `Portal`** — Dialog and Select content should portal out of the DOM tree
- **Never use `z-index` wars** — Radix handles stacking context via Portal; only adjust when layering multiple overlays
- **Never destructure Radix imports** — Use namespace imports (`Dialog.Root`, not `Root`)

## Quick Reference Checklist

### Before Adding a Radix Component

- [ ] Check if the primitive is already composed in shared/client/admin
- [ ] Use namespace import pattern (`import * as X from "@radix-ui/react-x"`)
- [ ] Include `Dialog.Title` and `Dialog.Description` for dialogs
- [ ] Use TailwindCSS `data-[state=*]:` for animations
- [ ] Test keyboard navigation (Tab, Arrow keys, Escape)
- [ ] Portal content renders at document root

## Part 6: Tailwind Variants for Component APIs

When a Radix composition needs multiple variants, use `tv()` from `tailwind-variants` instead of manual `cn()` ternaries:

```typescript
import * as Dialog from "@radix-ui/react-dialog";
import { tv, type VariantProps } from "tailwind-variants";

const overlay = tv({
  base: "fixed inset-0 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
});

const content = tv({
  base: "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-background p-6 shadow-2xl border border-border/50",
  variants: {
    size: {
      sm: "w-[90vw] max-w-sm",
      md: "w-[90vw] max-w-lg",
      lg: "w-[90vw] max-w-2xl",
    },
  },
  defaultVariants: { size: "md" },
});

// Usage: <SizedDialog size="lg">...</SizedDialog>
```

### StatusBadge Pattern

```typescript
import { tv } from "tailwind-variants";

const badge = tv({
  base: "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition-colors",
  variants: {
    status: {
      active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-400",
      pending: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400",
      failed: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-500/10 dark:text-red-400",
      offline: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-400",
    },
  },
});

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return <span className={badge({ status })}>{label}</span>;
}
```

**When to use `tv()` vs `cn()`:**
- `tv()` — Component has 2+ variant dimensions (size, status, intent) or default variants
- `cn()` — Simple conditional class toggling (1 boolean condition)

## Related Skills

- `react` — Component composition patterns
- `ui-compliance` — For WCAG audit checklists and page-level accessibility (this skill handles component-level a11y)
- `storybook` — Stories for Radix compositions
