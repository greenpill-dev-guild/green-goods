import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../../test-utils";

const VALID_LOOKUP_ADDRESS = "0x1234567890123456789012345678901234567890";

vi.mock("@green-goods/shared", async () => {
  const React = await import("react");

  return {
    DEFAULT_CHAIN_ID: 11155111,
    FormInput: ({
      id,
      label,
      ...props
    }: React.InputHTMLAttributes<HTMLInputElement> & {
      label: string;
    }) =>
      React.createElement(
        "div",
        null,
        React.createElement("label", { htmlFor: id }, label),
        React.createElement("input", { id, ...props })
      ),
    Surface: ({
      as: Component = "section",
      children,
      className,
      elevation: _elevation,
      padding: _padding,
      radius: _radius,
      interactive: _interactive,
      colorAccent: _colorAccent,
      ...props
    }: React.HTMLAttributes<HTMLElement> & {
      as?: React.ElementType;
      elevation?: string;
      padding?: string;
      radius?: string;
      interactive?: boolean;
      colorAccent?: string;
    }) => React.createElement(Component, { className, ...props }, children),
    formatAddress: (address: string) => address,
    formatDate: (timestamp: number) => String(timestamp),
  };
});

const greenWillMocks = vi.hoisted(() => {
  const state = {
    definitions: {
      badgeDefinitions: [],
      isLoading: false,
      isError: false,
    },
    grants: {
      grants: [],
      isLoading: false,
      isError: false,
    },
    badges: {
      earnedBadges: [],
      isLoading: false,
      isError: false,
      error: null as Error | null,
    },
  };

  return {
    state,
    mockUseGreenWillBadgeDefinitions: vi.fn(() => state.definitions),
    mockUseGreenWillRecentGrants: vi.fn(() => state.grants),
    mockUseGreenWillBadges: vi.fn(() => state.badges),
  };
});

vi.mock("@green-goods/shared/hooks", () => ({
  useGreenWillBadgeDefinitions: greenWillMocks.mockUseGreenWillBadgeDefinitions,
  useGreenWillBadges: greenWillMocks.mockUseGreenWillBadges,
  useGreenWillRecentGrants: greenWillMocks.mockUseGreenWillRecentGrants,
}));

import { GreenWillPanel } from "@/views/Actions/GreenWillPanel";

function renderPanel() {
  return renderWithProviders(<GreenWillPanel />);
}

describe("GreenWillPanel address lookup states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    greenWillMocks.state.definitions = {
      badgeDefinitions: [],
      isLoading: false,
      isError: false,
    };
    greenWillMocks.state.grants = {
      grants: [],
      isLoading: false,
      isError: false,
    };
    greenWillMocks.state.badges = {
      earnedBadges: [],
      isLoading: false,
      isError: false,
      error: null,
    };
  });

  it("shows inline validation and keeps the lookup hook disabled for an invalid address", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText("Lookup address"), "not-an-address");

    expect(screen.getByText("Enter a valid Ethereum address.")).toBeInTheDocument();
    expect(greenWillMocks.mockUseGreenWillBadges).toHaveBeenLastCalledWith(undefined, {
      enabled: false,
    });
    expect(screen.queryByText(/0 badge found for not-an-address/i)).not.toBeInTheDocument();
  });

  it("surfaces lookup errors instead of rendering an empty result", async () => {
    greenWillMocks.state.badges = {
      earnedBadges: [],
      isLoading: false,
      isError: true,
      error: new Error("RPC ownership lookup failed"),
    };
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText("Lookup address"), VALID_LOOKUP_ADDRESS);

    expect(screen.getByText(/Could not load badge ownership/i)).toBeInTheDocument();
    expect(screen.getByText(/Technical hint: RPC ownership lookup failed/i)).toBeInTheDocument();
    expect(screen.queryByText(/0 badge found for/i)).not.toBeInTheDocument();
  });

  it("keeps empty successful lookups distinct from errors", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.type(screen.getByLabelText("Lookup address"), VALID_LOOKUP_ADDRESS);

    expect(screen.getByText(`0 badge found for ${VALID_LOOKUP_ADDRESS}`)).toBeInTheDocument();
    expect(screen.queryByText(/Could not load badge ownership/i)).not.toBeInTheDocument();
  });
});
