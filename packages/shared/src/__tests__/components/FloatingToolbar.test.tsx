/**
 * FloatingToolbar Tests
 *
 * Verifies the floating toolbar renders visible slots, marks the active slot
 * with aria-current, handles navigation callbacks, hides invisible slots,
 * and renders both desktop (vertical) and mobile (horizontal) layouts.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock react-intl
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => {
      const messages: Record<string, string> = {
        "cockpit.nav.mainNavigation": "Main navigation",
        "nav.dashboard": "Dashboard",
        "nav.actions": "Actions",
        "nav.gardens": "Gardens",
        "nav.settings": "Settings",
      };
      return messages[id] ?? id;
    },
  }),
}));

import type { ToolbarSlot } from "../../components/Canvas/FloatingToolbar";
import { FloatingToolbar } from "../../components/Canvas/FloatingToolbar";

// Stub icon component
function StubIcon({ className }: { className?: string }) {
  return <span data-testid="stub-icon" className={className} />;
}

function createSlots(overrides?: Partial<ToolbarSlot>[]): ToolbarSlot[] {
  const defaults: ToolbarSlot[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      labelId: "nav.dashboard",
      icon: StubIcon,
      path: "/dashboard",
      visible: true,
    },
    {
      id: "actions",
      label: "Actions",
      labelId: "nav.actions",
      icon: StubIcon,
      path: "/actions",
      visible: true,
    },
    {
      id: "gardens",
      label: "Gardens",
      labelId: "nav.gardens",
      icon: StubIcon,
      path: "/gardens",
      visible: true,
    },
  ];

  if (overrides) {
    return defaults.map((slot, i) => ({ ...slot, ...overrides[i] }));
  }
  return defaults;
}

describe("FloatingToolbar", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders all visible slots", () => {
    const onNavigate = vi.fn();
    render(
      <FloatingToolbar slots={createSlots()} activePath="/dashboard" onNavigate={onNavigate} />
    );

    // Two nav elements: desktop + mobile
    const navElements = screen.getAllByRole("navigation");
    expect(navElements.length).toBe(2);

    // Each nav should have 3 buttons (one per visible slot)
    const desktopNav = navElements[0];
    const desktopButtons = within(desktopNav).getAllByRole("button");
    expect(desktopButtons).toHaveLength(3);
  });

  it("marks active slot with aria-current=page", () => {
    render(<FloatingToolbar slots={createSlots()} activePath="/actions" onNavigate={() => {}} />);

    const activeButtons = screen.getAllByRole("button", { current: "page" });
    // One in desktop nav, one in mobile nav
    expect(activeButtons.length).toBe(2);
    expect(activeButtons[0].getAttribute("aria-label")).toBe("Actions");
  });

  it("does not set aria-current on inactive slots", () => {
    render(<FloatingToolbar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const allButtons = screen.getAllByRole("button");
    const inactiveButtons = allButtons.filter((btn) => btn.getAttribute("aria-current") !== "page");
    // 6 total buttons (3 desktop + 3 mobile) - 2 active = 4 inactive
    expect(inactiveButtons).toHaveLength(4);
  });

  it("calls onNavigate with the slot path when clicked", async () => {
    const onNavigate = vi.fn();
    render(
      <FloatingToolbar slots={createSlots()} activePath="/dashboard" onNavigate={onNavigate} />
    );

    // Click the "Actions" button (first nav = desktop)
    const navElements = screen.getAllByRole("navigation");
    const actionsBtn = within(navElements[0]).getByRole("button", {
      name: "Actions",
    });
    await user.click(actionsBtn);

    expect(onNavigate).toHaveBeenCalledWith("/actions");
  });

  it("does not render hidden slots", () => {
    render(
      <FloatingToolbar
        slots={createSlots([{}, { visible: false }, {}])}
        activePath="/dashboard"
        onNavigate={() => {}}
      />
    );

    const navElements = screen.getAllByRole("navigation");
    const desktopButtons = within(navElements[0]).getAllByRole("button");
    // Only 2 visible slots (dashboard + gardens)
    expect(desktopButtons).toHaveLength(2);
  });

  it("returns null when no slots are visible", () => {
    const { container } = render(
      <FloatingToolbar
        slots={createSlots([{ visible: false }, { visible: false }, { visible: false }])}
        activePath="/dashboard"
        onNavigate={() => {}}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("hides mobile nav when only 1 visible slot", () => {
    render(
      <FloatingToolbar
        slots={createSlots([{}, { visible: false }, { visible: false }])}
        activePath="/dashboard"
        onNavigate={() => {}}
      />
    );

    // Only desktop nav, mobile is hidden when <= 1 visible slot
    const navElements = screen.getAllByRole("navigation");
    expect(navElements).toHaveLength(1);
  });

  it("uses aria-label from formatMessage on nav elements", () => {
    render(<FloatingToolbar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const navElements = screen.getAllByRole("navigation");
    for (const nav of navElements) {
      expect(nav.getAttribute("aria-label")).toBe("Main navigation");
    }
  });

  it("renders slot buttons with translated labels as aria-label", () => {
    render(<FloatingToolbar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const navElements = screen.getAllByRole("navigation");
    const desktopNav = navElements[0];

    expect(within(desktopNav).getByRole("button", { name: "Dashboard" })).toBeTruthy();
    expect(within(desktopNav).getByRole("button", { name: "Actions" })).toBeTruthy();
    expect(within(desktopNav).getByRole("button", { name: "Gardens" })).toBeTruthy();
  });
});
