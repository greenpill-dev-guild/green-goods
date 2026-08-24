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
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void>;
    confirmLabel: string;
  }) =>
    isOpen ? (
      <section data-testid="confirm-dialog">
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
    onClose,
  }: {
    open: boolean;
    intent: string;
    onClose: () => void;
  }) => (
    <button
      type="button"
      data-testid="setup-flow"
      data-open={String(open)}
      data-intent={intent}
      onClick={onClose}
    >
      Close setup
    </button>
  ),
}));
vi.mock("@/views/Garden/Pool/PoolSettingsDialog", () => ({
  PoolSettingsDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <button type="button" data-testid="settings-dialog" data-open={String(open)} onClick={onClose}>
      Close settings
    </button>
  ),
}));
vi.mock("@/views/Garden/Pool/Seed", () => ({
  SeedCommitmentDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <button type="button" data-testid="seed-dialog" onClick={onClose}>
        Close seed
      </button>
    ) : null,
}));
vi.mock("@/views/Garden/Pool/CommitmentDialog", () => ({
  CommitmentDialogPanel: ({ commitmentId }: { commitmentId: string }) => (
    <div data-testid="commitment-panel">{commitmentId}</div>
  ),
}));
vi.mock("@/views/Garden/Pool/PoolReasonDialogs", () => ({
  PoolReasonDialogs: ({ reasonDialog }: { reasonDialog: { kind: string } | null }) => (
    <div data-testid="reason-dialog">{reasonDialog?.kind ?? "closed"}</div>
  ),
}));

const { PoolDialogs } = await import("@/views/Garden/Pool/PoolDialogs");

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

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
    setSeedOpen: vi.fn(),
    setInspected: vi.fn(),
    setReasonDialog: vi.fn(),
    setConfirmDialog: vi.fn(),
  };
  renderWithProviders(
    <PoolDialogs
      pool={pool}
      garden={{ id: GARDEN, name: "Rocinha" }}
      chainId={42161}
      tone="garden"
      presentation={{ inspector: "route" }}
      flow={null}
      settingsOpen={false}
      seedOpen={false}
      inspected={null}
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

  it("mounts seed and commitment inspectors only for dialog presentation", () => {
    const { setSeedOpen, setInspected } = setup({
      presentation: { inspector: "dialog" },
      seedOpen: true,
      inspected: "42",
    });
    expect(screen.getByTestId("commitment-panel")).toHaveTextContent("42");
    fireEvent.click(screen.getByTestId("seed-dialog"));
    fireEvent.click(screen.getByRole("button", { name: "Close inspector" }));
    expect(setSeedOpen).toHaveBeenCalledWith(false);
    expect(setInspected).toHaveBeenCalledWith(null);
  });

  it("does not mount dialog-owned inspectors in route presentation", () => {
    setup({ presentation: { inspector: "route" }, seedOpen: true, inspected: "42" });
    expect(screen.queryByTestId("seed-dialog")).not.toBeInTheDocument();
    expect(screen.queryByTestId("commitment-panel")).not.toBeInTheDocument();
  });

  it.each([
    ["close", "Close pool", "closePool"],
    ["compost", "Archive pool", "compostPool"],
    ["reopen", "Reopen to set-up", "reopenPool"],
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
