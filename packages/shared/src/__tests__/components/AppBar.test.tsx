/**
 * AppBar Tests
 *
 * Verifies the sticky top bar renders the garden chip, toggles to
 * sheet context mode with back arrow, renders action buttons with
 * correct aria labels, and conditionally renders the profile icon button.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock react-intl
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => {
      const messages: Record<string, string> = {
        "cockpit.topBar.back": "Back",
        "cockpit.topBar.openSearch": "Open search",
        "cockpit.topBar.openSettings": "Open settings",
      };
      return messages[id] ?? id;
    },
  }),
}));

import { AppBar } from "../../components/Canvas/AppBar";

describe("AppBar", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the gardenChip slot", () => {
    render(<AppBar gardenChip={<span data-testid="garden-chip">My Garden</span>} />);

    expect(screen.getByTestId("garden-chip")).toBeTruthy();
    expect(screen.getByText("My Garden")).toBeTruthy();
  });

  it("renders as a sticky header with z-sticky", () => {
    render(<AppBar gardenChip={<span>Chip</span>} />);

    const header = screen.getByRole("banner");
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("z-sticky");
  });

  it("has h-14 height class", () => {
    render(<AppBar gardenChip={<span>Chip</span>} />);

    const header = screen.getByRole("banner");
    expect(header.className).toContain("h-14");
  });

  // --------------------------------------------------------------------------
  // Sheet context mode
  // --------------------------------------------------------------------------

  it("shows back arrow + label when sheetContext is provided", () => {
    const onBack = vi.fn();
    render(
      <AppBar
        gardenChip={<span data-testid="garden-chip">Chip</span>}
        sheetContext={{ label: "Settings Panel", onBack }}
      />
    );

    // Back button should be visible
    const backBtn = screen.getByRole("button", { name: "Back" });
    expect(backBtn).toBeTruthy();

    // Sheet label should be visible
    expect(screen.getByText("Settings Panel")).toBeTruthy();

    // Garden chip should be hidden
    expect(screen.queryByTestId("garden-chip")).toBeNull();
  });

  it("calls sheetContext.onBack when back arrow is clicked", async () => {
    const onBack = vi.fn();
    render(<AppBar gardenChip={<span>Chip</span>} sheetContext={{ label: "Details", onBack }} />);

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows gardenChip when sheetContext is not provided", () => {
    render(<AppBar gardenChip={<span data-testid="garden-chip">My Garden</span>} />);

    expect(screen.getByTestId("garden-chip")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Right side action buttons
  // --------------------------------------------------------------------------

  it("renders search button with correct aria-label when onOpenSearch is provided", () => {
    render(<AppBar gardenChip={<span>Chip</span>} onOpenSearch={() => {}} />);

    const searchBtn = screen.getByRole("button", { name: "Open search" });
    expect(searchBtn).toBeTruthy();
  });

  it("does not render search button when onOpenSearch is not provided", () => {
    render(<AppBar gardenChip={<span>Chip</span>} />);

    expect(screen.queryByRole("button", { name: "Open search" })).toBeNull();
  });

  it("calls onOpenSearch when search button is clicked", async () => {
    const onOpenSearch = vi.fn();
    render(<AppBar gardenChip={<span>Chip</span>} onOpenSearch={onOpenSearch} />);

    await user.click(screen.getByRole("button", { name: "Open search" }));
    expect(onOpenSearch).toHaveBeenCalledOnce();
  });

  it("renders settings button with correct aria-label when onOpenSettings is provided", () => {
    render(<AppBar gardenChip={<span>Chip</span>} onOpenSettings={() => {}} />);

    const settingsBtn = screen.getByRole("button", { name: "Open settings" });
    expect(settingsBtn).toBeTruthy();
  });

  it("does not render settings button when onOpenSettings is not provided", () => {
    render(<AppBar gardenChip={<span>Chip</span>} />);

    expect(screen.queryByRole("button", { name: "Open settings" })).toBeNull();
  });

  it("calls onOpenSettings when settings button is clicked", async () => {
    const onOpenSettings = vi.fn();
    render(<AppBar gardenChip={<span>Chip</span>} onOpenSettings={onOpenSettings} />);

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  // --------------------------------------------------------------------------
  // Profile button
  // --------------------------------------------------------------------------

  it("renders profile button when onOpenProfile is provided", () => {
    render(<AppBar gardenChip={<span>Chip</span>} onOpenProfile={() => {}} />);

    const profileBtn = screen.getByRole("button", { name: "cockpit.topBar.openProfile" });
    expect(profileBtn).toBeTruthy();
  });

  it("does not render profile button when onOpenProfile is not provided", () => {
    render(<AppBar gardenChip={<span>Chip</span>} />);

    expect(screen.queryByRole("button", { name: "cockpit.topBar.openProfile" })).toBeNull();
  });

  it("calls onOpenProfile when profile button is clicked", async () => {
    const onOpenProfile = vi.fn();
    render(<AppBar gardenChip={<span>Chip</span>} onOpenProfile={onOpenProfile} />);

    await user.click(screen.getByRole("button", { name: "cockpit.topBar.openProfile" }));
    expect(onOpenProfile).toHaveBeenCalledOnce();
  });

  // --------------------------------------------------------------------------
  // Focus-visible ring
  // --------------------------------------------------------------------------

  it("action buttons have focus-visible ring classes", () => {
    render(
      <AppBar gardenChip={<span>Chip</span>} onOpenSearch={() => {}} onOpenSettings={() => {}} />
    );

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn.className).toContain("focus-visible:ring-2");
      expect(btn.className).toContain(
        "focus-visible:ring-[rgb(var(--ws-primary,var(--primary-base)))]"
      );
    }
  });
});
