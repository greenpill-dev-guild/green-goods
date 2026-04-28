/**
 * Profile View Tests
 *
 * Tests the profile page: display name resolution,
 * tab switching between Account, Badges, and Help.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "../../../../shared/src/i18n/en.json";

// Mock @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatAddress: (addr: string, opts?: { ensName?: string }) =>
    opts?.ensName || `${addr.slice(0, 6)}...${addr.slice(-4)}`,
  formatEnsNameForDisplay: (ensName?: string | null) =>
    ensName?.endsWith(".greengoods.eth") ? ensName.replace(".greengoods.eth", "") : ensName,
  resolveAvatarUrl: (url: string) => url,
  useAuthState: () => ({ userName: "alice" }),
  useEnsAvatar: () => ({ data: null, isLoading: false }),
  useEnsName: () => ({ data: null }),
  useGardenerProfile: () => ({
    profile: null,
  }),
  useUser: () => ({
    user: { id: "0x1234567890abcdef1234567890abcdef12345678" },
  }),
}));

// Mock @remixicon/react
vi.mock("@remixicon/react", () => ({
  RiAwardLine: (props: any) => createElement("span", { ...props, "data-testid": "icon-award" }),
  RiHeadphoneLine: (props: any) => createElement("span", { ...props, "data-testid": "icon-help" }),
  RiSettings2Fill: (props: any) =>
    createElement("span", { ...props, "data-testid": "icon-settings" }),
}));

// Mock child components to isolate the Profile view
vi.mock("@/components/Features", () => ({
  Profile: ({
    displayName,
    avatar,
    location,
  }: {
    displayName: string;
    avatar: string;
    location?: string;
  }) =>
    createElement(
      "div",
      { "data-testid": "user-profile" },
      createElement("span", { "data-testid": "display-name" }, displayName),
      createElement("img", { "data-testid": "avatar", src: avatar }),
      location && createElement("span", { "data-testid": "location" }, location)
    ),
}));

vi.mock("@/components/Navigation", () => ({
  StandardTabs: ({
    tabs,
    activeTab,
    onTabChange,
  }: {
    tabs: { id: string; label: string }[];
    activeTab: string;
    onTabChange: (id: string) => void;
    variant?: string;
    scrollTargetSelector?: string;
  }) =>
    createElement(
      "div",
      { "data-testid": "tabs" },
      tabs.map((tab: { id: string; label: string }) =>
        createElement(
          "button",
          {
            key: tab.id,
            "data-testid": `tab-${tab.id}`,
            onClick: () => onTabChange(tab.id),
            "aria-selected": activeTab === tab.id,
          },
          tab.label
        )
      )
    ),
}));

vi.mock("../../views/Profile/Account", () => ({
  ProfileAccount: () => createElement("div", { "data-testid": "account-tab-content" }, "Account"),
}));

vi.mock("../../views/Profile/Badges", () => ({
  ProfileBadges: () => createElement("div", { "data-testid": "badges-tab-content" }, "Badges"),
}));

vi.mock("../../views/Profile/Help", () => ({
  ProfileHelp: () => createElement("div", { "data-testid": "help-tab-content" }, "Help"),
}));

import Profile from "../../views/Profile";

const wrap = (el: React.ReactElement) =>
  createElement(MemoryRouter, null, createElement(IntlProvider, { locale: "en", messages }, el));

describe("Profile View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the profile header with display name", () => {
    render(wrap(createElement(Profile)));

    expect(screen.getByTestId("user-profile")).toBeInTheDocument();
    // With no ENS and no profile.name, falls back to userName "alice"
    expect(screen.getByTestId("display-name")).toHaveTextContent("alice");
  });

  it("renders avatar with default image when no profile image", () => {
    render(wrap(createElement(Profile)));

    const avatar = screen.getByTestId("avatar");
    expect(avatar).toHaveAttribute("src", "/images/avatar.png");
  });

  it("shows account tab content by default", () => {
    render(wrap(createElement(Profile)));

    expect(screen.getByTestId("account-tab-content")).toBeInTheDocument();
    expect(screen.queryByTestId("badges-tab-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("help-tab-content")).not.toBeInTheDocument();
  });

  it("switches to badges tab when clicked", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(Profile)));

    await user.click(screen.getByTestId("tab-badges"));

    expect(screen.getByTestId("badges-tab-content")).toBeInTheDocument();
    expect(screen.queryByTestId("account-tab-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("help-tab-content")).not.toBeInTheDocument();
  });

  it("switches to help tab when clicked", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(Profile)));

    await user.click(screen.getByTestId("tab-help"));

    expect(screen.getByTestId("help-tab-content")).toBeInTheDocument();
    expect(screen.queryByTestId("account-tab-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("badges-tab-content")).not.toBeInTheDocument();
  });

  it("switches back to account tab", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(Profile)));

    await user.click(screen.getByTestId("tab-help"));
    expect(screen.getByTestId("help-tab-content")).toBeInTheDocument();

    await user.click(screen.getByTestId("tab-account"));
    expect(screen.getByTestId("account-tab-content")).toBeInTheDocument();
    expect(screen.queryByTestId("badges-tab-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("help-tab-content")).not.toBeInTheDocument();
  });

  it("renders tab bar with Account, Badges, and Help tabs", () => {
    render(wrap(createElement(Profile)));

    expect(screen.getByTestId("tab-account")).toBeInTheDocument();
    expect(screen.getByTestId("tab-badges")).toBeInTheDocument();
    expect(screen.getByTestId("tab-help")).toBeInTheDocument();
  });
});
