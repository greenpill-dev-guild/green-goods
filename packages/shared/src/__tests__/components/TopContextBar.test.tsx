/**
 * TopContextBar Tests
 *
 * Verifies the sticky top bar renders the garden chip, toggles to
 * sheet context mode with back arrow, renders action buttons with
 * correct aria labels, and passes through user avatar slot.
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

import { TopContextBar } from "../../components/Cockpit/TopContextBar";

describe("TopContextBar", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the gardenChip slot", () => {
    render(<TopContextBar gardenChip={<span data-testid="garden-chip">My Garden</span>} />);

    expect(screen.getByTestId("garden-chip")).toBeTruthy();
    expect(screen.getByText("My Garden")).toBeTruthy();
  });

  it("renders as a sticky header with z-40", () => {
    render(<TopContextBar gardenChip={<span>Chip</span>} />);

    const header = screen.getByRole("banner");
    expect(header.className).toContain("sticky");
    expect(header.className).toContain("z-40");
  });

  it("has h-14 height class", () => {
    render(<TopContextBar gardenChip={<span>Chip</span>} />);

    const header = screen.getByRole("banner");
    expect(header.className).toContain("h-14");
  });

  // --------------------------------------------------------------------------
  // Sheet context mode
  // --------------------------------------------------------------------------

  it("shows back arrow + label when sheetContext is provided", () => {
    const onBack = vi.fn();
    render(
      <TopContextBar
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
    render(
      <TopContextBar gardenChip={<span>Chip</span>} sheetContext={{ label: "Details", onBack }} />
    );

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("shows gardenChip when sheetContext is not provided", () => {
    render(<TopContextBar gardenChip={<span data-testid="garden-chip">My Garden</span>} />);

    expect(screen.getByTestId("garden-chip")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Right side action buttons
  // --------------------------------------------------------------------------

  it("renders search button with correct aria-label when onOpenSearch is provided", () => {
    render(<TopContextBar gardenChip={<span>Chip</span>} onOpenSearch={() => {}} />);

    const searchBtn = screen.getByRole("button", { name: "Open search" });
    expect(searchBtn).toBeTruthy();
  });

  it("does not render search button when onOpenSearch is not provided", () => {
    render(<TopContextBar gardenChip={<span>Chip</span>} />);

    expect(screen.queryByRole("button", { name: "Open search" })).toBeNull();
  });

  it("calls onOpenSearch when search button is clicked", async () => {
    const onOpenSearch = vi.fn();
    render(<TopContextBar gardenChip={<span>Chip</span>} onOpenSearch={onOpenSearch} />);

    await user.click(screen.getByRole("button", { name: "Open search" }));
    expect(onOpenSearch).toHaveBeenCalledOnce();
  });

  it("renders settings button with correct aria-label when onOpenSettings is provided", () => {
    render(<TopContextBar gardenChip={<span>Chip</span>} onOpenSettings={() => {}} />);

    const settingsBtn = screen.getByRole("button", { name: "Open settings" });
    expect(settingsBtn).toBeTruthy();
  });

  it("does not render settings button when onOpenSettings is not provided", () => {
    render(<TopContextBar gardenChip={<span>Chip</span>} />);

    expect(screen.queryByRole("button", { name: "Open settings" })).toBeNull();
  });

  it("calls onOpenSettings when settings button is clicked", async () => {
    const onOpenSettings = vi.fn();
    render(<TopContextBar gardenChip={<span>Chip</span>} onOpenSettings={onOpenSettings} />);

    await user.click(screen.getByRole("button", { name: "Open settings" }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  // --------------------------------------------------------------------------
  // User avatar slot
  // --------------------------------------------------------------------------

  it("renders userAvatar when provided", () => {
    render(
      <TopContextBar
        gardenChip={<span>Chip</span>}
        userAvatar={<img data-testid="user-avatar" alt="User" src="/avatar.png" />}
      />
    );

    expect(screen.getByTestId("user-avatar")).toBeTruthy();
  });

  it("does not render avatar container when userAvatar is not provided", () => {
    const { container } = render(<TopContextBar gardenChip={<span>Chip</span>} />);

    // No avatar image
    expect(container.querySelector("[data-testid='user-avatar']")).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Focus-visible ring
  // --------------------------------------------------------------------------

  it("action buttons have focus-visible ring classes", () => {
    render(
      <TopContextBar
        gardenChip={<span>Chip</span>}
        onOpenSearch={() => {}}
        onOpenSettings={() => {}}
      />
    );

    const buttons = screen.getAllByRole("button");
    for (const btn of buttons) {
      expect(btn.className).toContain("focus-visible:ring-2");
      expect(btn.className).toContain("focus-visible:ring-primary-base");
    }
  });
});
