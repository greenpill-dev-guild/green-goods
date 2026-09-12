/**
 * AppSettings Component Tests
 *
 * Tests theme/language settings rendering and the update row: a fixed title,
 * a status line, and a control that stays in place across every phase.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  phase: "idle",
  updateAvailable: false,
  activateNow: vi.fn(),
  checkForUpdate: vi.fn(),
};

// Mock @green-goods/shared
vi.mock("@green-goods/shared/utils/app/text", () => ({
  capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}));

vi.mock("@green-goods/shared/utils/app/haptics", () => ({
  hapticLight: vi.fn(),
}));

vi.mock("@green-goods/shared/providers/App", () => ({
  useApp: () => mockAppState,
}));

vi.mock("@green-goods/shared/hooks/app/useServiceWorkerUpdate", () => ({
  useServiceWorkerUpdate: () => mockServiceWorkerUpdateState,
}));

vi.mock("@green-goods/shared/hooks/app/useTheme", () => ({
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
    isLoading,
    disabled,
    className,
  }: {
    label: string;
    onClick?: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    className?: string;
    variant?: string;
    mode?: string;
    size?: string;
    leadingIcon?: React.ReactNode;
  }) =>
    createElement(
      "button",
      {
        onClick: isLoading || disabled ? undefined : onClick,
        "aria-busy": isLoading || undefined,
        className,
        "data-testid": `btn-${label}`,
      },
      label
    ),
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
    SelectTrigger: ({ children, className }: any) =>
      React.createElement("div", { "data-testid": "select-trigger", className }, children),
    SelectValue: ({ placeholder }: any) => React.createElement("span", null, placeholder),
  };
});

import { AppSettings } from "../../views/Profile/AppSettings";

const wrap = (el: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages: {} }, el);

const TITLE = "Update";

describe("AppSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockThemeState.theme = "system";
    mockServiceWorkerUpdateState.phase = "idle";
    mockServiceWorkerUpdateState.updateAvailable = false;
    mockServiceWorkerUpdateState.checkForUpdate.mockReset().mockResolvedValue("up-to-date");
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

  describe("update row", () => {
    it("always offers a manual check with the same control width as the selects", () => {
      render(wrap(createElement(AppSettings)));

      expect(screen.getAllByTestId("card")).toHaveLength(3);
      expect(screen.getByText(TITLE)).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent("Check for a newer version.");
      const check = screen.getByTestId("btn-Check");
      const [themeTrigger] = screen.getAllByTestId("select-trigger");
      expect(check.className).toBe(themeTrigger.className);
      expect(screen.queryByText("Refresh app")).not.toBeInTheDocument();
    });

    it("keeps the title and the control in place while checking, then reports up to date", async () => {
      const user = userEvent.setup();
      render(wrap(createElement(AppSettings)));

      await user.click(screen.getByTestId("btn-Check"));

      expect(mockServiceWorkerUpdateState.checkForUpdate).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("You have the latest version.");
      });
      expect(screen.getByText(TITLE)).toBeInTheDocument();
      expect(screen.getByTestId("btn-Check")).toBeInTheDocument();
      expect(screen.getAllByTestId("card")).toHaveLength(3);
    });

    it("applies an update found by the manual check without a second tap", async () => {
      const user = userEvent.setup();
      mockServiceWorkerUpdateState.checkForUpdate.mockResolvedValue("ready");
      render(wrap(createElement(AppSettings)));

      await user.click(screen.getByTestId("btn-Check"));

      await waitFor(() => {
        expect(mockServiceWorkerUpdateState.activateNow).toHaveBeenCalledTimes(1);
      });
      expect(screen.getByRole("status")).not.toHaveTextContent("You have the latest version.");
    });

    it("returns to a fresh check when the install is still pending", async () => {
      const user = userEvent.setup();
      mockServiceWorkerUpdateState.checkForUpdate.mockResolvedValue("pending");
      render(wrap(createElement(AppSettings)));

      await user.click(screen.getByTestId("btn-Check"));

      expect(mockServiceWorkerUpdateState.checkForUpdate).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status")).toHaveTextContent("Check for a newer version.");
      expect(screen.getByTestId("btn-Check")).toBeInTheDocument();
      expect(mockServiceWorkerUpdateState.activateNow).not.toHaveBeenCalled();
    });

    it("asks to try again when the manual check fails", async () => {
      const user = userEvent.setup();
      mockServiceWorkerUpdateState.checkForUpdate.mockRejectedValue(new Error("offline"));
      render(wrap(createElement(AppSettings)));

      await user.click(screen.getByTestId("btn-Check"));

      await waitFor(() => {
        expect(screen.getByRole("status")).toHaveTextContent("Couldn't check. Try again.");
      });
      expect(screen.getByText(TITLE)).toBeInTheDocument();
      await user.click(screen.getByTestId("btn-Try Again"));

      expect(mockServiceWorkerUpdateState.checkForUpdate).toHaveBeenCalledTimes(2);
    });

    it.each([
      ["checking", "Checking", "Looking for a newer version."],
      ["downloading", "Installing", "Installing the latest version."],
      ["activating", "Restart", "Restarting the app."],
    ])("shows a busy control during %s without moving anything", (phase, label, status) => {
      mockServiceWorkerUpdateState.phase = phase;

      render(wrap(createElement(AppSettings)));

      expect(screen.getByText(TITLE)).toBeInTheDocument();
      expect(screen.getByRole("status")).toHaveTextContent(status);
      const control = screen.getByTestId(`btn-${label}`);
      expect(control).toHaveAttribute("aria-busy", "true");
      expect(control.className).toBe(screen.getAllByTestId("select-trigger")[0].className);
      expect(screen.getAllByTestId("card")).toHaveLength(3);
    });

    it("offers Restart when a background check found a waiting update", async () => {
      mockServiceWorkerUpdateState.phase = "waiting";
      mockServiceWorkerUpdateState.updateAvailable = true;
      const user = userEvent.setup();

      render(wrap(createElement(AppSettings)));

      expect(screen.getByRole("status")).toHaveTextContent("A new version is ready.");
      await user.click(screen.getByTestId("btn-Restart"));

      expect(mockServiceWorkerUpdateState.activateNow).toHaveBeenCalledTimes(1);
    });

    it("offers a retry of the restart when activation stalls", async () => {
      mockServiceWorkerUpdateState.phase = "error";
      const user = userEvent.setup();

      render(wrap(createElement(AppSettings)));

      expect(screen.getByRole("status")).toHaveTextContent("Close and reopen the app.");
      await user.click(screen.getByTestId("btn-Try Again"));

      expect(mockServiceWorkerUpdateState.activateNow).toHaveBeenCalledTimes(1);
      expect(mockServiceWorkerUpdateState.checkForUpdate).not.toHaveBeenCalled();
    });

    it("offers a fresh check when the newer worker could not install", async () => {
      mockServiceWorkerUpdateState.phase = "install-failed";
      const user = userEvent.setup();

      render(wrap(createElement(AppSettings)));

      expect(screen.getByRole("status")).toHaveTextContent("Couldn't finish. Try again.");
      await user.click(screen.getByTestId("btn-Try Again"));

      expect(mockServiceWorkerUpdateState.checkForUpdate).toHaveBeenCalledTimes(1);
      expect(mockServiceWorkerUpdateState.activateNow).not.toHaveBeenCalled();
    });
  });
});
