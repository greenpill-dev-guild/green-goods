/**
 * AppSettings Component Tests
 *
 * Tests theme/language settings rendering and the refresh app flow
 * (online vs offline behavior).
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track mock state
const mockThemeState = { theme: "system", setTheme: vi.fn() };
const mockAppState = {
  locale: "en",
  switchLanguage: vi.fn(),
  availableLocales: ["en", "es"],
};
const mockServiceWorkerUpdateState = {
  updateAvailable: false,
  isUpdating: false,
  applyUpdate: vi.fn(),
};

// Mock @green-goods/shared
vi.mock("@green-goods/shared", () => ({
  capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
  ConfirmDialog: ({
    isOpen,
    title,
    children,
  }: {
    isOpen: boolean;
    title?: string;
    children?: React.ReactNode;
  }) =>
    isOpen
      ? createElement("div", { role: "dialog", "data-testid": "confirm-dialog" }, title, children)
      : null,
  hapticLight: vi.fn(),
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  toastService: { info: vi.fn(), loading: vi.fn(), success: vi.fn(), error: vi.fn() },
  useApp: () => mockAppState,
  useServiceWorkerUpdate: () => mockServiceWorkerUpdateState,
  useTheme: () => mockThemeState,
}));

// Mock @remixicon/react
vi.mock("@remixicon/react", () => ({
  RiEarthFill: (props: any) => createElement("span", props),
  RiRefreshLine: (props: any) => createElement("span", props),
  RiSettings2Line: (props: any) => createElement("span", props),
}));

// Mock client components
vi.mock("@/components/Actions", () => ({
  Button: ({
    label,
    onClick,
  }: {
    label: string;
    onClick?: () => void;
    variant?: string;
    mode?: string;
    size?: string;
    className?: string;
    leadingIcon?: React.ReactNode;
  }) => createElement("button", { onClick, "data-testid": `btn-${label}` }, label),
}));

vi.mock("@/components/Cards", () => ({
  Card: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "card" }, children),
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
}));

vi.mock("@/components/Inputs", async () => {
  const React = await import("react");
  const SelectContext = React.createContext<((value: string) => void) | undefined>(undefined);

  return {
    Select: ({ children, value, onValueChange }: any) =>
      React.createElement(
        SelectContext.Provider,
        { value: onValueChange },
        React.createElement("div", { "data-testid": "select", "data-value": value }, children)
      ),
    SelectContent: ({ children }: any) => React.createElement("div", null, children),
    SelectItem: ({ children, value }: any) => {
      const onValueChange = React.useContext(SelectContext);
      return React.createElement(
        "button",
        {
          role: "option",
          "data-value": value,
          type: "button",
          onClick: () => onValueChange?.(value),
        },
        children
      );
    },
    SelectTrigger: ({ children }: any) =>
      React.createElement("div", { "data-testid": "select-trigger" }, children),
    SelectValue: ({ placeholder }: any) => React.createElement("span", null, placeholder),
  };
});

import { AppSettings } from "../../views/Profile/AppSettings";

const wrap = (el: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages: {} }, el);

describe("AppSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThemeState.theme = "system";
    mockServiceWorkerUpdateState.updateAvailable = false;
    mockServiceWorkerUpdateState.isUpdating = false;
  });

  afterEach(() => {
    cleanup();
  });

  it("renders settings header", () => {
    render(wrap(createElement(AppSettings)));

    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("renders theme setting card", () => {
    render(wrap(createElement(AppSettings)));

    expect(screen.getByText("Theme")).toBeInTheDocument();
    expect(screen.getByText(/choose how the app looks/i)).toBeInTheDocument();
  });

  it("renders theme options as text-only choices and changes theme", async () => {
    const user = userEvent.setup();
    render(wrap(createElement(AppSettings)));

    const darkOption = screen.getByRole("option", { name: "Dark" });
    expect(darkOption.querySelector("svg")).toBeNull();

    await user.click(darkOption);

    expect(mockThemeState.setTheme).toHaveBeenCalledWith("dark");
  });

  it("renders language setting card", () => {
    render(wrap(createElement(AppSettings)));

    expect(screen.getByText("Language")).toBeInTheDocument();
    expect(screen.getByText(/set your preferred language/i)).toBeInTheDocument();
  });

  it("does not render the update app card when no service worker update is waiting", () => {
    render(wrap(createElement(AppSettings)));

    expect(screen.queryByText("Refresh app")).not.toBeInTheDocument();
    expect(screen.queryByText("Update app")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-Refresh")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-Update")).not.toBeInTheDocument();
  });

  it("renders the update app card when a service worker update is waiting", () => {
    mockServiceWorkerUpdateState.updateAvailable = true;

    render(wrap(createElement(AppSettings)));

    expect(screen.getByText("Update app")).toBeInTheDocument();
    expect(screen.getByText(/a new version is ready/i)).toBeInTheDocument();
    expect(screen.getByTestId("btn-Update")).toBeInTheDocument();
  });

  it("applies the waiting service worker update from the update card", async () => {
    mockServiceWorkerUpdateState.updateAvailable = true;
    const user = userEvent.setup();

    render(wrap(createElement(AppSettings)));

    await user.click(screen.getByTestId("btn-Update"));

    expect(mockServiceWorkerUpdateState.applyUpdate).toHaveBeenCalledTimes(1);
  });
});
