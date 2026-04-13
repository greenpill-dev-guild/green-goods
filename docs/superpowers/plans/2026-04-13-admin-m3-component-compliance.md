# Admin M3 Component Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring all admin dashboard components to strict Material Design 3 v0.192 anatomy compliance, using admin-only overrides with zero shared package changes.

**Architecture:** New `Admin*` components in `packages/admin/src/components/` accept the same data contracts as shared primitives but render M3-strict visual anatomy. A shared CSS token file (`admin-m3-tokens.css`) provides elevation, shape, and state-layer primitives. Admin views swap imports from shared → admin components.

**Tech Stack:** React 19, Tailwind CSS v4, tailwind-variants, Remix Icons, CSS custom properties for M3 tokens

**Spec:** `docs/superpowers/specs/2026-04-13-admin-m3-component-compliance-design.md`

---

## File Structure

### New files

```
packages/admin/src/styles/admin-m3-tokens.css         — M3 elevation, shape, state-layer CSS tokens
packages/admin/src/styles/admin-m3-overrides.css       — CSS overrides for shared components (nav, sheets, toast)
packages/admin/src/components/AdminTabRail.tsx          — M3 primary navigation tabs
packages/admin/src/components/AdminSearchToolbar.tsx    — M3 search bar (56dp pill)
packages/admin/src/components/AdminFilterChip.tsx       — M3 filter chip (32dp)
packages/admin/src/components/AdminTextField.tsx        — M3 filled text field with floating label
packages/admin/src/components/AdminButton.tsx           — M3 5-variant button system
packages/admin/src/components/AdminFab.tsx              — M3 FAB (56dp, corner-large)
packages/admin/src/components/AdminCheckbox.tsx         — M3 checkbox (18dp, primary)
packages/admin/src/components/AdminCard.tsx             — M3 3-variant card system
packages/admin/src/components/AdminDialog.tsx           — M3 basic dialog (28dp, headline-small)
packages/admin/src/components/AdminListItem.tsx         — M3 list item (56/72/88dp)
packages/admin/src/components/AdminBadge.tsx            — M3 notification badge (error color)
packages/admin/src/components/AdminTooltip.tsx          — M3 plain tooltip
packages/admin/src/components/AdminLinearProgress.tsx   — M3 linear progress (4dp track)
```

### Modified files

```
packages/admin/src/index.css                                    — import new token + override CSS
packages/admin/src/views/Hub/index.tsx                          — swap TabRail, ListToolbar, SortSelect
packages/admin/src/views/Garden/index.tsx                       — swap TabRail, ListToolbar, SortSelect
packages/admin/src/views/Actions/index.tsx                      — swap TabRail, ListToolbar, SortSelect
packages/admin/src/views/Community/index.tsx                    — swap TabRail, ListToolbar, SortSelect
packages/admin/src/components/Layout/AccountSurface.tsx         — swap TabRail
packages/admin/src/components/Layout/CanvasLayout.tsx           — add admin nav override class
packages/admin/src/main.tsx                                     — toast config
```

---

## Phase 1: M3 Token Foundation

### Task 1: Create M3 token CSS file

**Files:**
- Create: `packages/admin/src/styles/admin-m3-tokens.css`
- Modify: `packages/admin/src/index.css`

- [ ] **Step 1: Create the M3 tokens CSS file**

```css
/* packages/admin/src/styles/admin-m3-tokens.css */

/* M3 Elevation Scale (v0.192)
 * Applied via box-shadow on admin components.
 * Use: shadow-[var(--m3-elevation-N)]
 */
:root {
  --m3-elevation-0: none;
  --m3-elevation-1: 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15);
  --m3-elevation-2: 0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15);
  --m3-elevation-3: 0 1px 3px rgba(0, 0, 0, 0.3), 0 4px 8px 3px rgba(0, 0, 0, 0.15);
  --m3-elevation-4: 0 2px 3px rgba(0, 0, 0, 0.3), 0 6px 10px 4px rgba(0, 0, 0, 0.15);
  --m3-elevation-5: 0 4px 4px rgba(0, 0, 0, 0.3), 0 8px 12px 6px rgba(0, 0, 0, 0.15);
}

/* M3 Shape Scale
 * Use: rounded-[var(--m3-shape-X)]
 */
:root {
  --m3-shape-none: 0px;
  --m3-shape-xs: 4px;
  --m3-shape-sm: 8px;
  --m3-shape-md: 12px;
  --m3-shape-lg: 16px;
  --m3-shape-xl: 28px;
  --m3-shape-full: 9999px;
}

/* M3 State Layer Opacity
 * Applied via ::after pseudo-element on interactive components.
 * background: rgb(var(--state-layer-color) / var(--m3-state-hover));
 */
:root {
  --m3-state-hover: 0.08;
  --m3-state-focus: 0.12;
  --m3-state-pressed: 0.12;
  --m3-state-dragged: 0.16;
}

/* M3 Surface Color Aliases
 * Map M3 role names to existing theme RGB triplets.
 * Usage: bg-[rgb(var(--m3-surface))]
 */
:root {
  --m3-surface: var(--bg-white-0);
  --m3-surface-dim: var(--neutral-200);
  --m3-surface-container-lowest: 255 255 255;
  --m3-surface-container-low: var(--neutral-50);
  --m3-surface-container: var(--neutral-100);
  --m3-surface-container-high: var(--neutral-200);
  --m3-surface-container-highest: var(--neutral-300);
  --m3-on-surface: var(--text-strong-950);
  --m3-on-surface-variant: var(--text-sub-600);
  --m3-outline: var(--stroke-sub-300);
  --m3-outline-variant: var(--stroke-soft-200);
  --m3-inverse-surface: var(--neutral-900);
  --m3-inverse-on-surface: var(--neutral-100);
  --m3-inverse-primary: var(--green-200);
  --m3-primary: var(--ws-primary, var(--green-500));
  --m3-on-primary: var(--ws-on-primary, 255 255 255);
  --m3-primary-container: var(--ws-primary-container, var(--green-100));
  --m3-on-primary-container: var(--ws-on-primary-container, var(--green-900));
  --m3-secondary-container: var(--neutral-200);
  --m3-on-secondary-container: var(--neutral-900);
  --m3-error: var(--error-base);
  --m3-on-error: 255 255 255;
}

/* Dark mode surface overrides */
[data-theme="dark"] {
  --m3-surface: var(--neutral-950);
  --m3-surface-dim: var(--neutral-900);
  --m3-surface-container-lowest: 0 0 0;
  --m3-surface-container-low: var(--neutral-900);
  --m3-surface-container: var(--neutral-800);
  --m3-surface-container-high: var(--neutral-700);
  --m3-surface-container-highest: var(--neutral-600);
  --m3-on-surface: var(--neutral-50);
  --m3-on-surface-variant: var(--neutral-300);
  --m3-outline: var(--neutral-600);
  --m3-outline-variant: var(--neutral-700);
  --m3-inverse-surface: var(--neutral-100);
  --m3-inverse-on-surface: var(--neutral-900);
  --m3-inverse-primary: var(--green-700);
  --m3-primary: var(--ws-primary, var(--green-200));
  --m3-on-primary: var(--ws-on-primary, var(--green-900));
  --m3-primary-container: var(--ws-primary-container, var(--green-900));
  --m3-on-primary-container: var(--ws-on-primary-container, var(--green-100));
  --m3-secondary-container: var(--neutral-700);
  --m3-on-secondary-container: var(--neutral-100);
}

/* M3 State Layer utility class
 * Add .m3-state-layer to an interactive element. Set --state-layer-color on the element.
 * The ::after pseudo handles hover/focus/pressed overlays automatically.
 */
.m3-state-layer {
  position: relative;
  overflow: hidden;
}

.m3-state-layer::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: rgb(var(--state-layer-color, var(--m3-on-surface)) / 0);
  transition: background var(--spring-micro-duration, 150ms) var(--spring-micro-easing, ease-out);
}

.m3-state-layer:hover::after {
  background: rgb(var(--state-layer-color, var(--m3-on-surface)) / var(--m3-state-hover));
}

.m3-state-layer:focus-visible::after {
  background: rgb(var(--state-layer-color, var(--m3-on-surface)) / var(--m3-state-focus));
}

.m3-state-layer:active::after {
  background: rgb(var(--state-layer-color, var(--m3-on-surface)) / var(--m3-state-pressed));
}
```

- [ ] **Step 2: Import the token file in admin CSS**

Add this import to `packages/admin/src/index.css` after the shared imports (line 4):

```css
@import "./styles/admin-m3-tokens.css";
```

The import section should read:
```css
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700&display=swap");
@import "tailwindcss";
@import "@green-goods/shared/styles/theme.css";
@import "./styles/admin-m3-tokens.css";
@import "@green-goods/shared/styles/utilities.css";
```

- [ ] **Step 3: Verify build**

Run: `cd packages/admin && bun build`

Expected: Build succeeds. No CSS errors.

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/styles/admin-m3-tokens.css packages/admin/src/index.css
git commit -m "feat(admin): add M3 token foundation (elevation, shape, state-layer, surfaces)"
```

---

## Phase 2: Critical Components — Most Reused

### Task 2: AdminButton — M3 5-variant button

**Files:**
- Create: `packages/admin/src/components/AdminButton.tsx`

The AdminButton is the most widely used component — buttons appear in every view. It needs 5 M3 variants (filled, tonal, elevated, outlined, text) with M3 state layers, pill shape, and correct padding.

- [ ] **Step 1: Create AdminButton component**

```tsx
/* packages/admin/src/components/AdminButton.tsx */
import { RiLoader4Line } from "@remixicon/react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@green-goods/shared";

export const adminButtonVariants = tv({
  base: [
    "m3-state-layer",
    "relative isolate inline-flex items-center justify-center gap-2 whitespace-nowrap",
    "rounded-[var(--m3-shape-full)] font-medium text-label-lg",
    "transition-shadow duration-[var(--spring-fast-duration,200ms)] ease-[var(--spring-fast-easing,ease-out)]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[rgb(var(--m3-primary))]",
    "disabled:pointer-events-none",
    "motion-reduce:transition-none",
  ],
  variants: {
    variant: {
      filled: [
        "bg-[rgb(var(--m3-primary))] text-[rgb(var(--m3-on-primary))] [--state-layer-color:var(--m3-on-primary)]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "disabled:bg-[rgb(var(--m3-on-surface)/0.12)] disabled:text-[rgb(var(--m3-on-surface)/0.38)] disabled:shadow-[var(--m3-elevation-0)]",
      ],
      tonal: [
        "bg-[rgb(var(--m3-secondary-container))] text-[rgb(var(--m3-on-secondary-container))] [--state-layer-color:var(--m3-on-secondary-container)]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "disabled:bg-[rgb(var(--m3-on-surface)/0.12)] disabled:text-[rgb(var(--m3-on-surface)/0.38)]",
      ],
      elevated: [
        "bg-[rgb(var(--m3-surface-container-low))] text-[rgb(var(--m3-primary))] [--state-layer-color:var(--m3-primary)]",
        "shadow-[var(--m3-elevation-1)] hover:shadow-[var(--m3-elevation-2)]",
        "disabled:bg-[rgb(var(--m3-on-surface)/0.12)] disabled:text-[rgb(var(--m3-on-surface)/0.38)] disabled:shadow-[var(--m3-elevation-0)]",
      ],
      outlined: [
        "bg-transparent text-[rgb(var(--m3-primary))] [--state-layer-color:var(--m3-primary)]",
        "ring-1 ring-inset ring-[rgb(var(--m3-outline))]",
        "disabled:text-[rgb(var(--m3-on-surface)/0.38)] disabled:ring-[rgb(var(--m3-on-surface)/0.12)]",
      ],
      text: [
        "bg-transparent text-[rgb(var(--m3-primary))] [--state-layer-color:var(--m3-primary)]",
        "disabled:text-[rgb(var(--m3-on-surface)/0.38)]",
      ],
      danger: [
        "bg-[rgb(var(--m3-error))] text-[rgb(var(--m3-on-error))] [--state-layer-color:var(--m3-on-error)]",
        "shadow-[var(--m3-elevation-0)] hover:shadow-[var(--m3-elevation-1)]",
        "disabled:bg-[rgb(var(--m3-on-surface)/0.12)] disabled:text-[rgb(var(--m3-on-surface)/0.38)]",
      ],
    },
    size: {
      sm: "h-10 px-4 text-label-sm",
      md: "h-10 px-6 text-label-lg",
      lg: "h-12 px-6 text-body-lg",
    },
    hasLeadingIcon: {
      true: "pl-4",
    },
  },
  defaultVariants: {
    variant: "filled",
    size: "md",
  },
});

type AdminButtonVariantProps = VariantProps<typeof adminButtonVariants>;

export interface AdminButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    AdminButtonVariantProps {
  asChild?: boolean;
  loading?: boolean;
}

export const AdminButton = React.forwardRef<HTMLButtonElement, AdminButtonProps>(
  (
    {
      className,
      variant,
      size,
      hasLeadingIcon,
      asChild = false,
      loading = false,
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const content = loading ? (
      <>
        <RiLoader4Line className="h-[18px] w-[18px] animate-spin" aria-hidden />
        {children}
      </>
    ) : (
      children
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<{
        className?: string;
        children?: React.ReactNode;
        ref?: React.Ref<HTMLButtonElement>;
        [key: string]: unknown;
      }>;

      return React.cloneElement(child, {
        ...(props as Record<string, unknown>),
        ref,
        className: cn(
          adminButtonVariants({ variant, size, hasLeadingIcon }),
          child.props.className,
          className,
        ),
        "aria-busy": loading || undefined,
        children: loading ? (
          <>
            <RiLoader4Line className="h-[18px] w-[18px] animate-spin" aria-hidden />
            {child.props.children}
          </>
        ) : (
          child.props.children
        ),
      });
    }

    return (
      <button
        ref={ref}
        className={cn(adminButtonVariants({ variant, size, hasLeadingIcon }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {content}
      </button>
    );
  },
);
AdminButton.displayName = "AdminButton";
```

- [ ] **Step 2: Verify build**

Run: `cd packages/admin && bun build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/components/AdminButton.tsx
git commit -m "feat(admin): add AdminButton with M3 5-variant system (filled/tonal/elevated/outlined/text)"
```

---

### Task 3: AdminTabRail — M3 primary navigation tabs

**Files:**
- Create: `packages/admin/src/components/AdminTabRail.tsx`

This replaces the current pill-indicator tab rail with M3 primary navigation tabs: flat container, 3dp underline indicator, title-small typography.

- [ ] **Step 1: Create AdminTabRail component**

```tsx
/* packages/admin/src/components/AdminTabRail.tsx */
import { type ComponentType, type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@green-goods/shared";

export interface AdminTab {
  id: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  count?: number;
  disabled?: boolean;
}

export interface AdminTabRailProps {
  tabs: AdminTab[];
  activeId: string;
  ariaLabel: string;
  onChange: (id: string) => void;
  idBase?: string;
  className?: string;
}

export function AdminTabRail({
  tabs,
  activeId,
  ariaLabel,
  onChange,
  idBase,
  className,
}: AdminTabRailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
  }>({ left: 0, width: 0 });

  const hasIcons = tabs.some((tab) => tab.icon);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const activeTab = container.querySelector<HTMLButtonElement>(
      `[data-tab-id="${activeId}"]`,
    );
    if (!activeTab) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = activeTab.getBoundingClientRect();

    setIndicatorStyle({
      left: tabRect.left - containerRect.left,
      width: tabRect.width,
    });
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative flex w-full bg-[rgb(var(--m3-surface))]",
        "border-b border-[rgb(var(--m3-outline-variant))]",
        className,
      )}
    >
      {/* M3 active indicator: 3dp bottom underline */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 z-[1] h-[3px] rounded-t-[3px] bg-[rgb(var(--m3-primary))] motion-reduce:transition-none"
        style={{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          transition: `left var(--spring-medium-duration, 300ms) var(--spring-medium-easing, cubic-bezier(0.16, 1, 0.3, 1)), width var(--spring-medium-duration, 300ms) var(--spring-medium-easing, cubic-bezier(0.16, 1, 0.3, 1))`,
        }}
      />

      {tabs.map((tab) => {
        const active = activeId === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            data-tab-id={tab.id}
            id={idBase ? `${idBase}-tab-${tab.id}` : undefined}
            aria-selected={active}
            aria-controls={idBase ? `${idBase}-panel` : undefined}
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled) onChange(tab.id);
            }}
            className={cn(
              "m3-state-layer",
              "relative flex-1 inline-flex items-center justify-center gap-1",
              hasIcons
                ? "min-h-16 flex-col py-3 px-4"
                : "min-h-12 px-4 py-3.5",
              "text-title-sm font-medium",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--m3-primary))]",
              "motion-reduce:transition-none",
              active
                ? "text-[rgb(var(--m3-primary))] [--state-layer-color:var(--m3-primary)]"
                : "text-[rgb(var(--m3-on-surface-variant))] [--state-layer-color:var(--m3-on-surface)]",
              tab.disabled && "pointer-events-none opacity-38",
            )}
          >
            {Icon ? (
              <Icon
                className={cn(
                  "h-6 w-6 shrink-0",
                  active
                    ? "text-[rgb(var(--m3-primary))]"
                    : "text-[rgb(var(--m3-on-surface-variant))]",
                )}
              />
            ) : null}
            <span className="relative truncate">
              {tab.label}
              {/* M3 badge: positioned top-right of label area */}
              {tab.count !== undefined ? (
                <span
                  className={cn(
                    "absolute -right-5 -top-2 inline-flex min-w-4 items-center justify-center",
                    "h-4 rounded-[var(--m3-shape-full)] px-1",
                    "bg-[rgb(var(--m3-error))] text-[rgb(var(--m3-on-error))]",
                    "text-label-sm font-bold leading-none",
                  )}
                >
                  {tab.count > 99 ? "99+" : tab.count}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd packages/admin && bun build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/components/AdminTabRail.tsx
git commit -m "feat(admin): add AdminTabRail with M3 primary navigation tab anatomy"
```

---

### Task 4: AdminTextField — M3 filled text field with floating label

**Files:**
- Create: `packages/admin/src/components/AdminTextField.tsx`

- [ ] **Step 1: Create AdminTextField component**

```tsx
/* packages/admin/src/components/AdminTextField.tsx */
import * as React from "react";
import { cn } from "@green-goods/shared";
import type { ComponentType } from "react";

export interface AdminTextFieldProps {
  label: string;
  value?: string;
  defaultValue?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  disabled?: boolean;
  leadingIcon?: ComponentType<{ className?: string }>;
  trailingIcon?: ComponentType<{ className?: string }>;
  variant?: "filled" | "outlined";
  type?: string;
  name?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  inputProps?: React.ComponentPropsWithoutRef<"input">;
}

export const AdminTextField = React.forwardRef<HTMLInputElement, AdminTextFieldProps>(
  (
    {
      label,
      value,
      defaultValue,
      onChange,
      onBlur,
      error,
      helperText,
      required,
      disabled,
      leadingIcon: LeadingIcon,
      trailingIcon: TrailingIcon,
      variant = "filled",
      type = "text",
      name,
      id: idProp,
      placeholder,
      className,
      inputProps,
    },
    ref,
  ) => {
    const autoId = React.useId();
    const inputId = idProp ?? autoId;
    const helperId = `${inputId}-helper`;
    const hasError = Boolean(error);
    const [focused, setFocused] = React.useState(false);

    /* Determine if label should float: focused, has value, has defaultValue, or has placeholder */
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const mergedRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    const hasValue = value !== undefined ? value.length > 0 : (inputRef.current?.value?.length ?? 0) > 0;
    const isFloating = focused || hasValue || Boolean(defaultValue);

    const isFilled = variant === "filled";

    return (
      <div className={cn("relative", className)}>
        {/* Container */}
        <div
          className={cn(
            "m3-state-layer group relative flex items-center",
            "min-h-14", /* 56dp */
            isFilled
              ? [
                  "rounded-t-[var(--m3-shape-xs)] rounded-b-none",
                  "bg-[rgb(var(--m3-surface-container-highest))]",
                  "[--state-layer-color:var(--m3-on-surface)]",
                ]
              : [
                  "rounded-[var(--m3-shape-xs)]",
                  "bg-transparent",
                  "ring-1 ring-inset",
                  focused
                    ? "ring-2 ring-[rgb(var(--m3-primary))]"
                    : hasError
                      ? "ring-2 ring-[rgb(var(--m3-error))]"
                      : "ring-[rgb(var(--m3-outline))]",
                  "[--state-layer-color:var(--m3-on-surface)]",
                ],
            disabled && "opacity-38 pointer-events-none",
          )}
        >
          {/* Leading icon */}
          {LeadingIcon ? (
            <div className="flex items-center pl-3">
              <LeadingIcon className="h-6 w-6 text-[rgb(var(--m3-on-surface-variant))]" />
            </div>
          ) : null}

          {/* Input + floating label container */}
          <div className="relative flex-1 px-4">
            {/* Floating label */}
            <label
              htmlFor={inputId}
              className={cn(
                "pointer-events-none absolute left-4 transition-all",
                "duration-[var(--spring-fast-duration,200ms)] ease-[var(--spring-fast-easing,ease-out)]",
                "motion-reduce:transition-none",
                isFloating
                  ? [
                      "top-2 text-body-sm",
                      hasError
                        ? "text-[rgb(var(--m3-error))]"
                        : focused
                          ? "text-[rgb(var(--m3-primary))]"
                          : "text-[rgb(var(--m3-on-surface-variant))]",
                    ]
                  : "top-1/2 -translate-y-1/2 text-body-lg text-[rgb(var(--m3-on-surface-variant))]",
              )}
            >
              {label}
              {required ? (
                <>
                  <span aria-hidden="true"> *</span>
                  <span className="sr-only"> (required)</span>
                </>
              ) : null}
            </label>

            {/* Input */}
            <input
              ref={mergedRef}
              id={inputId}
              type={type}
              name={name}
              value={value}
              defaultValue={defaultValue}
              onChange={onChange}
              onFocus={() => setFocused(true)}
              onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
              }}
              disabled={disabled}
              placeholder={focused ? placeholder : undefined}
              aria-invalid={hasError || undefined}
              aria-describedby={error || helperText ? helperId : undefined}
              className={cn(
                "w-full bg-transparent pt-6 pb-2 text-body-lg text-[rgb(var(--m3-on-surface))]",
                "placeholder:text-[rgb(var(--m3-on-surface-variant))]",
                "focus:outline-none",
                "disabled:text-[rgb(var(--m3-on-surface)/0.38)]",
              )}
              {...inputProps}
            />
          </div>

          {/* Trailing icon */}
          {TrailingIcon ? (
            <div className="flex items-center pr-3">
              <TrailingIcon
                className={cn(
                  "h-6 w-6",
                  hasError
                    ? "text-[rgb(var(--m3-error))]"
                    : "text-[rgb(var(--m3-on-surface-variant))]",
                )}
              />
            </div>
          ) : null}
        </div>

        {/* Active indicator (filled variant only) */}
        {isFilled ? (
          <div
            className={cn(
              "h-px w-full transition-all",
              "duration-[var(--spring-fast-duration,200ms)] ease-[var(--spring-fast-easing,ease-out)]",
              focused
                ? "h-0.5 bg-[rgb(var(--m3-primary))]"
                : hasError
                  ? "h-0.5 bg-[rgb(var(--m3-error))]"
                  : "bg-[rgb(var(--m3-on-surface-variant))]",
            )}
          />
        ) : null}

        {/* Supporting text */}
        {(error || helperText) ? (
          <p
            id={helperId}
            className={cn(
              "mt-1 px-4 text-body-sm",
              hasError
                ? "text-[rgb(var(--m3-error))]"
                : "text-[rgb(var(--m3-on-surface-variant))]",
            )}
          >
            {error || helperText}
          </p>
        ) : null}
      </div>
    );
  },
);
AdminTextField.displayName = "AdminTextField";
```

- [ ] **Step 2: Verify build**

Run: `cd packages/admin && bun build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/components/AdminTextField.tsx
git commit -m "feat(admin): add AdminTextField with M3 filled/outlined text field and floating label"
```

---

## Phase 3: Search & Filter — Fixes Hub Pain Points

### Task 5: AdminFilterChip — M3 filter chip

**Files:**
- Create: `packages/admin/src/components/AdminFilterChip.tsx`

- [ ] **Step 1: Create AdminFilterChip component**

```tsx
/* packages/admin/src/components/AdminFilterChip.tsx */
import { RiCheckLine } from "@remixicon/react";
import type { ComponentType } from "react";
import { cn } from "@green-goods/shared";

export interface AdminFilterChipProps {
  label: string;
  selected: boolean;
  onToggle: () => void;
  leadingIcon?: ComponentType<{ className?: string }>;
  disabled?: boolean;
  className?: string;
}

export function AdminFilterChip({
  label,
  selected,
  onToggle,
  leadingIcon: LeadingIcon,
  disabled,
  className,
}: AdminFilterChipProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "m3-state-layer",
        "relative inline-flex h-8 items-center gap-2 rounded-[var(--m3-shape-sm)] px-3",
        "text-label-lg font-medium",
        "transition-[background-color,box-shadow] duration-[var(--spring-fast-duration,200ms)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]",
        "motion-reduce:transition-none",
        selected
          ? [
              "bg-[rgb(var(--m3-secondary-container))] text-[rgb(var(--m3-on-secondary-container))]",
              "[--state-layer-color:var(--m3-on-secondary-container)]",
            ]
          : [
              "bg-transparent text-[rgb(var(--m3-on-surface-variant))]",
              "ring-1 ring-inset ring-[rgb(var(--m3-outline))]",
              "[--state-layer-color:var(--m3-on-surface-variant)]",
            ],
        disabled && "pointer-events-none opacity-38",
        className,
      )}
    >
      {selected ? (
        <RiCheckLine className="h-[18px] w-[18px] shrink-0" />
      ) : LeadingIcon ? (
        <LeadingIcon className="h-[18px] w-[18px] shrink-0" />
      ) : null}
      <span className="truncate">{label}</span>
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/admin/src/components/AdminFilterChip.tsx
git commit -m "feat(admin): add AdminFilterChip with M3 filter chip anatomy"
```

---

### Task 6: AdminSearchToolbar — M3 search bar

**Files:**
- Create: `packages/admin/src/components/AdminSearchToolbar.tsx`

- [ ] **Step 1: Create AdminSearchToolbar component**

```tsx
/* packages/admin/src/components/AdminSearchToolbar.tsx */
import { RiCloseLine, RiSearchLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { cn } from "@green-goods/shared";

export interface AdminSearchToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
}

export function AdminSearchToolbar({
  search,
  onSearchChange,
  placeholder,
  children,
  className,
}: AdminSearchToolbarProps) {
  const intl = useIntl();
  const resolvedPlaceholder =
    placeholder ??
    intl.formatMessage({
      id: "app.admin.listToolbar.searchPlaceholder",
      defaultMessage: "Search...",
    });

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* M3 Search Bar: 56dp, corner-full, surface-container-high, level 3 */}
      <div
        className={cn(
          "relative flex flex-1 items-center",
          "h-14 rounded-[var(--m3-shape-full)]",
          "bg-[rgb(var(--m3-surface-container-high))]",
          "shadow-[var(--m3-elevation-3)]",
        )}
      >
        <RiSearchLine
          className="ml-4 h-6 w-6 shrink-0 text-[rgb(var(--m3-on-surface))]"
          aria-hidden
        />
        <input
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={resolvedPlaceholder}
          aria-label={resolvedPlaceholder}
          className={cn(
            "flex-1 bg-transparent px-4 text-body-lg",
            "text-[rgb(var(--m3-on-surface))]",
            "placeholder:text-[rgb(var(--m3-on-surface-variant))]",
            "focus:outline-none",
          )}
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className={cn(
              "m3-state-layer mr-2 flex h-10 w-10 items-center justify-center rounded-full",
              "[--state-layer-color:var(--m3-on-surface)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]",
            )}
            aria-label={intl.formatMessage({
              id: "app.admin.listToolbar.clearSearch",
              defaultMessage: "Clear search",
            })}
          >
            <RiCloseLine className="h-6 w-6 text-[rgb(var(--m3-on-surface-variant))]" />
          </button>
        ) : null}
      </div>

      {/* Filter chips rendered inline — no wrapping */}
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd packages/admin && bun build`

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add packages/admin/src/components/AdminSearchToolbar.tsx
git commit -m "feat(admin): add AdminSearchToolbar with M3 56dp pill search bar"
```

---

### Task 7: Integrate Phase 2-3 components into Hub view

**Files:**
- Modify: `packages/admin/src/views/Hub/index.tsx`

This task swaps the shared `CanvasStageTabRail`, `ListToolbar`, and `SortSelect` imports for the M3 admin components in the Hub view. Other views (Garden, Actions, Community) follow the same pattern in later tasks.

- [ ] **Step 1: Update Hub imports**

In `packages/admin/src/views/Hub/index.tsx`, change the import block to replace:
- `CanvasStageTabRail` → removed from shared import (use AdminTabRail instead)
- `ListToolbar` → removed from shared import (use AdminSearchToolbar instead)
- `SortSelect` → removed from shared import (use AdminFilterChip instead)

Remove these from the `@green-goods/shared` import:
```
CanvasStageTabRail, ListToolbar, SortSelect
```

Add new imports:
```tsx
import { AdminTabRail } from "@/components/AdminTabRail";
import { AdminSearchToolbar } from "@/components/AdminSearchToolbar";
import { AdminFilterChip } from "@/components/AdminFilterChip";
```

- [ ] **Step 2: Replace CanvasStageTabRail usage with AdminTabRail**

Find the JSX where `CanvasStageTabRail` is rendered (the tabs block with `stages` array, `stage`, and `HUB_STAGE_RAIL_ID`). Replace it with:

```tsx
<AdminTabRail
  tabs={stages.map((s) => ({
    id: s.id,
    label: formatMessage({ id: s.labelId, defaultMessage: s.defaultMessage }),
    icon: s.icon,
    count: s.count,
  }))}
  activeId={stage}
  ariaLabel={formatMessage({ id: "cockpit.hub.tabRail", defaultMessage: "Hub pipeline stages" })}
  onChange={(id) =>
    navigate(adminRoutes.hubMode(id as HubPipelineStage, hubContext))
  }
  idBase={HUB_STAGE_RAIL_ID}
/>
```

- [ ] **Step 3: Replace ListToolbar + SortSelect with AdminSearchToolbar + AdminFilterChip**

Find the `<ListToolbar>` usage in the Hub view. Replace:

```tsx
<ListToolbar search={searchTerm} onSearchChange={setSearchTerm} searchPlaceholder={searchPlaceholder}>
  <SortSelect value={sortDirection} onChange={(val) => updateSearch({ sort: val })} options={sortOptions} />
</ListToolbar>
```

With:

```tsx
<AdminSearchToolbar
  search={searchTerm}
  onSearchChange={setSearchTerm}
  placeholder={searchPlaceholder}
>
  {sortOptions.map((option) => (
    <AdminFilterChip
      key={option.value}
      label={option.label}
      selected={sortDirection === option.value}
      onToggle={() => updateSearch({ sort: option.value })}
    />
  ))}
</AdminSearchToolbar>
```

- [ ] **Step 4: Verify build and test**

Run: `cd packages/admin && bun build && bun run test`

Expected: Build succeeds. Tests pass (or fail only on snapshot differences that need updating).

- [ ] **Step 5: Commit**

```bash
git add packages/admin/src/views/Hub/index.tsx
git commit -m "feat(admin): integrate M3 tabs, search bar, and filter chips into Hub view"
```

---

## Phase 4: Medium Components — Cards, Lists, Dialogs

### Task 8: AdminCard — M3 3-variant card

**Files:**
- Create: `packages/admin/src/components/AdminCard.tsx`

Follow the same pattern as AdminButton — use `tv()` from tailwind-variants with 3 variants (filled, elevated, outlined). Key specs:
- Shape: `rounded-[var(--m3-shape-md)]` (12dp)
- Filled: `bg-[rgb(var(--m3-surface-container-highest))]`, elevation 0→1
- Elevated: `bg-[rgb(var(--m3-surface-container-low))]`, elevation 1→2
- Outlined: `bg-[rgb(var(--m3-surface))]`, ring-1 ring-[rgb(var(--m3-outline-variant))]
- State layer: `[--state-layer-color:var(--m3-on-surface)]`
- Internal padding: 16px (p-4)
- Interactive prop triggers hover elevation + state layer

- [ ] **Step 1: Create AdminCard component**

```tsx
/* packages/admin/src/components/AdminCard.tsx */
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { cn } from "@green-goods/shared";

export const adminCardVariants = tv({
  base: [
    "rounded-[var(--m3-shape-md)] p-4",
    "transition-shadow duration-[var(--spring-fast-duration,200ms)]",
    "motion-reduce:transition-none",
  ],
  variants: {
    variant: {
      filled: [
        "bg-[rgb(var(--m3-surface-container-highest))]",
        "shadow-[var(--m3-elevation-0)]",
      ],
      elevated: [
        "bg-[rgb(var(--m3-surface-container-low))]",
        "shadow-[var(--m3-elevation-1)]",
      ],
      outlined: [
        "bg-[rgb(var(--m3-surface))]",
        "ring-1 ring-inset ring-[rgb(var(--m3-outline-variant))]",
        "shadow-[var(--m3-elevation-0)]",
      ],
    },
    interactive: {
      true: "m3-state-layer cursor-pointer [--state-layer-color:var(--m3-on-surface)]",
    },
  },
  compoundVariants: [
    { variant: "filled", interactive: true, className: "hover:shadow-[var(--m3-elevation-1)]" },
    { variant: "elevated", interactive: true, className: "hover:shadow-[var(--m3-elevation-2)]" },
    { variant: "outlined", interactive: true, className: "hover:shadow-[var(--m3-elevation-1)]" },
  ],
  defaultVariants: {
    variant: "elevated",
    interactive: false,
  },
});

type AdminCardVariantProps = VariantProps<typeof adminCardVariants>;

export interface AdminCardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    AdminCardVariantProps {}

export function AdminCard({
  variant,
  interactive,
  className,
  children,
  ...props
}: AdminCardProps) {
  return (
    <div
      className={cn(adminCardVariants({ variant, interactive }), className)}
      {...props}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/admin/src/components/AdminCard.tsx
git commit -m "feat(admin): add AdminCard with M3 filled/elevated/outlined variants"
```

---

### Task 9: AdminListItem — M3 list item

**Files:**
- Create: `packages/admin/src/components/AdminListItem.tsx`

M3 list items have fixed heights (56/72/88dp), body-large label, 16dp padding, and on-surface state layers. The component auto-selects height based on whether supporting text and overline are provided.

- [ ] **Step 1: Create AdminListItem component**

```tsx
/* packages/admin/src/components/AdminListItem.tsx */
import type { ComponentType, ReactNode } from "react";
import { cn } from "@green-goods/shared";

export interface AdminListItemProps {
  label: string;
  supportingText?: string;
  overline?: string;
  leadingIcon?: ComponentType<{ className?: string }>;
  leadingImageSrc?: string | null;
  trailingText?: string;
  trailingIcon?: ComponentType<{ className?: string }>;
  trailingContent?: ReactNode;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

export function AdminListItem({
  label,
  supportingText,
  overline,
  leadingIcon: LeadingIcon,
  leadingImageSrc,
  trailingText,
  trailingIcon: TrailingIcon,
  trailingContent,
  selected,
  disabled,
  onClick,
  className,
}: AdminListItemProps) {
  /* Auto height: 1-line=56dp, 2-line=72dp, 3-line=88dp */
  const lines = overline || (supportingText && supportingText.length > 60) ? 3 : supportingText ? 2 : 1;
  const heightClass = lines === 3 ? "min-h-[88px]" : lines === 2 ? "min-h-[72px]" : "min-h-[56px]";

  const content = (
    <>
      {/* Leading element */}
      {leadingImageSrc ? (
        <img
          src={leadingImageSrc}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-none object-cover"
        />
      ) : LeadingIcon ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
          <LeadingIcon className="h-6 w-6 text-[rgb(var(--m3-on-surface-variant))]" />
        </div>
      ) : null}

      {/* Text content */}
      <div className="min-w-0 flex-1">
        {overline ? (
          <p className="truncate text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
            {overline}
          </p>
        ) : null}
        <p className="truncate text-body-lg text-[rgb(var(--m3-on-surface))]" title={label}>
          {label}
        </p>
        {supportingText ? (
          <p
            className={cn(
              "text-body-md text-[rgb(var(--m3-on-surface-variant))]",
              lines === 3 ? "line-clamp-2" : "truncate",
            )}
            title={supportingText}
          >
            {supportingText}
          </p>
        ) : null}
      </div>

      {/* Trailing element */}
      {trailingContent ? (
        trailingContent
      ) : trailingText ? (
        <span className="shrink-0 text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
          {trailingText}
        </span>
      ) : TrailingIcon ? (
        <TrailingIcon className="h-6 w-6 shrink-0 text-[rgb(var(--m3-on-surface-variant))]" />
      ) : null}
    </>
  );

  const sharedClassName = cn(
    "m3-state-layer",
    "relative flex items-center gap-4 px-4",
    "[--state-layer-color:var(--m3-on-surface)]",
    heightClass,
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--m3-primary))]",
    "motion-reduce:transition-none",
    selected && "bg-[rgb(var(--m3-primary)/0.08)]",
    disabled && "pointer-events-none opacity-38",
    className,
  );

  if (onClick) {
    return (
      <button type="button" onClick={disabled ? undefined : onClick} disabled={disabled} className={cn(sharedClassName, "w-full cursor-pointer text-left")}>
        {content}
      </button>
    );
  }

  return <div className={sharedClassName}>{content}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/admin/src/components/AdminListItem.tsx
git commit -m "feat(admin): add AdminListItem with M3 56/72/88dp list anatomy"
```

---

### Task 10: AdminDialog — M3 basic dialog

**Files:**
- Create: `packages/admin/src/components/AdminDialog.tsx`

Wraps Radix Dialog with M3 visual treatment: 28dp radius, surface-container-high, headline-small, right-aligned text button actions.

- [ ] **Step 1: Create AdminDialog component**

```tsx
/* packages/admin/src/components/AdminDialog.tsx */
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@green-goods/shared";

export interface AdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function AdminDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  children,
  actions,
  className,
}: AdminDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* M3 scrim: on-surface @ 32% */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-[rgb(var(--m3-on-surface)/0.32)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-150 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />

        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-full max-w-[calc(100vw-2rem)] sm:max-w-md",
            "rounded-[var(--m3-shape-xl)] bg-[rgb(var(--m3-surface-container-high))]",
            "shadow-[var(--m3-elevation-3)] p-6",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-200",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "focus:outline-none",
            className,
          )}
        >
          {/* Icon (optional) */}
          {Icon ? (
            <div className="mb-4 flex justify-center">
              <Icon className="h-6 w-6 text-[rgb(var(--m3-secondary-container))]" />
            </div>
          ) : null}

          {/* Headline: M3 headline-small */}
          <Dialog.Title className="text-headline-sm text-[rgb(var(--m3-on-surface))]">
            {title}
          </Dialog.Title>

          {/* Description: M3 body-medium */}
          {description ? (
            <Dialog.Description className="mt-4 text-body-md text-[rgb(var(--m3-on-surface-variant))]">
              {description}
            </Dialog.Description>
          ) : null}

          {/* Content */}
          <div className="mt-4">{children}</div>

          {/* Actions: right-aligned, M3 text buttons */}
          {actions ? (
            <div className="mt-6 flex items-center justify-end gap-2">
              {actions}
            </div>
          ) : null}

          {/* Close button */}
          <Dialog.Close
            className={cn(
              "m3-state-layer",
              "absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full",
              "[--state-layer-color:var(--m3-on-surface)]",
              "text-[rgb(var(--m3-on-surface-variant))]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]",
            )}
            aria-label="Close"
          >
            <RiCloseLine className="h-6 w-6" />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/admin/src/components/AdminDialog.tsx
git commit -m "feat(admin): add AdminDialog with M3 basic dialog anatomy (28dp, headline-small)"
```

---

## Phase 5: FAB, Checkbox, Badge

### Task 11: AdminFab — M3 floating action button

**Files:**
- Create: `packages/admin/src/components/AdminFab.tsx`

Key specs: 56x56dp, corner-large (16dp), primary-container, elevation level 3→4 on hover.

- [ ] **Step 1: Create AdminFab component**

```tsx
/* packages/admin/src/components/AdminFab.tsx */
import type { ComponentType, ReactNode } from "react";
import { cn } from "@green-goods/shared";

export interface AdminFabProps {
  icon: ComponentType<{ className?: string }>;
  label?: string;
  onClick: () => void;
  size?: "small" | "standard" | "large";
  className?: string;
}

export function AdminFab({
  icon: Icon,
  label,
  onClick,
  size = "standard",
  className,
}: AdminFabProps) {
  const isExtended = Boolean(label);

  const sizeClasses = {
    small: "h-10 w-10 rounded-[var(--m3-shape-md)]",
    standard: "h-14 w-14 rounded-[var(--m3-shape-lg)]",
    large: "h-24 w-24 rounded-[var(--m3-shape-xl)]",
  };

  const iconSizeClasses = {
    small: "h-6 w-6",
    standard: "h-6 w-6",
    large: "h-9 w-9",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "m3-state-layer",
        "relative inline-flex items-center justify-center gap-3",
        "bg-[rgb(var(--m3-primary-container))] text-[rgb(var(--m3-on-primary-container))]",
        "[--state-layer-color:var(--m3-on-primary-container)]",
        "shadow-[var(--m3-elevation-3)] hover:shadow-[var(--m3-elevation-4)]",
        "transition-shadow duration-[var(--spring-fast-duration,200ms)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--m3-primary))]",
        "motion-reduce:transition-none",
        isExtended
          ? "h-14 rounded-[var(--m3-shape-lg)] px-4 text-label-lg font-medium"
          : sizeClasses[size],
        className,
      )}
    >
      <Icon className={iconSizeClasses[size]} />
      {label ? <span>{label}</span> : null}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/admin/src/components/AdminFab.tsx
git commit -m "feat(admin): add AdminFab with M3 FAB anatomy (56dp, corner-large, primary-container)"
```

---

### Task 12: AdminCheckbox — M3 checkbox

**Files:**
- Create: `packages/admin/src/components/AdminCheckbox.tsx`

Key specs: 18dp container, 2dp radius, primary fill when checked, 40dp touch target.

- [ ] **Step 1: Create AdminCheckbox component**

```tsx
/* packages/admin/src/components/AdminCheckbox.tsx */
import * as React from "react";
import { cn } from "@green-goods/shared";

export interface AdminCheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  label?: string;
  description?: string;
  error?: boolean;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

export const AdminCheckbox = React.forwardRef<HTMLInputElement, AdminCheckboxProps>(
  (
    { checked, defaultChecked, onChange, label, description, error, disabled, name, id: idProp, className },
    ref,
  ) => {
    const autoId = React.useId();
    const inputId = idProp ?? autoId;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex items-start gap-3",
          disabled ? "pointer-events-none opacity-38" : "cursor-pointer",
          className,
        )}
      >
        {/* 40dp touch target with 18dp checkbox */}
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          {/* State layer (40dp circle) */}
          <span
            className={cn(
              "absolute inset-0 rounded-full transition-colors duration-150",
              "hover:bg-[rgb(var(--m3-on-surface)/var(--m3-state-hover))]",
            )}
          />
          <input
            ref={ref}
            type="checkbox"
            id={inputId}
            name={name}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={onChange}
            disabled={disabled}
            className={cn(
              "peer relative z-[1] h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[2px]",
              /* Unchecked */
              "border-2",
              error
                ? "border-[rgb(var(--m3-error))]"
                : "border-[rgb(var(--m3-on-surface-variant))]",
              /* Checked */
              error
                ? "checked:border-0 checked:bg-[rgb(var(--m3-error))]"
                : "checked:border-0 checked:bg-[rgb(var(--m3-primary))]",
              /* Checkmark via SVG background */
              "checked:bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%223%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M20%206L9%2017l-5-5%22%2F%3E%3C%2Fsvg%3E')]",
              "checked:bg-center checked:bg-no-repeat checked:bg-[length:14px]",
              /* Disabled */
              "disabled:cursor-not-allowed",
              "disabled:border-[rgb(var(--m3-on-surface)/0.38)]",
              "disabled:checked:bg-[rgb(var(--m3-on-surface)/0.38)]",
            )}
          />
        </span>
        {label ? (
          <span className="pt-2.5">
            <span className="text-body-lg text-[rgb(var(--m3-on-surface))]">{label}</span>
            {description ? (
              <span className="mt-0.5 block text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
                {description}
              </span>
            ) : null}
          </span>
        ) : null}
      </label>
    );
  },
);
AdminCheckbox.displayName = "AdminCheckbox";
```

- [ ] **Step 2: Commit**

```bash
git add packages/admin/src/components/AdminCheckbox.tsx
git commit -m "feat(admin): add AdminCheckbox with M3 anatomy (18dp, primary, 40dp touch target)"
```

---

### Task 13: AdminBadge — M3 notification badge

**Files:**
- Create: `packages/admin/src/components/AdminBadge.tsx`

- [ ] **Step 1: Create AdminBadge component**

```tsx
/* packages/admin/src/components/AdminBadge.tsx */
import { cn } from "@green-goods/shared";

export interface AdminBadgeProps {
  count?: number;
  visible?: boolean;
  className?: string;
}

export function AdminBadge({ count, visible = true, className }: AdminBadgeProps) {
  if (!visible) return null;

  const isSmall = count === undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-[var(--m3-shape-full)]",
        "bg-[rgb(var(--m3-error))] text-[rgb(var(--m3-on-error))]",
        isSmall
          ? "h-1.5 w-1.5"
          : "h-4 min-w-4 px-1 text-label-sm font-bold leading-none",
        className,
      )}
    >
      {!isSmall ? (count! > 99 ? "99+" : count) : null}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/admin/src/components/AdminBadge.tsx
git commit -m "feat(admin): add AdminBadge with M3 notification badge (error color, dot/number)"
```

---

## Phase 6: CSS Overrides — Nav, Sheets, Snackbar

### Task 14: Create CSS overrides file and integrate

**Files:**
- Create: `packages/admin/src/styles/admin-m3-overrides.css`
- Modify: `packages/admin/src/index.css`
- Modify: `packages/admin/src/components/Layout/CanvasLayout.tsx`

- [ ] **Step 1: Create the overrides CSS file**

```css
/* packages/admin/src/styles/admin-m3-overrides.css */

/* ============================================================================
 * Navigation Bar — M3 anatomy overrides
 * Applied via .admin-m3 class on CanvasLayout root
 * ============================================================================ */

.admin-m3 nav[aria-label] {
  min-height: 80px;
  background: rgb(var(--m3-surface-container));
  box-shadow: var(--m3-elevation-2);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* Nav active indicator: 64x32dp pill → secondary-container */
.admin-m3 nav[aria-label] [aria-current="page"] > span:first-child {
  background: rgb(var(--m3-secondary-container));
  width: 64px;
  height: 32px;
  border-radius: var(--m3-shape-full);
}

/* Nav labels: label-medium */
.admin-m3 nav[aria-label] [aria-current="page"] span:last-child,
.admin-m3 nav[aria-label] a span:last-child {
  font-size: var(--type-label-md-size, 12px);
  line-height: var(--type-label-md-line-height, 16px);
  letter-spacing: var(--type-label-md-tracking, 0.5px);
}

/* ============================================================================
 * Bottom Sheet — M3 shape + surface
 * ============================================================================ */

.admin-m3 [role="dialog"][data-sheet="bottom"] {
  border-radius: var(--m3-shape-xl) var(--m3-shape-xl) 0 0;
  background: rgb(var(--m3-surface-container-low));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* Drag handle: 32x4dp */
.admin-m3 [data-drag-handle] {
  width: 32px;
  height: 4px;
}

/* ============================================================================
 * Side Sheet — M3 width + shape
 * ============================================================================ */

.admin-m3 [role="dialog"][data-sheet="side"] {
  max-width: 256px;
  border-radius: var(--m3-shape-lg) 0 0 var(--m3-shape-lg);
  background: rgb(var(--m3-surface-container-low));
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

/* ============================================================================
 * Toast / Snackbar — M3 inverse surface
 * ============================================================================ */

.admin-m3 [data-sonner-toaster],
.admin-m3 .react-hot-toast {
  --toast-bg: rgb(var(--m3-inverse-surface));
  --toast-text: rgb(var(--m3-inverse-on-surface));
}

.admin-m3 [role="status"],
.admin-m3 [role="alert"] {
  background: rgb(var(--m3-inverse-surface)) !important;
  color: rgb(var(--m3-inverse-on-surface)) !important;
  border-radius: var(--m3-shape-xs) !important;
  box-shadow: var(--m3-elevation-3) !important;
}
```

- [ ] **Step 2: Import overrides in admin CSS**

Add to `packages/admin/src/index.css` after the tokens import:

```css
@import "./styles/admin-m3-overrides.css";
```

- [ ] **Step 3: Add .admin-m3 class to CanvasLayout**

In `packages/admin/src/components/Layout/CanvasLayout.tsx`, find the root wrapper element and add the `admin-m3` class. This will be the outermost container div that wraps all admin content. Add `"admin-m3"` to its className.

- [ ] **Step 4: Verify build**

Run: `cd packages/admin && bun build`

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/admin/src/styles/admin-m3-overrides.css packages/admin/src/index.css packages/admin/src/components/Layout/CanvasLayout.tsx
git commit -m "feat(admin): add M3 CSS overrides for nav bar, sheets, and snackbar"
```

---

## Phase 7: Low Priority — Tooltip, Progress, Date Picker

### Task 15: AdminTooltip + AdminLinearProgress

**Files:**
- Create: `packages/admin/src/components/AdminTooltip.tsx`
- Create: `packages/admin/src/components/AdminLinearProgress.tsx`

- [ ] **Step 1: Create AdminTooltip**

```tsx
/* packages/admin/src/components/AdminTooltip.tsx */
import { type ReactNode, useState } from "react";
import { cn } from "@green-goods/shared";

export interface AdminTooltipProps {
  content: string;
  children: ReactNode;
  className?: string;
}

export function AdminTooltip({ content, children, className }: AdminTooltipProps) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible ? (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2",
            "max-w-[200px] rounded-[var(--m3-shape-xs)] px-2 py-1",
            "bg-[rgb(var(--m3-inverse-surface))] text-body-sm text-[rgb(var(--m3-inverse-on-surface))]",
            "animate-in fade-in-0 zoom-in-95 duration-100",
            className,
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  );
}
```

- [ ] **Step 2: Create AdminLinearProgress**

```tsx
/* packages/admin/src/components/AdminLinearProgress.tsx */
import { cn } from "@green-goods/shared";

export interface AdminLinearProgressProps {
  value?: number; /* 0-100, undefined = indeterminate */
  className?: string;
}

export function AdminLinearProgress({ value, className }: AdminLinearProgressProps) {
  const determinate = value !== undefined;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? value : undefined}
      className={cn(
        "h-1 w-full overflow-hidden rounded-none bg-[rgb(var(--m3-surface-container-highest))]",
        className,
      )}
    >
      <div
        className={cn(
          "h-full bg-[rgb(var(--m3-primary))]",
          determinate
            ? "transition-[width] duration-200 ease-out"
            : "animate-[m3-indeterminate_2s_ease-in-out_infinite] w-1/3",
        )}
        style={determinate ? { width: `${Math.min(100, Math.max(0, value))}%` } : undefined}
      />
    </div>
  );
}
```

- [ ] **Step 3: Add indeterminate animation to tokens CSS**

Append to `packages/admin/src/styles/admin-m3-tokens.css`:

```css
@keyframes m3-indeterminate {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(100%); }
  100% { transform: translateX(300%); }
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/components/AdminTooltip.tsx packages/admin/src/components/AdminLinearProgress.tsx packages/admin/src/styles/admin-m3-tokens.css
git commit -m "feat(admin): add AdminTooltip and AdminLinearProgress with M3 anatomy"
```

---

### Task 16: Date picker CSS override

- [ ] **Step 1: Add date picker overrides to admin-m3-overrides.css**

Append to `packages/admin/src/styles/admin-m3-overrides.css`:

```css
/* ============================================================================
 * Date Picker — M3 surface + shape
 * ============================================================================ */

.admin-m3 [data-radix-popper-content-wrapper] .rdp {
  border-radius: var(--m3-shape-lg);
  background: rgb(var(--m3-surface-container-high));
  box-shadow: var(--m3-elevation-3);
}

.admin-m3 .rdp-day_selected {
  background: rgb(var(--m3-primary)) !important;
  color: rgb(var(--m3-on-primary)) !important;
}

.admin-m3 .rdp-day_today {
  color: rgb(var(--m3-primary));
  font-weight: 700;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/admin/src/styles/admin-m3-overrides.css
git commit -m "feat(admin): add M3 date picker CSS overrides"
```

---

## Phase 8: View Integration Sweep

### Task 17: Integrate M3 components into remaining views

**Files:**
- Modify: `packages/admin/src/views/Garden/index.tsx`
- Modify: `packages/admin/src/views/Actions/index.tsx`
- Modify: `packages/admin/src/views/Community/index.tsx`
- Modify: `packages/admin/src/components/Layout/AccountSurface.tsx`

For each file, apply the same pattern as Task 7 (Hub integration):

- [ ] **Step 1: Garden view** — Replace `CanvasStageTabRail` → `AdminTabRail`, `ListToolbar` → `AdminSearchToolbar`, `SortSelect` → `AdminFilterChip`

- [ ] **Step 2: Actions view** — Same replacements

- [ ] **Step 3: Community view** — Same replacements

- [ ] **Step 4: AccountSurface** — Replace `CanvasStageTabRail` → `AdminTabRail`

- [ ] **Step 5: Verify build and tests**

Run: `cd packages/admin && bun build && bun run test`

Expected: Build succeeds. All tests pass or fail only on snapshot differences.

- [ ] **Step 6: Commit**

```bash
git add packages/admin/src/views/ packages/admin/src/components/Layout/AccountSurface.tsx
git commit -m "feat(admin): integrate M3 components across Garden, Actions, Community, and Account views"
```

---

### Task 18: Final validation

- [ ] **Step 1: Full build**

Run: `bun build`

Expected: All packages build successfully.

- [ ] **Step 2: Full test suite**

Run: `bun run test`

Expected: All tests pass.

- [ ] **Step 3: Lint and format**

Run: `bun format && bun lint`

Expected: No errors.

- [ ] **Step 4: Final commit if needed**

```bash
git add -A
git commit -m "chore(admin): fix lint/format issues from M3 component integration"
```
