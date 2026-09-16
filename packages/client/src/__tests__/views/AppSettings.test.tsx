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

const mockToast = vi.hoisted(() => ({ info: vi.fn(), error: vi.fn(), success: vi.fn() }));

const mockOffline = vi.hoisted(() => ({
  status: {
    progress: {
      state: "ready",
      runBytes: 0,
      runRatio: 0,
      savedBytes: 42_000_000,
      missingPhotos: 0,
      failedReads: 0,
      storageFull: false,
    } as Record<string, unknown>,
    online: true,
    connectivity: { state: "online" },
    pause: vi.fn(),
    resume: vi.fn(),
    refresh: vi.fn(),
  },
}));
vi.mock("@green-goods/shared/hooks/offline/useOfflineContent", () => ({
  useOfflineStatus: () => mockOffline.status,
}));

// Mock @green-goods/shared
vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: mockToast,
}));

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
  RiDownloadCloud2Line: (props: any) => createElement("span", props),
  RiEarthFill: (props: any) => createElement("span", props),
  RiLoader4Line: (props: any) => createElement("span", props),
  RiRefreshLine: (props: any) => createElement("span", props),
  RiSettings2Line: (props: any) => createElement("span", props),
}));

// Mock client components
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
    mockOffline.status.connectivity = { state: "online" };
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

      expect(screen.getAllByTestId("card")).toHaveLength(4);
      expect(screen.getByText(TITLE)).toBeInTheDocument();
      expect(screen.getByRole("status", { name: "Update" })).toHaveTextContent(
        "Check for a newer version."
      );
      const check = screen.getByRole("button", { name: "Check" });
      const [themeTrigger] = screen.getAllByTestId("select-trigger");
      expect(check).toHaveClass(...themeTrigger.className.split(" "));
      expect(screen.queryByText("Refresh app")).not.toBeInTheDocument();
    });

    it("reports no update as a toast and leaves the row in its default state", async () => {
      const user = userEvent.setup();
      render(wrap(createElement(AppSettings)));

      await user.click(screen.getByRole("button", { name: "Check" }));

      expect(mockServiceWorkerUpdateState.checkForUpdate).toHaveBeenCalledTimes(1);
      await waitFor(() => {
        expect(mockToast.info).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "No update available",
            message: "You're on the latest version.",
          })
        );
      });
      expect(screen.getByText(TITLE)).toBeInTheDocument();
      expect(screen.getByRole("status", { name: "Update" })).toHaveTextContent(
        "Check for a newer version."
      );
      expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
      expect(screen.getAllByTestId("card")).toHaveLength(4);
    });

    it("reserves two subtitle lines in every row so the cards never change height", () => {
      render(wrap(createElement(AppSettings)));

      const subtitles = [
        screen.getByText(/choose how the app looks/i),
        screen.getByText(/set your preferred language/i),
        screen.getByRole("status", { name: "Update" }),
      ];
      for (const subtitle of subtitles) {
        expect(subtitle.className).toContain("min-h-8");
        expect(subtitle.className).toContain("line-clamp-2");
      }
    });

    it("leaves an update found by the manual check waiting for Restart", async () => {
      const user = userEvent.setup();
      mockServiceWorkerUpdateState.checkForUpdate.mockResolvedValue("ready");
      render(wrap(createElement(AppSettings)));

      await user.click(screen.getByRole("button", { name: "Check" }));

      await waitFor(() => expect(mockServiceWorkerUpdateState.checkForUpdate).toHaveBeenCalled());
      expect(mockServiceWorkerUpdateState.activateNow).not.toHaveBeenCalled();
      expect(mockToast.info).not.toHaveBeenCalled();
    });

    it("returns to a fresh check when the install is still pending", async () => {
      const user = userEvent.setup();
      mockServiceWorkerUpdateState.checkForUpdate.mockResolvedValue("pending");
      render(wrap(createElement(AppSettings)));

      await user.click(screen.getByRole("button", { name: "Check" }));

      expect(mockServiceWorkerUpdateState.checkForUpdate).toHaveBeenCalledTimes(1);
      expect(screen.getByRole("status", { name: "Update" })).toHaveTextContent(
        "Check for a newer version."
      );
      expect(screen.getByRole("button", { name: "Check" })).toBeInTheDocument();
      expect(mockServiceWorkerUpdateState.activateNow).not.toHaveBeenCalled();
    });

    it("reports a failed check as a toast and keeps the row ready for another check", async () => {
      const user = userEvent.setup();
      mockServiceWorkerUpdateState.checkForUpdate.mockRejectedValue(new Error("offline"));
      render(wrap(createElement(AppSettings)));

      await user.click(screen.getByRole("button", { name: "Check" }));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Couldn't check for updates" })
        );
      });
      expect(screen.getByRole("status", { name: "Update" })).toHaveTextContent(
        "Check for a newer version."
      );
      await user.click(screen.getByRole("button", { name: "Check" }));

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
      expect(screen.getByRole("status", { name: "Update" })).toHaveTextContent(status);
      const control = screen.getByRole("button", { name: label });
      expect(control).toHaveAttribute("aria-busy", "true");
      expect(control).toHaveClass(
        ...screen.getAllByTestId("select-trigger")[0].className.split(" ")
      );
      expect(screen.getAllByTestId("card")).toHaveLength(4);
    });

    it("offers Restart when a background check found a waiting update", async () => {
      mockServiceWorkerUpdateState.phase = "waiting";
      mockServiceWorkerUpdateState.updateAvailable = true;
      const user = userEvent.setup();

      render(wrap(createElement(AppSettings)));

      expect(screen.getByRole("status", { name: "Update" })).toHaveTextContent(
        "A new version is ready."
      );
      await user.click(screen.getByRole("button", { name: "Restart" }));

      expect(mockServiceWorkerUpdateState.activateNow).toHaveBeenCalledTimes(1);
    });

    it("offers a retry of the restart when activation stalls", async () => {
      mockServiceWorkerUpdateState.phase = "error";
      const user = userEvent.setup();

      render(wrap(createElement(AppSettings)));

      expect(screen.getByRole("status", { name: "Update" })).toHaveTextContent(
        "Close every app window, then open it again."
      );
      await user.click(screen.getByRole("button", { name: "Try Again" }));

      expect(mockServiceWorkerUpdateState.activateNow).toHaveBeenCalledTimes(1);
      expect(mockServiceWorkerUpdateState.checkForUpdate).not.toHaveBeenCalled();
    });

    it("offers a fresh check when the newer worker could not install", async () => {
      mockServiceWorkerUpdateState.phase = "install-failed";
      const user = userEvent.setup();

      render(wrap(createElement(AppSettings)));

      expect(screen.getByRole("status", { name: "Update" })).toHaveTextContent(
        "Couldn't finish. Try again."
      );
      await user.click(screen.getByRole("button", { name: "Try Again" }));

      expect(mockServiceWorkerUpdateState.checkForUpdate).toHaveBeenCalledTimes(1);
      expect(mockServiceWorkerUpdateState.activateNow).not.toHaveBeenCalled();
    });
  });
});

describe("offline content row", () => {
  const renderRow = (progress: Record<string, unknown>, online = true) => {
    mockOffline.status.progress = {
      runBytes: 0,
      runRatio: 0,
      savedBytes: 0,
      missingPhotos: 0,
      failedReads: 0,
      storageFull: false,
      ...progress,
    };
    mockOffline.status.online = online;
    mockOffline.status.connectivity = { state: online ? "online" : "offline" };
    render(wrap(createElement(AppSettings)));
    const status = screen.getByRole("status", { name: "Offline" });
    return { status, lines: [...status.querySelectorAll("span")].map((line) => line.textContent) };
  };

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("keeps the title on one line and the status on exactly two truncated lines", () => {
    const { status } = renderRow({ state: "ready", savedBytes: 42_000_000 });

    expect(screen.getByText("Offline")).toHaveClass("truncate");
    expect(status).toHaveClass("min-h-8");
    const lines = status.querySelectorAll("span");
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toHaveClass("block", "truncate");
  });

  it("shows megabytes and progress while downloading, with Pause instead of Retry", async () => {
    const { lines } = renderRow({ state: "downloading", runBytes: 12_400_000, runRatio: 0.38 });

    expect(lines).toEqual(["Downloading", "12 MB · 38%"]);
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(mockOffline.status.pause).toHaveBeenCalledTimes(1);
  });

  it("offers Resume where the download stopped", async () => {
    const { lines } = renderRow({
      state: "paused",
      pauseReason: "user",
      runBytes: 4_300_000,
      runRatio: 0.2,
    });

    expect(lines).toEqual(["Paused", "4.3 MB · 20%"]);
    await userEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(mockOffline.status.resume).toHaveBeenCalledTimes(1);
  });

  it("disables Resume while there is no connection", () => {
    const { lines } = renderRow({ state: "downloading", runRatio: 0.5 }, false);

    expect(lines).toEqual(["Paused", "No connection"]);
    expect(screen.getByRole("button", { name: "Resume" })).toBeDisabled();
  });

  it("explains photos held for Data Saver", () => {
    const { lines } = renderRow({ state: "paused", pauseReason: "dataSaver" });

    expect(lines).toEqual(["Photos paused", "Data Saver on"]);
    expect(screen.getByRole("button", { name: "Resume" })).toBeEnabled();
  });

  it("reports saved megabytes when ready and refreshes on request", async () => {
    const { lines } = renderRow({ state: "ready", savedBytes: 42_000_000 });

    expect(lines).toEqual(["Ready", "42 MB saved"]);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(mockOffline.status.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not claim readiness before preparation starts", () => {
    const { lines } = renderRow({ state: "idle" });
    expect(lines).toEqual(["Not prepared", "Preparation hasn’t started"]);
    expect(screen.getByRole("button", { name: "Start" })).toBeEnabled();
  });

  it("shows degraded connectivity without pausing preparation", () => {
    mockOffline.status.progress = {
      state: "downloading",
      runBytes: 0,
      runRatio: 0.2,
      savedBytes: 0,
      missingPhotos: 0,
      failedReads: 0,
      storageFull: false,
    };
    mockOffline.status.connectivity = { state: "degraded" };
    render(wrap(createElement(AppSettings)));
    const status = screen.getByRole("status", { name: "Offline" });
    expect([...status.querySelectorAll("span")].map((line) => line.textContent)).toEqual([
      "Connection unstable",
      "Preparation will keep trying",
    ]);
    expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled();
  });

  it("says Retry only after photos failed or storage filled up", async () => {
    const missing = renderRow({ state: "incomplete", missingPhotos: 12 });
    expect(missing.lines).toEqual(["Incomplete", "12 photos missing"]);
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mockOffline.status.refresh).toHaveBeenCalledTimes(1);
    cleanup();

    const full = renderRow({ state: "ready", storageFull: true });
    expect(full.lines).toEqual(["Incomplete", "Storage full"]);
  });
});
