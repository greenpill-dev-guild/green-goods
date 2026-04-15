/**
 * CanvasScaffold Tests
 *
 * Covers the reusable canvas route scaffolds extracted from Hub:
 * workbench row, empty shell, and responsive FAB behavior.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id, defaultMessage }: { id: string; defaultMessage?: string }) => {
      const messages: Record<string, string> = {
        "fab.submit": "Submit work",
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
  useCanvasResponsiveFab,
  useFabConfigValue,
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

describe("CanvasScaffold", () => {
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
      actions: [{ id: "submit", icon: StubIcon, label: "Submit work", labelId: "fab.submit" }],
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

  it("moves the primary action into content on mobile", async () => {
    const onAction = vi.fn();
    const config: FabConfig = {
      icon: StubIcon,
      label: "Submit",
      actions: [{ id: "submit", icon: StubIcon, label: "Submit work", labelId: "fab.submit" }],
      onAction,
    };

    render(
      <FabProvider>
        <ResponsiveFabProbe config={config} isDesktop={false} />
      </FabProvider>
    );

    expect(screen.getByTestId("fab-config-state")).toHaveTextContent("none");
    await user.click(screen.getByRole("button", { name: /submit work/i }));
    expect(onAction).toHaveBeenCalledWith("submit");
  });

  it("hides the mobile action when an editable field receives focus", async () => {
    const config: FabConfig = {
      icon: StubIcon,
      label: "Submit",
      actions: [{ id: "submit", icon: StubIcon, label: "Submit work", labelId: "fab.submit" }],
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
      actions: [{ id: "submit", icon: StubIcon, label: "Submit work", labelId: "fab.submit" }],
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
});
