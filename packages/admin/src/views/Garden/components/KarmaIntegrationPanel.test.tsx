/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import enMessages from "@green-goods/shared/i18n/en";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { KarmaIntegrationPanel } from "./KarmaIntegrationPanel";
import type { KarmaIntegrationController } from "@green-goods/shared/hooks/garden/useKarmaIntegration";

const DEFAULT_INTEGRATION = {
  status: {
    status: "synced",
    chainId: 42161,
    gardenAddress: "0x0000000000000000000000000000000000000001",
    projectUID: null,
    profileUrl: "https://www.karmahq.org/project/aiyeloja-family-garden",
    syncVersion: 1,
    requiredSyncVersion: 1,
    reason: null,
  },
  profileUrl: "https://www.karmahq.org/project/aiyeloja-family-garden",
  canReconcile: true,
  isLoading: false,
  isFetching: false,
  isReconciling: false,
  isPending: false,
  error: null,
  reconcile: vi.fn(async () => "0x1" as const),
} satisfies KarmaIntegrationController;

function buildIntegration(
  overrides: Omit<Partial<KarmaIntegrationController>, "status"> & {
    status?: KarmaIntegrationController["status"]["status"];
  } = {}
): KarmaIntegrationController {
  const { status, ...controllerOverrides } = overrides;
  return {
    ...DEFAULT_INTEGRATION,
    ...controllerOverrides,
    status: {
      ...DEFAULT_INTEGRATION.status,
      status: status ?? DEFAULT_INTEGRATION.status.status,
    } as KarmaIntegrationController["status"],
  };
}

function renderPanel(overrides: Parameters<typeof buildIntegration>[0] = {}) {
  return render(
    <IntlProvider locale="en" messages={enMessages}>
      <KarmaIntegrationPanel integration={buildIntegration(overrides)} />
    </IntlProvider>
  );
}

describe("KarmaIntegrationPanel", () => {
  it.each([
    ["unsupported", "Unavailable"],
    ["upgrade-needed", "Migration needed"],
    ["no-project", "No profile"],
    ["stale-details", "Details pending"],
    ["access-pending", "Access pending"],
    ["failed", "Sync failed"],
    ["retrying", "Syncing"],
    ["synced", "Synced"],
  ] as const)("renders the %s state with a text label", (status, label) => {
    renderPanel({ status });

    expect(screen.getByText(label)).toBeVisible();
  });

  it("reserves the panel geometry without announcing a provisional loading state", () => {
    const { container } = renderPanel({ status: "no-project", isLoading: true });

    expect(screen.queryByText("No profile")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector('[data-state="loading"]')).toHaveAttribute(
      "aria-hidden",
      "true"
    );
  });

  it("renders a disambiguated external Karma profile link when one is available", () => {
    renderPanel();

    const link = screen.getByRole("link", { name: "Open This Garden's Karma Profile" });
    expect(link).toHaveAttribute("href", "https://www.karmahq.org/project/aiyeloja-family-garden");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it.each([
    "no-project",
    "stale-details",
    "access-pending",
    "failed",
  ] as const)("lets an Owner or Steward reconcile the %s state", async (status) => {
    const reconcile = vi.fn(async () => "0x1" as const);
    renderPanel({ status, canReconcile: true, reconcile });

    await userEvent.click(
      screen.getByRole("button", {
        name: status === "failed" ? "Retry Karma Sync" : "Retry Sync",
      })
    );

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("does not offer reconciliation to a read-only user", () => {
    renderPanel({ status: "failed", canReconcile: false });

    expect(screen.queryByRole("button", { name: "Retry Karma Sync" })).not.toBeInTheDocument();
  });

  it("reports legacy GardenAccounts as migration-blocked without offering an unsafe action", () => {
    renderPanel({ status: "upgrade-needed", canReconcile: true });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/reviewed compatibility migration/i)).toBeVisible();
  });

  it("prevents duplicate submissions while a repair is pending", () => {
    renderPanel({ status: "retrying", isPending: true });

    const button = screen.getByRole("button", { name: "Syncing…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
  });

  it("keeps failed integration copy calm and does not expose a raw error", () => {
    renderPanel({ status: "failed" });

    expect(screen.getByText(/Your Garden data is safe/i)).toBeVisible();
    expect(screen.queryByText(/revert|stack|execution reverted/i)).not.toBeInTheDocument();
  });
});
