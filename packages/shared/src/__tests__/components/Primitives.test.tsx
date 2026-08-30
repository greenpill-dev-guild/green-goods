/**
 * Canvas Primitives Tests
 *
 * Covers the reusable canvas layout primitives:
 * workbench row, empty shell, and responsive FAB behavior.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id, defaultMessage }: { id: string; defaultMessage?: string }) => {
      const messages: Record<string, string> = {
        "fab.submit": "Submit Work",
      };
      return messages[id] ?? defaultMessage ?? id;
    },
  }),
}));

import type { FabConfig, CanvasMobilePrimaryAction } from "../../components";
import {
  EmptyStateShell,
  WorkbenchRow,
  FabProvider,
  RefreshActionProvider,
  useCanvasResponsiveFab,
  useFabConfigValue,
  useRefreshAction,
  useRefreshActionValue,
} from "../../components";
import { useCanvasMobileChromeHidden } from "../../components/Canvas/useCanvasMobileChromeHidden";

function StubIcon({ className }: { className?: string }) {
  return <span data-testid="stub-icon" className={className} />;
}

/**
 * Inline version of CanvasMobileActionSlot (dead code in shared — inlined in admin views).
 * Used here to test the useCanvasResponsiveFab hook end-to-end.
 */
function MobileActionSlot({ action }: { action: CanvasMobilePrimaryAction | null }) {
  const hideMobileChrome = useCanvasMobileChromeHidden();
  if (hideMobileChrome || !action) return null;
  const Icon = action.icon;
  return (
    <button type="button" onClick={action.onClick}>
      <Icon className="h-5 w-5" />
      {action.label}
    </button>
  );
}

function ResponsiveFabProbe({
  config,
  isDesktop,
  blocked = false,
}: {
  config: FabConfig;
  isDesktop: boolean;
  blocked?: boolean;
}) {
  const mobileAction = useCanvasResponsiveFab({
    fab: config,
    isDesktop,
    blocked,
  });
  const activeConfig = useFabConfigValue();

  return (
    <>
      <div data-testid="fab-config-state">{activeConfig ? "mounted" : "none"}</div>
      <MobileActionSlot action={mobileAction} />
    </>
  );
}

function UnstableFabRegistrationProbe({
  onProviderConfig,
  onAction,
}: {
  onProviderConfig: (config: FabConfig) => void;
  onAction: (actionId: string, tick: number) => void;
}) {
  const [tick, setTick] = useState(0);
  const config: FabConfig = {
    icon: StubIcon,
    label: "Submit",
    actions: [{ id: "submit", icon: StubIcon, label: "Submit Work", labelId: "fab.submit" }],
    onAction: (actionId) => onAction(actionId, tick),
  };
  const activeConfig = useFabConfigValue();
  useCanvasResponsiveFab({ fab: config, isDesktop: false });

  useEffect(() => {
    if (!activeConfig) return;
    onProviderConfig(activeConfig);
  }, [activeConfig, onProviderConfig]);

  useEffect(() => {
    if (tick < 3) setTick((current) => current + 1);
  }, [tick]);

  useEffect(() => {
    if (tick !== 3 || !activeConfig) return;
    activeConfig.onAction("submit");
  }, [activeConfig, tick]);

  return <div data-testid="fab-registration-tick">{tick}</div>;
}

function UnstableRefreshRegistrationProbe({
  onProviderConfig,
  onRefresh,
}: {
  onProviderConfig: (config: ReturnType<typeof useRefreshActionValue>) => void;
  onRefresh: (tick: number) => void;
}) {
  const [tick, setTick] = useState(0);
  const activeConfig = useRefreshActionValue();
  useRefreshAction({ onRefresh: () => onRefresh(tick), isFetching: false });

  useEffect(() => {
    onProviderConfig(activeConfig);
  }, [activeConfig, onProviderConfig]);

  useEffect(() => {
    if (tick < 3) setTick((current) => current + 1);
  }, [tick]);

  useEffect(() => {
    if (tick !== 3 || !activeConfig) return;
    activeConfig.onRefresh();
  }, [activeConfig, tick]);

  return <div data-testid="refresh-registration-tick">{tick}</div>;
}

describe("Canvas Primitives", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders workbench rows as buttons when actionable", async () => {
    const onClick = vi.fn();

    render(
      <WorkbenchRow
        eyebrow="Work"
        title="Review greenhouse update"
        description="Action 12 · 0x1234...5678"
        meta={["Pending", "2m ago"]}
        statusLabel="Pending"
        statusTone="pending"
        leadingIcon={StubIcon}
        onClick={onClick}
      />
    );

    await user.click(screen.getByRole("button", { name: /Review greenhouse update/i }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders the empty shell as a centered canvas surface", () => {
    render(
      <EmptyStateShell>
        <p>No work yet</p>
      </EmptyStateShell>
    );

    expect(screen.getByText("No work yet")).toBeInTheDocument();
  });

  it("keeps the nav FAB on desktop and does not render a mobile action", () => {
    const onAction = vi.fn();
    const config: FabConfig = {
      icon: StubIcon,
      label: "Submit",
      actions: [{ id: "submit", icon: StubIcon, label: "Submit Work", labelId: "fab.submit" }],
      onAction,
    };

    render(
      <FabProvider>
        <ResponsiveFabProbe config={config} isDesktop />
      </FabProvider>
    );

    expect(screen.getByTestId("fab-config-state")).toHaveTextContent("mounted");
    expect(screen.queryByRole("button", { name: /submit work/i })).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("registers the FAB on mobile AND exposes a primary action for content surfaces", async () => {
    const onAction = vi.fn();
    const config: FabConfig = {
      icon: StubIcon,
      label: "Submit",
      actions: [{ id: "submit", icon: StubIcon, label: "Submit Work", labelId: "fab.submit" }],
      onAction,
    };

    render(
      <FabProvider>
        <ResponsiveFabProbe config={config} isDesktop={false} />
      </FabProvider>
    );

    // Per handoff sheet-system + admin-design-revamp Tier 5: FAB is registered
    // at every breakpoint <1024px so the floating-pill layer in NavigationBar
    // can render it. The hook ALSO returns a CanvasMobilePrimaryAction for
    // views that want a content-zone affordance (Hub stage rail) — both
    // surfaces stay live so phones don't lose creation flows.
    expect(screen.getByTestId("fab-config-state")).toHaveTextContent("mounted");
    await user.click(screen.getByRole("button", { name: /submit work/i }));
    expect(onAction).toHaveBeenCalledWith("submit");
  });

  it("keeps mobile actions visible in a desktop browser resized to phone width", async () => {
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 692,
    });
    Object.defineProperty(window.screen, "height", {
      configurable: true,
      value: 956,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === "(pointer: coarse)" ? false : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    const config: FabConfig = {
      icon: StubIcon,
      label: "Submit",
      actions: [{ id: "submit", icon: StubIcon, label: "Submit Work", labelId: "fab.submit" }],
      onAction: vi.fn(),
    };

    render(
      <FabProvider>
        <ResponsiveFabProbe config={config} isDesktop={false} />
      </FabProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /submit work/i })).toBeInTheDocument();
    });
  });

  it("hides the mobile action when an editable field receives focus", async () => {
    const config: FabConfig = {
      icon: StubIcon,
      label: "Submit",
      actions: [{ id: "submit", icon: StubIcon, label: "Submit Work", labelId: "fab.submit" }],
      onAction: vi.fn(),
    };

    render(
      <FabProvider>
        <label>
          Notes
          <input aria-label="Notes" />
        </label>
        <ResponsiveFabProbe config={config} isDesktop={false} />
      </FabProvider>
    );

    await user.click(screen.getByRole("textbox", { name: /notes/i }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /submit work/i })).toBeNull();
    });
  });

  it("suppresses both nav and mobile FAB surfaces when blocked", () => {
    const config: FabConfig = {
      icon: StubIcon,
      label: "Submit",
      actions: [{ id: "submit", icon: StubIcon, label: "Submit Work", labelId: "fab.submit" }],
      onAction: vi.fn(),
    };

    render(
      <FabProvider>
        <ResponsiveFabProbe config={config} isDesktop={false} blocked />
      </FabProvider>
    );

    expect(screen.getByTestId("fab-config-state")).toHaveTextContent("none");
    expect(screen.queryByRole("button", { name: /submit work/i })).toBeNull();
  });

  it("does not re-publish equivalent FAB config objects on every render", async () => {
    const onProviderConfig = vi.fn();
    const onAction = vi.fn();

    render(
      <FabProvider>
        <UnstableFabRegistrationProbe onProviderConfig={onProviderConfig} onAction={onAction} />
      </FabProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("fab-registration-tick")).toHaveTextContent("3");
    });

    expect(onProviderConfig).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith("submit", 3);
  });

  it("does not re-publish equivalent refresh config objects on every render", async () => {
    const onProviderConfig = vi.fn();
    const onRefresh = vi.fn();

    render(
      <RefreshActionProvider>
        <UnstableRefreshRegistrationProbe
          onProviderConfig={onProviderConfig}
          onRefresh={onRefresh}
        />
      </RefreshActionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("refresh-registration-tick")).toHaveTextContent("3");
    });

    expect(onProviderConfig).toHaveBeenCalledTimes(2);
    expect(onProviderConfig.mock.calls[0]?.[0]).toBeNull();
    expect(onProviderConfig.mock.calls[1]?.[0]).toBeTruthy();
    expect(onRefresh).toHaveBeenCalledWith(3);
  });
});
