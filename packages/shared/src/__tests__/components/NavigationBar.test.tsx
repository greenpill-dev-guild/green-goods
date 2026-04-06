/**
 * NavigationBar Tests
 *
 * Verifies the MD3-style floating navigation bar renders visible slots with
 * icon + label, marks active slot with aria-current, handles navigation,
 * and uses a single <nav> element (no two-DOM-tree breakpoint switching).
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

import type { ToolbarSlot } from "../../components/Cockpit/FloatingToolbar";
import { NavigationBar } from "../../components/Cockpit/NavigationBar";

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

describe("NavigationBar", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a single nav element (no two-DOM-tree pattern)", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const navElements = screen.getAllByRole("navigation");
    expect(navElements).toHaveLength(1);
  });

  it("renders all visible slots with labels", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const nav = screen.getByRole("navigation");
    const buttons = within(nav).getAllByRole("button");
    expect(buttons).toHaveLength(3);

    // Labels are visible text (not just aria-label)
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Actions")).toBeInTheDocument();
    expect(screen.getByText("Gardens")).toBeInTheDocument();
  });

  it("marks active slot with aria-current=page", () => {
    render(<NavigationBar slots={createSlots()} activePath="/actions" onNavigate={() => {}} />);

    const activeButtons = screen.getAllByRole("button", { current: "page" });
    expect(activeButtons).toHaveLength(1);
  });

  it("does not set aria-current on inactive slots", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const allButtons = within(screen.getByRole("navigation")).getAllByRole("button");
    const inactiveButtons = allButtons.filter((btn) => btn.getAttribute("aria-current") !== "page");
    expect(inactiveButtons).toHaveLength(2);
  });

  it("calls onNavigate with the slot path when clicked", async () => {
    const onNavigate = vi.fn();
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={onNavigate} />);

    const actionsBtn = screen.getByRole("button", { name: /Actions/i });
    await user.click(actionsBtn);

    expect(onNavigate).toHaveBeenCalledWith("/actions");
  });

  it("does not render hidden slots", () => {
    render(
      <NavigationBar
        slots={createSlots([{}, { visible: false }, {}])}
        activePath="/dashboard"
        onNavigate={() => {}}
      />
    );

    const nav = screen.getByRole("navigation");
    const buttons = within(nav).getAllByRole("button");
    expect(buttons).toHaveLength(2);
  });

  it("returns null when no slots are visible", () => {
    const { container } = render(
      <NavigationBar
        slots={createSlots([{ visible: false }, { visible: false }, { visible: false }])}
        activePath="/dashboard"
        onNavigate={() => {}}
      />
    );

    expect(container.innerHTML).toBe("");
  });

  it("renders leading and trailing slots", () => {
    render(
      <NavigationBar
        slots={createSlots()}
        activePath="/dashboard"
        onNavigate={() => {}}
        leading={<div data-testid="leading-content">Garden Chip</div>}
        trailing={<div data-testid="trailing-content">User Menu</div>}
      />
    );

    expect(screen.getByTestId("leading-content")).toBeInTheDocument();
    expect(screen.getByTestId("trailing-content")).toBeInTheDocument();
  });

  it("uses aria-label from formatMessage on nav element", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const nav = screen.getByRole("navigation");
    expect(nav.getAttribute("aria-label")).toBe("Main navigation");
  });
});
