/** @vitest-environment jsdom */

import { poolConsoleControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";
import { type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor } from "../test-utils";

vi.mock("@/components/AdminDialog", () => ({
  AdminDialog: ({
    open,
    onOpenChange,
    title,
    children,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    children: ReactNode;
  }) =>
    open ? (
      <section data-testid="admin-dialog">
        <h2>{title}</h2>
        {children}
        <button type="button" onClick={() => onOpenChange(false)}>
          Close inspector
        </button>
      </section>
    ) : null,
  AdminConfirmDialog: ({
    isOpen,
    onClose,
    onConfirm,
    confirmLabel,
    children,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    confirmLabel: string;
    children?: ReactNode;
  }) =>
    isOpen ? (
      <section data-testid="confirm-dialog">
        {children}
        <button type="button" onClick={onClose}>
          Cancel confirmation
        </button>
        <button type="button" onClick={() => void onConfirm()}>
          {confirmLabel}
        </button>
      </section>
    ) : null,
}));

vi.mock("@/views/Garden/Pool/SetupFlow", () => ({
  PoolSetupFlow: ({
    open,
    intent,
    target,
    onClose,
  }: {
    open: boolean;
    intent: string;
    target: { gardenName: string; isProtocol: boolean };
    onClose: () => void;
  }) => (
    <button
      type="button"
      data-testid="setup-flow"
      data-open={String(open)}
      data-intent={intent}
      data-target={`${target.gardenName}:${target.isProtocol}`}
      onClick={onClose}
    >
      Close setup
    </button>
  ),
}));
vi.mock("@/views/Garden/Pool/PoolSettingsDialog", () => ({
  PoolSettingsDialog: ({
    open,
    target,
    onClose,
  }: {
    open: boolean;
    target: { gardenName: string; isProtocol: boolean };
    onClose: () => void;
  }) => (
    <button
      type="button"
      data-testid="settings-dialog"
      data-open={String(open)}
      data-target={`${target.gardenName}:${target.isProtocol}`}
      onClick={onClose}
    >
      Close settings
    </button>
  ),
}));
vi.mock("@/views/Garden/Pool/PoolReasonDialogs", () => ({
  PoolReasonDialogs: ({
    reasonDialog,
    target,
  }: {
    reasonDialog: { kind: string } | null;
    target: { gardenName: string; isProtocol: boolean };
  }) => (
    <div data-testid="reason-dialog" data-target={`${target.gardenName}:${target.isProtocol}`}>
      {reasonDialog?.kind ?? "closed"}
    </div>
  ),
}));

const { PoolDialogs } = await import("@/views/Garden/Pool/PoolDialogs");

function setup(overrides: Partial<Parameters<typeof PoolDialogs>[0]> = {}) {
  const closePool = vi.fn().mockResolvedValue(undefined);
  const compostPool = vi.fn().mockResolvedValue(undefined);
  const reopenPool = vi.fn().mockResolvedValue(undefined);
  const basePool = poolConsoleControllerFixture();
  const pool = {
    ...basePool,
    acts: { ...basePool.acts, closePool, compostPool, reopenPool },
  };
  const setters = {
    setFlow: vi.fn(),
    setSettingsOpen: vi.fn(),
    setReasonDialog: vi.fn(),
    setConfirmDialog: vi.fn(),
  };
  renderWithProviders(
    <PoolDialogs
      pool={pool}
      target={{ gardenName: "Rocinha", isProtocol: false }}
      tone="garden"
      flow={null}
      settingsOpen={false}
      reasonDialog={null}
      confirmDialog={null}
      {...setters}
      {...overrides}
    />
  );
  return { closePool, compostPool, reopenPool, ...setters };
}

describe("PoolDialogs", () => {
  it("keeps setup, settings, and reason dialog ownership in one composition", () => {
    const { setFlow, setSettingsOpen } = setup({
      flow: { intent: "season" },
      settingsOpen: true,
      reasonDialog: { kind: "pause" },
    });
    expect(screen.getByTestId("setup-flow")).toHaveAttribute("data-intent", "season");
    expect(screen.getByTestId("settings-dialog")).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("reason-dialog")).toHaveTextContent("pause");
    fireEvent.click(screen.getByTestId("setup-flow"));
    fireEvent.click(screen.getByTestId("settings-dialog"));
    expect(setFlow).toHaveBeenCalledWith(null);
    expect(setSettingsOpen).toHaveBeenCalledWith(false);
  });

  it("hands every dialog the one pool it writes to, and names it in each confirmation", () => {
    setup({ flow: { intent: "first-run" }, settingsOpen: true, confirmDialog: "close" });
    expect(screen.getByTestId("setup-flow")).toHaveAttribute("data-target", "Rocinha:false");
    expect(screen.getByTestId("settings-dialog")).toHaveAttribute("data-target", "Rocinha:false");
    expect(screen.getByTestId("reason-dialog")).toHaveAttribute("data-target", "Rocinha:false");
    expect(screen.getByTestId("confirm-dialog")).toHaveTextContent("Writing to");
    expect(screen.getByTestId("confirm-dialog")).toHaveTextContent("Rocinha’s pool");
  });

  it("sets the protocol pool apart as a warning, never as a garden's pool", () => {
    setup({
      confirmDialog: "compost",
      target: { gardenName: "Green Goods Community Garden", isProtocol: true },
    });
    const dialog = screen.getByTestId("confirm-dialog");
    expect(dialog).toHaveTextContent("Writing to the Green Goods protocol pool");
    expect(dialog).not.toHaveTextContent("Green Goods Community Garden’s pool");
  });

  it.each([
    ["close", "Close Pool", "closePool"],
    ["compost", "Archive Pool", "compostPool"],
    ["reopen", "Reopen to Set-Up", "reopenPool"],
  ] as const)("executes and closes the %s confirmation", async (confirmDialog, label, act) => {
    const result = setup({ confirmDialog });
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(result[act]).toHaveBeenCalled());
    expect(result.setConfirmDialog).toHaveBeenCalledWith(null);
  });

  it("closes a confirmation without acting", () => {
    const { closePool, setConfirmDialog } = setup({ confirmDialog: "close" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel confirmation" }));
    expect(setConfirmDialog).toHaveBeenCalledWith(null);
    expect(closePool).not.toHaveBeenCalled();
  });
});
