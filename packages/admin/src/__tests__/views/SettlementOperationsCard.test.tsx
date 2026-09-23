/**
 * @vitest-environment jsdom
 */

import { settlementOperationsControllerFixture } from "@green-goods/shared/__tests__/test-utils/controller-fixtures";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const mocks = vi.hoisted(() => ({ toastSuccess: vi.fn() }));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { success: mocks.toastSuccess, error: vi.fn() },
}));

const { SettlementOperationsCard } = await import(
  "@/views/Community/components/SettlementOperationsCard"
);

describe("SettlementOperationsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing for a reader who is neither owner nor deployer", () => {
    const { container } = renderWithProviders(
      <SettlementOperationsCard
        operations={settlementOperationsControllerFixture({
          isSettlementOwner: false,
          isDeployer: false,
          canConfigureDelivery: false,
          showControl: false,
        })}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the chain's delivery state read-only to a deployer who is not the module owner", () => {
    renderWithProviders(
      <SettlementOperationsCard
        operations={settlementOperationsControllerFixture({
          isSettlementOwner: false,
          isDeployer: true,
          canConfigureDelivery: false,
          showControl: true,
          gardenerDeliveryEnabled: false,
        })}
      />
    );
    expect(screen.getByTestId("gardener-delivery-state")).toHaveTextContent("Off");
    expect(screen.queryByRole("button", { name: /Gardener Delivery/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("gardener-delivery-owner-only")).toHaveTextContent(
      "Only the settlement module owner (0x1b9a…2c19) can change this."
    );
  });

  it("lets the owner enable delivery only after an explicit confirmation and never flips optimistically", async () => {
    const setGardenerDelivery = vi.fn(async () => "0xabc123456789" as `0x${string}`);
    renderWithProviders(
      <SettlementOperationsCard
        operations={settlementOperationsControllerFixture({
          isSettlementOwner: true,
          canConfigureDelivery: true,
          showControl: true,
          gardenerDeliveryEnabled: false,
          setGardenerDelivery,
        })}
      />
    );
    expect(screen.getByTestId("gardener-delivery-state")).toHaveTextContent("Off");
    fireEvent.click(screen.getByRole("button", { name: "Enable Gardener Delivery…" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(/permits|lets stewards prepare and dispatch/)
    ).toBeInTheDocument();
    expect(setGardenerDelivery).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Send Transaction" }));
    await waitFor(() => expect(setGardenerDelivery).toHaveBeenCalledWith(true));
    // The displayed state is the controller's chain read, not the request.
    expect(screen.getByTestId("gardener-delivery-state")).toHaveTextContent("Off");
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Transaction submitted" })
      )
    );
  });

  it("shows a submitted Safe proposal with a manual on-chain refresh action", () => {
    const checkDeliveryStatus = vi.fn(async () => undefined);
    renderWithProviders(
      <SettlementOperationsCard
        operations={settlementOperationsControllerFixture({
          showControl: true,
          isSettlementOwner: true,
          canConfigureDelivery: true,
          gardenerDeliveryEnabled: false,
          lastAct: {
            kind: "set-gardener-delivery",
            phase: "submitted",
            hash: "0xsafe-proposal",
          },
          checkDeliveryStatus,
        })}
      />
    );

    expect(screen.getByTestId("gardener-delivery-status")).toHaveAttribute(
      "data-phase",
      "submitted"
    );
    expect(screen.getByText(/Awaiting Safe execution/)).toBeInTheDocument();
    expect(screen.getByTestId("gardener-delivery-state")).toHaveTextContent("Off");
    expect(screen.getByRole("button", { name: "Enable Gardener Delivery…" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Check on chain" }));
    expect(checkDeliveryStatus).toHaveBeenCalledTimes(1);
  });

  it("labels the action confirmed only after the controller has read back the requested value", () => {
    renderWithProviders(
      <SettlementOperationsCard
        operations={settlementOperationsControllerFixture({
          showControl: true,
          gardenerDeliveryEnabled: true,
          lastAct: {
            kind: "set-gardener-delivery",
            phase: "confirmed",
            hash: "0xexecuted",
          },
        })}
      />
    );

    expect(screen.getByTestId("gardener-delivery-state")).toHaveTextContent("On");
    expect(screen.getByTestId("gardener-delivery-status")).toHaveAttribute(
      "data-phase",
      "confirmed"
    );
    expect(screen.queryByRole("button", { name: "Check on chain" })).not.toBeInTheDocument();
  });

  it("reports a rejected transaction without changing the switch", () => {
    renderWithProviders(
      <SettlementOperationsCard
        operations={settlementOperationsControllerFixture({
          isSettlementOwner: true,
          canConfigureDelivery: true,
          showControl: true,
          gardenerDeliveryEnabled: false,
          lastAct: { kind: "set-gardener-delivery", phase: "failed", error: new Error("rejected") },
        })}
      />
    );
    expect(screen.getByTestId("gardener-delivery-status")).toHaveAttribute("data-phase", "failed");
    expect(screen.getByTestId("gardener-delivery-state")).toHaveTextContent("Off");
  });

  it("shows the paused source and a failed module read", () => {
    renderWithProviders(
      <SettlementOperationsCard
        operations={settlementOperationsControllerFixture({
          showControl: true,
          sourcePaused: true,
          isError: true,
          gardenerDeliveryEnabled: null,
        })}
      />
    );
    expect(screen.getByText("Paused")).toBeInTheDocument();
    expect(screen.getByText("Couldn't read the settlement module")).toBeInTheDocument();
    expect(screen.getByTestId("gardener-delivery-state")).toHaveTextContent("Not read");
    expect(screen.queryByRole("button", { name: /Gardener Delivery/ })).not.toBeInTheDocument();
  });
});
