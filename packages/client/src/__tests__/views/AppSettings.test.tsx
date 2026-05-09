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
  isHapticsEnabled: vi.fn(() => true),
  isHapticsSupported: vi.fn(() => false),
  setHapticsEnabled: vi.fn(),
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
    "aria-label": ariaLabel,
    ...rest
  }: {
    checked: boolean;
    onCheckedChange?: (next: boolean) => void;
    disabled?: boolean;
    "aria-label"?: string;
    [key: string]: unknown;
  }) =>
    createElement("button", {
      role: "switch",
      "aria-checked": checked,
      "aria-label": ariaLabel,
      disabled,
      onClick: () => onCheckedChange?.(!checked),
      ...rest,
    }),
  logger: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() },
  toastService: { info: vi.fn(), loading: vi.fn(), success: vi.fn(), error: vi.fn() },
  useApp: () => mockAppState,
  useTheme: () => mockThemeState,
}));

// Mock @remixicon/react
vi.mock("@remixicon/react", () => ({
  RiEarthFill: (props: any) => createElement("span", props),
  RiRefreshLine: (props: any) => createElement("span", props),
  RiSettings2Line: (props: any) => createElement("span", props),
  RiPulseFill: (props: any) => createElement("span", props),
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

  it("renders refresh app card", () => {
    render(wrap(createElement(AppSettings)));

    expect(screen.getByText("Refresh app")).toBeInTheDocument();
    expect(screen.getByText(/get the latest updates/i)).toBeInTheDocument();
    expect(screen.getByTestId("btn-Refresh")).toBeInTheDocument();
  });

  it("shows offline message when refreshing while offline", async () => {
    // Simulate offline
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const user = userEvent.setup();

    const { toastService } = await import("@green-goods/shared");

    render(wrap(createElement(AppSettings)));

    await user.click(screen.getByTestId("btn-Refresh"));

    expect(toastService.info).toHaveBeenCalledWith(
      expect.objectContaining({
        context: "appRefresh",
      })
    );

    vi.restoreAllMocks();
  });
});
