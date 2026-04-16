# Canvas Taxonomy Standardization — Implementation Plan

> **For agentic workers:** This plan is designed for **agent team execution**. The lead spawns teammates per workstream. Each workstream owns distinct files with no overlap. Use `superpowers:executing-plans` within each teammate's scope. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize the admin canvas into a CSS Grid layout with three transparent containers (Top, Center, Bottom) and three surface sheets (Left, Main, Right), replace CSS transitions with react-spring physics, and align all components to the formal taxonomy.

**Architecture:** CSS Grid areas define the spatial layout. Sheets animate via `@react-spring/web` + `@use-gesture/react`. The canvas root owns the gradient — all sheets use glass surfaces. `SideSheet` splits into `LeftSheet` + `RightSheet` with distinct semantic roles.

**Tech Stack:** React, TypeScript, CSS Grid, `@react-spring/web`, `@use-gesture/react`, Radix Dialog, TailwindCSS v4

**Spec:** `docs/superpowers/specs/2026-04-14-canvas-taxonomy-standardization-design.md`

---

## Agent Team Structure

```
Lead (you) — coordinates, reviews between workstreams, merges

Teammate: foundations    — Task 1-3: deps, spring tokens, grid CSS, canvas gradient
Teammate: left-sheet     — Task 4: LeftSheet component + tests
Teammate: right-sheet    — Task 5: RightSheet component + tests
Teammate: main-sheet     — Task 6: MainSheet refactor (gradient → glass, react-spring recession)
Teammate: layout         — Task 7-9: CanvasLayout grid migration, TopContainer, BottomContainer, FAB
Teammate: cleanup        — Task 10: remove SideSheet, FloatingToolbar, update exports
```

**Spawn prompt for lead:**

```
Create an agent team for the canvas taxonomy standardization plan at
docs/superpowers/plans/2026-04-14-canvas-taxonomy-standardization.md

Spawn 6 teammates:
- "foundations" — Tasks 1-3 (dependencies, spring tokens, grid CSS). Use Sonnet.
- "left-sheet" — Task 4 (LeftSheet component). Blocked by foundations. Use Sonnet.
- "right-sheet" — Task 5 (RightSheet component). Blocked by foundations. Use Sonnet.
- "main-sheet" — Task 6 (MainSheet refactor). Blocked by foundations. Use Sonnet.
- "layout" — Tasks 7-9 (CanvasLayout, TopContainer, BottomContainer, FAB). Blocked by left-sheet, right-sheet, main-sheet. Use Sonnet.
- "cleanup" — Task 10 (remove deprecated, update exports). Blocked by layout. Use Sonnet.

Require plan approval for layout and cleanup teammates before they make changes.
Wait for teammates to complete their tasks before proceeding.
```

**Dependency graph:**

```
foundations (1-3)
  ├── left-sheet (4)
  ├── right-sheet (5)
  └── main-sheet (6)
        └── layout (7-9)  ← also blocked by left-sheet, right-sheet
              └── cleanup (10)
```

---

## Task 1: Install Dependencies

**Owner:** foundations
**Files:**
- Modify: `package.json` (root)
- Modify: `packages/shared/package.json`

- [ ] **Step 1: Install react-spring and use-gesture in shared package**

```bash
cd /Users/afo/Code/greenpill/green-goods
bun add @react-spring/web @use-gesture/react --cwd packages/shared
```

- [ ] **Step 2: Verify installation**

```bash
bun install
node -e "require('@react-spring/web'); require('@use-gesture/react'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb packages/shared/package.json
git commit -m "chore(shared): add @react-spring/web and @use-gesture/react"
```

---

## Task 2: Define Spring Config Tokens

**Owner:** foundations
**Files:**
- Create: `packages/shared/src/components/Canvas/springConfig.ts`
- Test: `packages/shared/src/__tests__/components/Canvas/springConfig.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// packages/shared/src/__tests__/components/Canvas/springConfig.test.ts
import { describe, it, expect } from "vitest";
import { SPRING_CONFIGS } from "../../../components/Canvas/springConfig";

describe("SPRING_CONFIGS", () => {
  it("exports sheet config with mass, tension, friction", () => {
    expect(SPRING_CONFIGS.sheet).toEqual({ mass: 1, tension: 170, friction: 26 });
  });

  it("exports snappy config", () => {
    expect(SPRING_CONFIGS.snappy).toEqual({ mass: 0.8, tension: 300, friction: 28 });
  });

  it("exports gentle config", () => {
    expect(SPRING_CONFIGS.gentle).toEqual({ mass: 1.2, tension: 120, friction: 20 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun run test -- --run packages/shared/src/__tests__/components/Canvas/springConfig.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/shared/src/components/Canvas/springConfig.ts
import type { SpringConfig } from "@react-spring/web";

/**
 * Shared spring configuration tokens for the canvas animation system.
 *
 * - sheet: Sheet open/close, MainSheet recession
 * - snappy: FAB press, nav item tap, tooltips
 * - gentle: Choreographed stagger, background blur transitions
 */
export const SPRING_CONFIGS = {
  sheet: { mass: 1, tension: 170, friction: 26 } satisfies SpringConfig,
  snappy: { mass: 0.8, tension: 300, friction: 28 } satisfies SpringConfig,
  gentle: { mass: 1.2, tension: 120, friction: 20 } satisfies SpringConfig,
} as const;

/** Velocity threshold (px/ms) for gesture-driven sheet dismiss */
export const DISMISS_VELOCITY_THRESHOLD = 0.5;

/** Stagger offset (ms) between choreographed elements */
export const CHOREOGRAPHY_STAGGER_MS = 60;
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun run test -- --run packages/shared/src/__tests__/components/Canvas/springConfig.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/components/Canvas/springConfig.ts packages/shared/src/__tests__/components/Canvas/springConfig.test.ts
git commit -m "feat(shared): add spring config tokens for canvas animation system"
```

---

## Task 3: Add Canvas Grid CSS and Gradient

**Owner:** foundations
**Files:**
- Modify: `packages/shared/src/styles/theme.css`
- Modify: `packages/shared/src/styles/utilities.css`

- [ ] **Step 1: Add canvas grid layout CSS to theme.css**

In `packages/shared/src/styles/theme.css`, add after the existing `.canvas-main-sheet-frame` block (around line 1216):

```css
  /* ── Canvas Grid Layout ── */
  .workspace-canvas-grid {
    display: grid;
    grid-template-areas:
      "top    top    top"
      "left   main   right"
      "bottom bottom bottom";
    grid-template-rows: auto 1fr auto;
    grid-template-columns:
      var(--left-sheet-width, 0)
      1fr
      var(--right-sheet-width, 0);
    background: var(--canvas-gradient,
      linear-gradient(180deg, rgb(var(--bg-white-0)) 0%, rgb(var(--bg-weak-50) / 0.6) 40%, rgb(var(--bg-sub-300) / 0.3) 100%)
    );
    min-height: 0;
    overflow: hidden;
  }

  .canvas-area-top { grid-area: top; }
  .canvas-area-left { grid-area: left; }
  .canvas-area-main { grid-area: main; }
  .canvas-area-right { grid-area: right; }
  .canvas-area-bottom { grid-area: bottom; position: relative; }

  @media (max-width: 599px) {
    .workspace-canvas-grid {
      grid-template-areas:
        "top"
        "main"
        "bottom";
      grid-template-columns: 1fr;
      grid-template-rows: auto 1fr auto;
    }
  }
```

- [ ] **Step 2: Add glass-surface utility for MainSheet**

In `packages/shared/src/styles/utilities.css`, add after the existing `.glass-overlay` dark-mode block (around line 189):

```css
  /* ── Glass Surface — MainSheet (lighter than ground, heavier than floating) ── */
  .glass-surface {
    background: rgb(var(--neutral-0) / 45%);
    backdrop-filter: blur(12px) saturate(1.2);
    box-shadow:
      inset 0 0 0 1px rgb(var(--neutral-0) / 35%),
      0 12px 40px rgba(0, 0, 0, 0.06);
  }

  [data-theme="dark"] .glass-surface {
    background: rgb(var(--neutral-900) / 50%);
    box-shadow:
      inset 0 0 0 1px rgb(255 255 255 / 8%),
      0 12px 40px rgba(0, 0, 0, 0.4);
  }
```

- [ ] **Step 3: Verify CSS compiles**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun build --filter shared
```

Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/styles/theme.css packages/shared/src/styles/utilities.css
git commit -m "feat(shared): add canvas grid layout CSS and glass-surface utility"
```

---

## Task 4: Create LeftSheet Component

**Owner:** left-sheet
**Blocked by:** Task 2 (spring config), Task 3 (CSS)
**Files:**
- Create: `packages/shared/src/components/Canvas/LeftSheet.tsx`
- Create: `packages/shared/src/__tests__/components/Canvas/LeftSheet.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// packages/shared/src/__tests__/components/Canvas/LeftSheet.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IntlProvider } from "react-intl";
import { LeftSheet } from "../../../components/Canvas/LeftSheet";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
      {ui}
    </IntlProvider>
  );
}

describe("LeftSheet", () => {
  it("renders children when open", () => {
    renderWithIntl(
      <LeftSheet open onClose={vi.fn()} title="Submit Work">
        <div data-testid="content">Form here</div>
      </LeftSheet>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderWithIntl(
      <LeftSheet open={false} onClose={vi.fn()} title="Submit Work">
        <div data-testid="content">Form here</div>
      </LeftSheet>
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <LeftSheet open onClose={onClose} title="Submit Work">
        <div>Content</div>
      </LeftSheet>
    );
    fireEvent.click(screen.getByTestId("left-sheet-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders with left-sheet test id", () => {
    renderWithIntl(
      <LeftSheet open onClose={vi.fn()} title="Actions">
        <div>Content</div>
      </LeftSheet>
    );
    expect(screen.getByTestId("left-sheet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun run test -- --run packages/shared/src/__tests__/components/Canvas/LeftSheet.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/shared/src/components/Canvas/LeftSheet.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { animated, useSpring } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";
import { SPRING_CONFIGS, DISMISS_VELOCITY_THRESHOLD } from "./springConfig";

export interface LeftSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /**
   * Portal container element. When provided, uses absolute positioning
   * bounded to the container (canvas overlay root).
   */
  container?: HTMLElement | null;
}

/**
 * LeftSheet — action-oriented panel that slides in from the left edge.
 *
 * Used for: Submit Work, Create Assessment, Mint Hypercert, Work Detail.
 * Width: viewport-driven via CSS clamp (set by grid column).
 * Animation: react-spring physics with gesture-driven drag-dismiss.
 */
export function LeftSheet({
  open,
  onClose,
  title,
  description,
  children,
  container,
}: LeftSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });
  const contentRef = useRef<HTMLDivElement>(null);

  const [springs, api] = useSpring(() => ({
    x: open ? 0 : -100,
    opacity: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
  }));

  // Update spring when open changes
  useSpring({
    x: open ? 0 : -100,
    opacity: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
    onChange: () => {},
  });

  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
      // Only allow dragging left (negative x)
      if (mx > 20) {
        cancel();
        return;
      }
      if (dx < 0 && vx > DISMISS_VELOCITY_THRESHOLD) {
        onClose();
        return;
      }
      if (mx < -120) {
        onClose();
        return;
      }
      api.start({ x: Math.min(0, mx * 0.6), immediate: true });
    },
    {
      from: () => [springs.x.get(), 0],
      axis: "x",
      filterTaps: true,
    }
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose();
    },
    [onClose]
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay
          className={cn(
            isBounded ? "absolute inset-0" : "fixed inset-0",
            isBounded ? "z-[45] bg-transparent" : "z-overlay bg-neutral-950/18 backdrop-blur-sm",
            isBounded && "pointer-events-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[260ms] motion-reduce:duration-0"
          )}
          data-testid="left-sheet-overlay"
        />

        <Dialog.Content
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            isBounded ? "absolute top-0 left-0" : "fixed top-0 left-0",
            isBounded ? "z-[46]" : "z-modal",
            "flex h-full flex-col rounded-r-xl",
            "focus:outline-none will-change-transform",
            isBounded && "pointer-events-auto",
            "glass-floating",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[300ms] motion-reduce:duration-0"
          )}
          style={{
            width: "100%",
            maxWidth: "clamp(260px, 25vw, 360px)",
            paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          }}
          data-testid="left-sheet"
          {...bind()}
        >
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : null}

          {/* Header */}
          {title && (
            <div className="flex items-center justify-between border-b border-stroke-soft/80 px-4 py-3 flex-row-reverse">
              <Dialog.Title className="text-lg font-semibold text-text-strong">
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="left-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {!title && (
            <div className="flex px-4 pt-3 justify-start">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="left-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <SheetErrorBoundary onClose={onClose}>{children}</SheetErrorBoundary>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun run test -- --run packages/shared/src/__tests__/components/Canvas/LeftSheet.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/components/Canvas/LeftSheet.tsx packages/shared/src/__tests__/components/Canvas/LeftSheet.test.tsx
git commit -m "feat(shared): add LeftSheet component with spring animation and drag dismiss"
```

---

## Task 5: Create RightSheet Component

**Owner:** right-sheet
**Blocked by:** Task 2 (spring config), Task 3 (CSS)
**Files:**
- Create: `packages/shared/src/components/Canvas/RightSheet.tsx`
- Create: `packages/shared/src/__tests__/components/Canvas/RightSheet.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// packages/shared/src/__tests__/components/Canvas/RightSheet.test.tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { IntlProvider } from "react-intl";
import { RightSheet } from "../../../components/Canvas/RightSheet";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{ "app.common.close": "Close" }}>
      {ui}
    </IntlProvider>
  );
}

describe("RightSheet", () => {
  it("renders children when open", () => {
    renderWithIntl(
      <RightSheet open onClose={vi.fn()} title="Settings">
        <div data-testid="content">Settings form</div>
      </RightSheet>
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    renderWithIntl(
      <RightSheet open={false} onClose={vi.fn()} title="Settings">
        <div data-testid="content">Settings form</div>
      </RightSheet>
    );
    expect(screen.queryByTestId("content")).not.toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    renderWithIntl(
      <RightSheet open onClose={onClose} title="Settings">
        <div>Content</div>
      </RightSheet>
    );
    fireEvent.click(screen.getByTestId("right-sheet-close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders with right-sheet test id", () => {
    renderWithIntl(
      <RightSheet open onClose={vi.fn()} title="Notifications">
        <div>Content</div>
      </RightSheet>
    );
    expect(screen.getByTestId("right-sheet")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun run test -- --run packages/shared/src/__tests__/components/Canvas/RightSheet.test.tsx
```

Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/shared/src/components/Canvas/RightSheet.tsx
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useDrag } from "@use-gesture/react";
import { useSpring } from "@react-spring/web";
import { useCallback, useRef } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { SheetErrorBoundary } from "./SheetErrorBoundary";
import { SPRING_CONFIGS, DISMISS_VELOCITY_THRESHOLD } from "./springConfig";

export interface RightSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  /**
   * Portal container element. When provided, uses absolute positioning
   * bounded to the container (canvas overlay root).
   */
  container?: HTMLElement | null;
}

/**
 * RightSheet — config and alerts panel that slides in from the right edge.
 *
 * Used for: Notifications, Settings, Account (as tabbed panel).
 * Width: viewport-driven via CSS clamp (set by grid column).
 * Animation: react-spring physics with gesture-driven drag-dismiss.
 */
export function RightSheet({
  open,
  onClose,
  title,
  description,
  children,
  container,
}: RightSheetProps) {
  const isBounded = container !== undefined && container !== null;
  const { formatMessage } = useIntl();
  const closeLabel = formatMessage({ id: "app.common.close" });
  const contentRef = useRef<HTMLDivElement>(null);

  const [springs, api] = useSpring(() => ({
    x: open ? 0 : 100,
    opacity: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
  }));

  useSpring({
    x: open ? 0 : 100,
    opacity: open ? 1 : 0,
    config: SPRING_CONFIGS.sheet,
    onChange: () => {},
  });

  const bind = useDrag(
    ({ movement: [mx], velocity: [vx], direction: [dx], cancel }) => {
      // Only allow dragging right (positive x)
      if (mx < -20) {
        cancel();
        return;
      }
      if (dx > 0 && vx > DISMISS_VELOCITY_THRESHOLD) {
        onClose();
        return;
      }
      if (mx > 120) {
        onClose();
        return;
      }
      api.start({ x: Math.max(0, mx * 0.6), immediate: true });
    },
    {
      from: () => [springs.x.get(), 0],
      axis: "x",
      filterTaps: true,
    }
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) onClose();
    },
    [onClose]
  );

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Overlay
          className={cn(
            isBounded ? "absolute inset-0" : "fixed inset-0",
            isBounded ? "z-[45] bg-transparent" : "z-overlay bg-neutral-950/18 backdrop-blur-sm",
            isBounded && "pointer-events-auto",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[260ms] motion-reduce:duration-0"
          )}
          data-testid="right-sheet-overlay"
        />

        <Dialog.Content
          ref={contentRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            isBounded ? "absolute top-0 right-0" : "fixed top-0 right-0",
            isBounded ? "z-[46]" : "z-modal",
            "flex h-full flex-col rounded-l-xl",
            "focus:outline-none will-change-transform",
            isBounded && "pointer-events-auto",
            "glass-floating",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "duration-[300ms] motion-reduce:duration-0"
          )}
          style={{
            width: "100%",
            maxWidth: "clamp(220px, 20vw, 300px)",
            paddingBottom: isBounded ? undefined : "env(safe-area-inset-bottom)",
          }}
          data-testid="right-sheet"
          {...bind()}
        >
          {description ? (
            <Dialog.Description className="sr-only">{description}</Dialog.Description>
          ) : null}

          {/* Header */}
          {title && (
            <div className="flex items-center justify-between border-b border-stroke-soft/80 px-4 py-3">
              <Dialog.Title className="text-lg font-semibold text-text-strong">
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="right-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {!title && (
            <div className="flex px-4 pt-3 justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "text-text-soft transition-colors hover:bg-bg-soft",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-base focus-visible:ring-offset-2"
                  )}
                  aria-label={closeLabel}
                  data-testid="right-sheet-close"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <SheetErrorBoundary onClose={onClose}>{children}</SheetErrorBoundary>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun run test -- --run packages/shared/src/__tests__/components/Canvas/RightSheet.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/components/Canvas/RightSheet.tsx packages/shared/src/__tests__/components/Canvas/RightSheet.test.tsx
git commit -m "feat(shared): add RightSheet component with spring animation and drag dismiss"
```

---

## Task 6: Refactor MainSheet — Gradient to Glass + React Spring Recession

**Owner:** main-sheet
**Blocked by:** Task 2 (spring config), Task 3 (CSS with `glass-surface`)
**Files:**
- Modify: `packages/shared/src/components/Canvas/MainSheet.tsx`

- [ ] **Step 1: Replace gradient background with glass-surface class**

In `packages/shared/src/components/Canvas/MainSheet.tsx`, replace the inner div's inline `background` and `boxShadow` styles with the `glass-surface` utility class, and replace the CSS transition recession with react-spring animated values.

Replace the content surface div (the one with inline `background: "linear-gradient..."`) with:

```typescript
// Replace the inner transform div (lines ~91-115 in current MainSheet.tsx)
// FROM:
//   <div className={cn("h-full min-h-0 rounded-[inherit] will-change-[transform,opacity,filter]")}
//     style={{ background: "linear-gradient(...)...", transform: isMainSheetReceded ? ... }}
//   >
// TO:
import { animated, useSpring } from "@react-spring/web";
import { SPRING_CONFIGS } from "./springConfig";

// Inside the component, replace the CSS-transition recession with spring:
const recessionSpring = useSpring({
  scale: isMainSheetReceded ? 0.96 : 1,
  opacity: isMainSheetReceded ? 0.5 : 1,
  blur: isMainSheetReceded ? 3 : 0,
  y: isMainSheetReceded ? 8 : 0,
  config: SPRING_CONFIGS.sheet,
});

// Replace the inner div with animated.div:
<animated.div
  className={cn(
    "h-full min-h-0 rounded-[inherit] will-change-[transform,opacity,filter]",
    "glass-surface"
  )}
  style={{
    transform: recessionSpring.scale.to((s) =>
      `translateY(${recessionSpring.y.get()}px) scale(${s})`
    ),
    opacity: recessionSpring.opacity,
    filter: recessionSpring.blur.to(
      (b) => `blur(${b}px) saturate(${b > 0 ? 0.88 : 1}) brightness(${b > 0 ? 0.98 : 1})`
    ),
  }}
  data-testid="main-sheet-content"
>
  {children}
</animated.div>
```

- [ ] **Step 2: Remove the old inline style properties**

Remove the entire `style={{}}` block that had `background`, `boxShadow`, `transform`, `opacity`, `filter`, `transitionProperty`, `transitionDuration`, and `transitionTimingFunction`.

- [ ] **Step 3: Add the new grid area class**

Add `canvas-area-main` to the outermost div's className:

```typescript
<div
  className={cn("canvas-area-main relative flex-1 min-h-0", className)}
  data-testid="main-sheet"
>
```

Remove the `canvas-main-sheet-frame` class (the grid handles margins now).

- [ ] **Step 4: Verify the shared package type-checks**

```bash
cd /Users/afo/Code/greenpill/green-goods/packages/shared && bunx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Run existing tests**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun run test -- --run
```

Expected: all pass (or pre-existing failures only)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/components/Canvas/MainSheet.tsx
git commit -m "refactor(shared): MainSheet gradient → glass-surface, CSS transitions → react-spring"
```

---

## Task 7: Migrate CanvasLayout to CSS Grid

**Owner:** layout
**Blocked by:** Tasks 4, 5, 6 (all sheet components ready)
**Files:**
- Modify: `packages/admin/src/components/Layout/CanvasLayout.tsx`

- [ ] **Step 1: Replace flex layout with grid**

In `CanvasLayout.tsx`, change the outer container from flex to grid. Replace:

```typescript
className="admin-m3 flex h-full min-h-0 flex-col workspace-canvas"
```

With:

```typescript
className="admin-m3 h-full min-h-0 workspace-canvas workspace-canvas-grid"
```

- [ ] **Step 2: Wrap TopContextBar in TopContainer div**

```typescript
{/* Top Container (grid-area: top) */}
<div className="canvas-area-top">
  <TopContextBar
    gardenChip={gardenChipNode}
    onOpenSearch={handleOpenSearch}
    onOpenSettings={isDesktop ? () => openAccountSheet("settings") : undefined}
    onOpenNotifications={() => orchestrator.openSheet("right", "notifications")}
    userAvatar={isDesktop ? userAvatarNode : undefined}
  />
</div>
```

- [ ] **Step 3: Import LeftSheet and RightSheet, replace SideSheet usage**

Update imports — add `LeftSheet` and `RightSheet`, remove `SideSheet`:

```typescript
import {
  // ...existing imports...
  LeftSheet,
  RightSheet,
  // Remove: SideSheet,
} from "@green-goods/shared";
```

Replace the notifications `SideSheet` with `RightSheet`:

```typescript
<RightSheet
  open={orchestrator.activeSheet === "right" && orchestrator.activeContentId === "notifications"}
  onClose={() => orchestrator.closeSheet()}
  title={intl.formatMessage({
    id: "cockpit.notifications.title",
    defaultMessage: "Notifications",
  })}
  container={overlayRootRef.current}
>
  <NotificationPanel />
</RightSheet>
```

Update `AccountSheet` to use `RightSheet` internally (this is a separate file change in the next step).

- [ ] **Step 4: Add BottomContainer div with absolute nav/FAB**

Replace the inline `FabAwareNavigationBar` rendering with a BottomContainer wrapper:

```typescript
{/* Bottom Container (grid-area: bottom) */}
<div className="canvas-area-bottom">
  {visibleSlotCount > 0 && (
    <FabAwareNavigationBar
      slots={slots}
      activePath={activePath}
      onNavigate={(path) => navigate(path)}
    />
  )}
</div>
```

- [ ] **Step 5: Verify app renders**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun build --filter admin
```

Expected: build succeeds

- [ ] **Step 6: Commit**

```bash
git add packages/admin/src/components/Layout/CanvasLayout.tsx
git commit -m "refactor(admin): migrate CanvasLayout from flex to CSS Grid with named areas"
```

---

## Task 8: Refactor AccountSheet to Use RightSheet

**Owner:** layout
**Files:**
- Modify: `packages/admin/src/components/Layout/AccountSheet.tsx`

- [ ] **Step 1: Read current AccountSheet**

Read `packages/admin/src/components/Layout/AccountSheet.tsx` to understand its current SideSheet wrapper.

- [ ] **Step 2: Replace SideSheet with RightSheet**

Update the import and usage from `SideSheet` to `RightSheet`:

```typescript
import { RightSheet } from "@green-goods/shared";
// ...
export function AccountSheet({ open, activeTab, onClose, onTabChange, container }: AccountSheetProps) {
  return (
    <RightSheet
      open={open}
      onClose={onClose}
      container={container}
    >
      <AccountSurface activeTab={activeTab} onTabChange={onTabChange} />
    </RightSheet>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun build --filter admin
```

Expected: build succeeds

- [ ] **Step 4: Commit**

```bash
git add packages/admin/src/components/Layout/AccountSheet.tsx
git commit -m "refactor(admin): AccountSheet now uses RightSheet instead of SideSheet"
```

---

## Task 9: Add FAB Tooltips and Responsive Container Switching

**Owner:** layout
**Files:**
- Modify: `packages/shared/src/components/Canvas/NavigationBar.tsx`

- [ ] **Step 1: Add tooltip to FabButton**

In the `FabButton` component inside `NavigationBar.tsx`, add a tooltip that shows on hover for the single-action case:

```typescript
// Inside FabButton, wrap the button with a tooltip container:
<div className="group/fab relative flex items-center" /* ...existing */ >
  {/* Tooltip — shows on hover */}
  {isSingleAction && (
    <div className={cn(
      "pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap",
      "rounded-md bg-neutral-900/90 px-2.5 py-1 text-xs font-medium text-white",
      "opacity-0 transition-opacity group-hover/fab:opacity-100",
      "motion-reduce:transition-none"
    )}>
      {floatingActionLabel}
    </div>
  )}
  {/* ...existing FAB button... */}
</div>
```

For speed dial items, each already has a label. Add a tooltip wrapper for each:

```typescript
// Each speed dial action already shows icon + text label — ensure labels are always visible
// (currently they are, no change needed for speed dial items)
```

- [ ] **Step 2: Ensure FAB uses distinct icons per FabConfig**

The `FabConfig.icon` is already per-config and views set it. Verify that no view uses a generic `RiAddLine` — check Hub, Garden, Actions views. If any do, note it as a follow-up but don't change view files in this task (views are out of scope for the layout teammate).

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/components/Canvas/NavigationBar.tsx
git commit -m "feat(shared): add FAB tooltips for single-action mode"
```

---

## Task 10: Remove Deprecated Components and Update Exports

**Owner:** cleanup
**Blocked by:** Task 7-9 (all layout changes complete)
**Files:**
- Delete: `packages/shared/src/components/Canvas/FloatingToolbar.tsx`
- Delete: `packages/shared/src/components/Canvas/FloatingToolbar.stories.tsx`
- Delete: `packages/shared/src/components/Canvas/SideSheet.tsx`
- Delete: `packages/shared/src/components/Canvas/SideSheet.stories.tsx`
- Modify: `packages/shared/src/components/Canvas/index.ts`
- Modify: `packages/shared/src/components/Canvas/NavigationBar.tsx` (remove FloatingToolbar import)

- [ ] **Step 1: Verify no remaining SideSheet imports**

```bash
cd /Users/afo/Code/greenpill/green-goods && grep -r "from.*SideSheet" --include="*.tsx" --include="*.ts" packages/ | grep -v node_modules | grep -v "LeftSheet\|RightSheet"
```

Expected: no results (or only the index.ts export and the SideSheet.tsx itself)

- [ ] **Step 2: Verify no remaining FloatingToolbar imports**

```bash
cd /Users/afo/Code/greenpill/green-goods && grep -r "FloatingToolbar" --include="*.tsx" --include="*.ts" packages/ | grep -v node_modules | grep -v stories
```

Expected: only `NavigationBar.tsx` (imports `ToolbarSlot` type) and `index.ts`

- [ ] **Step 3: Move ToolbarSlot type to NavigationBar.tsx**

The `ToolbarSlot` type currently lives in `FloatingToolbar.tsx` and is imported by `NavigationBar.tsx`. Move it:

In `packages/shared/src/components/Canvas/NavigationBar.tsx`, replace:
```typescript
import type { ToolbarSlot } from "./FloatingToolbar";
```

With the type definition inline (copy from FloatingToolbar.tsx):
```typescript
export interface ToolbarSlot {
  id: string;
  label: string;
  labelId: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  visible: boolean;
  mobileOnly?: boolean;
  desktopOnly?: boolean;
}
```

- [ ] **Step 4: Update index.ts exports**

Replace the exports in `packages/shared/src/components/Canvas/index.ts`:

```typescript
// Remove these lines:
export { type ToolbarSlot } from "./FloatingToolbar";
export { SideSheet, type SideSheetProps } from "./SideSheet";

// Add these lines:
export { LeftSheet, type LeftSheetProps } from "./LeftSheet";
export { RightSheet, type RightSheetProps } from "./RightSheet";
export { SPRING_CONFIGS, DISMISS_VELOCITY_THRESHOLD, CHOREOGRAPHY_STAGGER_MS } from "./springConfig";

// Update ToolbarSlot export to come from NavigationBar:
export { type ToolbarSlot } from "./NavigationBar";
// (ToolbarSlot is already exported from NavigationBar after step 3)
```

- [ ] **Step 5: Delete deprecated files**

```bash
cd /Users/afo/Code/greenpill/green-goods
rm packages/shared/src/components/Canvas/FloatingToolbar.tsx
rm packages/shared/src/components/Canvas/FloatingToolbar.stories.tsx
rm packages/shared/src/components/Canvas/SideSheet.tsx
rm packages/shared/src/components/Canvas/SideSheet.stories.tsx
```

- [ ] **Step 6: Verify everything builds**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun build
```

Expected: full build succeeds

- [ ] **Step 7: Run all tests**

```bash
cd /Users/afo/Code/greenpill/green-goods && bun run test -- --run
```

Expected: all pass

- [ ] **Step 8: Commit**

```bash
git add -A packages/shared/src/components/Canvas/
git commit -m "refactor(shared): remove SideSheet + FloatingToolbar, export LeftSheet + RightSheet + spring tokens"
```

---

## Deferred to Wave 2

These spec items depend on the grid infrastructure from Wave 1 being stable:

- **TopContextBar → TopContainer rename**: Currently wrapped in a `canvas-area-top` div. Full rename (component, props, mobile breadcrumb slot) deferred to avoid breaking existing TopContextBar consumers during grid migration.
- **Mobile bottom drawer (LeftSheet → BottomSheet on <600px)**: Requires the LeftSheet and FAB context wiring from Wave 1. Will reuse client's `ModalDrawer` pattern with `useDrag` rubber-banding.
- **`useChain` choreography wiring**: MainSheet recession springs are in place (Task 6), but the full 3-step choreography sequence (recession → sheet slide → FAB reposition with staggered timing) is wired after all sheet components are stable.
- **NavigationBar → position: absolute**: Currently `fixed`. Switching to absolute within BottomContainer requires the grid layout to be in place and visually validated first.
- **FAB responsive container switching**: Desktop (BottomContainer) → mobile (CenterContainer) switching requires the grid collapse to be working.
- **Speed dial staggered springs**: Current speed dial uses CSS animation. Migration to `useSprings` with staggered offsets deferred to Wave 2.

---

## Post-Implementation Checklist

After all teammates complete:

- [ ] `bun format && bun lint` — clean formatting
- [ ] `bun run test -- --run` — all tests pass
- [ ] `bun build` — full build succeeds
- [ ] Visual smoke test — run `bun dev`, open admin in browser, verify:
  - Canvas gradient visible behind all sheets
  - MainSheet renders with glass surface
  - Account sheet opens from right with drag-dismiss
  - NavigationBar floats at bottom
  - FAB shows tooltip on hover
  - Mobile view: grid collapses to single column, nav goes full-width
- [ ] Commit final cleanup if any formatting/lint fixes needed
