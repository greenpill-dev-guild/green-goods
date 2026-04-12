/**
 * NavigationBar Tests
 *
 * Verifies the MD3-style floating navigation bar renders desktop + mobile
 * navigation surfaces with visible slots, active state, and navigation events.
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
        "cockpit.nav.profile": "Profile",
      };
      return messages[id] ?? id;
    },
  }),
}));

import type { ToolbarSlot } from "../../components/Canvas/FloatingToolbar";
import { NavigationBar } from "../../components/Canvas/NavigationBar";

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
  let desktopMatches = true;

  function setDesktopViewport(matches: boolean) {
    desktopMatches = matches;
    window.dispatchEvent(new Event("resize"));
  }

  function getNavs() {
    return screen.getAllByRole("navigation");
  }

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: desktopMatches,
        media: "(min-width: 600px)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    desktopMatches = true;
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
    cleanup();
  });

  it("renders the desktop navigation surface at desktop widths", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const navElements = getNavs();
    expect(navElements).toHaveLength(1);
    expect(within(navElements[0]!).getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
    expect(
      within(navElements[0]!).queryByRole("button", { name: /profile/i })
    ).not.toBeInTheDocument();
  });

  it("renders the mobile navigation surface at mobile widths", () => {
    setDesktopViewport(false);

    render(
      <NavigationBar
        slots={[
          ...createSlots(),
          {
            id: "profile",
            label: "Profile",
            labelId: "cockpit.nav.profile",
            icon: StubIcon,
            path: "/profile",
            visible: true,
            mobileOnly: true,
          },
        ]}
        activePath="/dashboard"
        onNavigate={() => {}}
      />
    );

    const navElements = getNavs();
    expect(navElements).toHaveLength(1);
    expect(within(navElements[0]!).getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
    expect(within(navElements[0]!).getByRole("button", { name: /profile/i })).toBeInTheDocument();
  });

  it("renders all visible slots with labels", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const buttons = getNavs().flatMap((nav) => within(nav).getAllByRole("button"));
    expect(buttons).toHaveLength(3);

    // Labels are visible text (not just aria-label)
    expect(screen.getAllByText("Dashboard")).toHaveLength(1);
    expect(screen.getAllByText("Actions")).toHaveLength(1);
    expect(screen.getAllByText("Gardens")).toHaveLength(1);
  });

  it("marks active slot with aria-current=page", () => {
    render(<NavigationBar slots={createSlots()} activePath="/actions" onNavigate={() => {}} />);

    const activeButtons = screen.getAllByRole("button", { current: "page" });
    expect(activeButtons).toHaveLength(1);
  });

  it("does not set aria-current on inactive slots", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    const allButtons = getNavs().flatMap((nav) => within(nav).getAllByRole("button"));
    const inactiveButtons = allButtons.filter((btn) => btn.getAttribute("aria-current") !== "page");
    expect(inactiveButtons).toHaveLength(2);
  });

  it("calls onNavigate with the slot path when clicked", async () => {
    const onNavigate = vi.fn();
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={onNavigate} />);

    const [actionsBtn] = screen.getAllByRole("button", { name: /Actions/i });
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

    const buttons = getNavs().flatMap((nav) => within(nav).getAllByRole("button"));
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

  it("uses aria-label from formatMessage on nav element", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    for (const nav of getNavs()) {
      expect(nav.getAttribute("aria-label")).toBe("Main navigation");
    }
  });

  it("uses the shared canvas shell class for both nav surfaces", () => {
    render(<NavigationBar slots={createSlots()} activePath="/dashboard" onNavigate={() => {}} />);

    for (const nav of getNavs()) {
      expect(nav.className).toContain("canvas-navigation-bar");
    }
  });

  it("renders mobile-only slots only in the mobile navigation surface", () => {
    const slots = [
      ...createSlots(),
      {
        id: "profile",
        label: "Profile",
        labelId: "cockpit.nav.profile",
        icon: StubIcon,
        path: "/profile",
        visible: true,
        mobileOnly: true,
      } satisfies ToolbarSlot,
    ];

    render(<NavigationBar slots={slots} activePath="/profile" onNavigate={() => {}} />);

    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /profile/i })).not.toBeInTheDocument();
  });

  it("stays mounted when a mobile-only profile tab makes the mobile nav actionable", () => {
    setDesktopViewport(false);

    render(
      <NavigationBar
        slots={[
          ...createSlots([{ visible: true }, { visible: false }, { visible: false }]),
          {
            id: "profile",
            label: "Profile",
            labelId: "cockpit.nav.profile",
            icon: StubIcon,
            path: "/profile",
            visible: true,
            mobileOnly: true,
          },
        ]}
        activePath="/dashboard"
        onNavigate={() => {}}
      />
    );

    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    expect(screen.getByRole("button", { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /profile/i })).toBeInTheDocument();
  });

  it("suppresses the mobile navigation while the virtual keyboard is open", () => {
    setDesktopViewport(false);
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 844,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        height: 300,
        width: 390,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    render(
      <NavigationBar
        slots={[
          ...createSlots(),
          {
            id: "profile",
            label: "Profile",
            labelId: "cockpit.nav.profile",
            icon: StubIcon,
            path: "/profile",
            visible: true,
            mobileOnly: true,
          },
        ]}
        activePath="/dashboard"
        onNavigate={() => {}}
      />
    );

    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
