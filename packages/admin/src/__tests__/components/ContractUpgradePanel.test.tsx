/**
 * ContractUpgradePanel Component Tests
 *
 * Tests for the contract upgrade panel in the Contracts view.
 * Covers rendering, authentication states, and upgrade button states.
 */

import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { en as enMessages } from "@green-goods/shared";

// ── Mock state ──────────────────────────────────────────

const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockRunJob = vi.fn();

let mockHealthData = { ok: true };
let mockIsAuthenticated = false;
let mockIsConnecting = false;
let mockSession: { address?: string } | null = null;
let mockJobs: Array<{ id: string; type: string; status: string }> = [];
let mockUpgradePlanPending = false;
let mockFinalizeUpgradePending = false;

vi.mock("@green-goods/shared", () => ({
  useOpsRunnerConnect: () => ({
    connect: mockConnect,
    disconnect: mockDisconnect,
    isConnecting: mockIsConnecting,
    isAuthenticated: mockIsAuthenticated,
    session: mockSession,
  }),
  useOpsRunnerHealth: () => ({
    data: mockHealthData,
  }),
  useOpsUpgradePlan: () => ({
    isPending: mockUpgradePlanPending,
    mutateAsync: vi.fn(),
  }),
  useOpsFinalizeUpgrade: () => ({
    isPending: mockFinalizeUpgradePending,
    mutateAsync: vi.fn(),
  }),
  useOpsRunnerJobs: () => ({
    data: mockJobs,
  }),
  useOpsRunnerJob: () => ({
    data: null,
  }),
  useOpsJobLogs: () => ({
    logs: [],
    status: null,
  }),
  useOpsJobRunner: () => ({
    runJob: mockRunJob,
  }),
  Button: ({
    children,
    loading,
    disabled,
    onClick,
    variant,
    type,
  }: {
    children: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    onClick?: () => void;
    variant?: string;
    type?: string;
  }) =>
    React.createElement(
      "button",
      {
        onClick,
        disabled: disabled || loading,
        "data-variant": variant,
        "data-loading": loading ? "true" : undefined,
        type,
      },
      loading ? "Loading..." : children
    ),
  Card: Object.assign(
    ({ children, colorAccent }: { children: React.ReactNode; colorAccent?: string }) =>
      React.createElement("div", { "data-testid": "card", "data-accent": colorAccent }, children),
    {
      Header: ({ children, className }: { children: React.ReactNode; className?: string }) =>
        React.createElement("div", { "data-testid": "card-header", className }, children),
      Body: ({ children, className }: { children: React.ReactNode; className?: string }) =>
        React.createElement("div", { "data-testid": "card-body", className }, children),
    }
  ),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890123456789012345678901234567890" }),
  useSignMessage: () => ({ signMessageAsync: vi.fn() }),
}));

vi.mock("@/utils/ops", () => ({
  chainIdToOpsNetwork: () => "sepolia",
  getOpsStatusBadge: (status: string) => {
    switch (status) {
      case "succeeded":
        return "text-success-base";
      case "failed":
        return "text-error-base";
      case "running":
        return "text-warning-base";
      default:
        return "text-text-soft";
    }
  },
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    loading,
    disabled,
    onClick,
  }: {
    children: React.ReactNode;
    loading?: boolean;
    disabled?: boolean;
    onClick?: () => void;
  }) =>
    React.createElement(
      "button",
      { onClick, disabled: disabled || loading },
      loading ? "Loading..." : children
    ),
}));

vi.mock("@/components/ui/Card", () => ({
  Card: Object.assign(
    ({ children }: { children: React.ReactNode }) =>
      React.createElement("div", { "data-testid": "card" }, children),
    {
      Header: ({ children }: { children: React.ReactNode }) =>
        React.createElement("div", { "data-testid": "card-header" }, children),
      Body: ({ children }: { children: React.ReactNode }) =>
        React.createElement("div", { "data-testid": "card-body" }, children),
    }
  ),
}));

vi.mock("@remixicon/react", () => {
  const Icon = (props: unknown) => React.createElement("span", props as object);
  return new Proxy({}, { get: () => Icon });
});

import { ContractUpgradePanel } from "../../views/Contracts/ContractUpgradePanel";

function renderWithIntl(ui: React.ReactElement) {
  return render(React.createElement(IntlProvider, { locale: "en", messages: enMessages }, ui));
}

describe("views/Contracts/ContractUpgradePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHealthData = { ok: true };
    mockIsAuthenticated = false;
    mockIsConnecting = false;
    mockSession = null;
    mockJobs = [];
    mockUpgradePlanPending = false;
    mockFinalizeUpgradePending = false;
  });

  describe("rendering", () => {
    it("renders the upgrade panel title and description", () => {
      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Upgrade Contracts")).toBeInTheDocument();
      expect(screen.getByText("Upgrade existing contracts on Sepolia.")).toBeInTheDocument();
    });

    it("renders contract target selector with all options", () => {
      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Contract Target")).toBeInTheDocument();
      const select = screen.getByLabelText("Contract Target");
      expect(select).toBeInTheDocument();

      // Check that options include known contracts
      const options = select.querySelectorAll("option");
      const optionValues = Array.from(options).map((opt) => opt.textContent);
      expect(optionValues).toContain("all");
      expect(optionValues).toContain("garden-token");
      expect(optionValues).toContain("work-resolver");
    });

    it("renders sender address input", () => {
      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Sender Address")).toBeInTheDocument();
      expect(screen.getByLabelText("Sender Address")).toBeInTheDocument();
    });
  });

  describe("runner health status", () => {
    it("shows Ops Runner Online when health is ok", () => {
      mockHealthData = { ok: true };

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Ops Runner Online")).toBeInTheDocument();
    });

    it("shows Ops Runner Offline when health is not ok", () => {
      mockHealthData = { ok: false };

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Ops Runner Offline")).toBeInTheDocument();
    });
  });

  describe("authentication state", () => {
    it("shows Authenticate Runner button when not authenticated", () => {
      mockIsAuthenticated = false;

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Authenticate Runner")).toBeInTheDocument();
    });

    it("calls connect when Authenticate button is clicked", async () => {
      mockIsAuthenticated = false;
      const user = userEvent.setup();

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      await user.click(screen.getByText("Authenticate Runner"));
      expect(mockConnect).toHaveBeenCalledTimes(1);
    });

    it("shows Disconnect Runner button when authenticated", () => {
      mockIsAuthenticated = true;

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Disconnect Runner")).toBeInTheDocument();
    });

    it("shows auth required message when not authenticated", () => {
      mockIsAuthenticated = false;

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(
        screen.getByText("Authenticate with Ops Runner before submitting upgrades.")
      ).toBeInTheDocument();
    });

    it("does not show auth required message when authenticated", () => {
      mockIsAuthenticated = true;

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(
        screen.queryByText("Authenticate with Ops Runner before submitting upgrades.")
      ).not.toBeInTheDocument();
    });

    it("shows session address when authenticated", () => {
      mockIsAuthenticated = true;
      mockSession = { address: "0xABCDEF1234567890ABCDEF1234567890ABCDEF12" };

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("0xABCDEF1234567890ABCDEF1234567890ABCDEF12")).toBeInTheDocument();
    });
  });

  describe("upgrade buttons", () => {
    it("disables Generate Tx Plan when not authenticated", () => {
      mockIsAuthenticated = false;

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Generate Tx Plan")).toBeDisabled();
    });

    it("disables Execute Upgrade when not authenticated", () => {
      mockIsAuthenticated = false;

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Execute Upgrade")).toBeDisabled();
    });

    it("enables Generate Tx Plan when authenticated", () => {
      mockIsAuthenticated = true;

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Generate Tx Plan")).not.toBeDisabled();
    });

    it("enables Execute Upgrade when authenticated", () => {
      mockIsAuthenticated = true;

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Execute Upgrade")).not.toBeDisabled();
    });
  });

  describe("job status", () => {
    it("shows no jobs message when no job is selected", () => {
      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("No upgrade jobs yet")).toBeInTheDocument();
    });

    it("renders job selector with available jobs", () => {
      mockIsAuthenticated = true;
      mockJobs = [
        { id: "job-001-abcdef12", type: "upgrade-plan", status: "succeeded" },
        { id: "job-002-deadbeef", type: "upgrade-execute", status: "running" },
      ];

      renderWithIntl(
        React.createElement(ContractUpgradePanel, {
          selectedChainId: 11155111,
          chainName: "Sepolia",
        })
      );

      expect(screen.getByText("Upgrade Job Status")).toBeInTheDocument();
      // Job options should appear in the selector
      expect(screen.getByText(/upgrade-plan/)).toBeInTheDocument();
      expect(screen.getByText(/upgrade-execute/)).toBeInTheDocument();
    });
  });
});
