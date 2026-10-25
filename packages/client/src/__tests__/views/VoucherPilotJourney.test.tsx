import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { servicePilotStorySnapshot } from "../../views/Home/Garden/Commitment/serviceAccessStoryFixtures";
import { VoucherPilotJourney } from "../../views/Home/Garden/Commitment/VoucherPilotJourney";
import { renderWithProviders, screen, userEvent } from "../test-utils";

describe("native local voucher pilot", () => {
  it("shows voucher and monetary delivery independently alongside explicit fictional full-access terms", () => {
    const state = servicePilotStorySnapshot(true);
    state.pilot!.reward!.gd!.state = "delivered";
    state.pilot!.reward!.voucher.state = "failed";
    renderWithProviders(
      <MemoryRouter>
        <VoucherPilotJourney snapshot={state} busy={false} onAction={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText(/One booked 60-minute session/)).toBeInTheDocument();
    expect(screen.getByText(/Voucher reward: Failed/)).toBeInTheDocument();
    expect(screen.getByText(/Monetary reward: Delivered/)).toBeInTheDocument();
    expect(screen.getByText(/Accepted rewards do not reserve inventory/)).toBeInTheDocument();
  });
  it("uses an already held correct voucher directly without suggesting a paid exchange", () => {
    const state = servicePilotStorySnapshot();
    state.pilot!.holdings.b = 1_000_000n;
    renderWithProviders(
      <MemoryRouter>
        <VoucherPilotJourney snapshot={state} busy={false} onAction={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText(/You have the required service voucher/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Service" })).toHaveAttribute("href", "/1023");
    expect(screen.queryByRole("button", { name: "Get Exchange Quote" })).not.toBeInTheDocument();
  });
  it("disables paid retry until an uncertain swap receipt is resolved", async () => {
    const state = servicePilotStorySnapshot(true);
    state.pilot!.exchange.status = "unknown";
    state.pilot!.exchange.receipt = {
      evidence: "local-rehearsal",
      observationId: "local-rehearsal:swap:fixture",
      pool: state.pilot!.exchange.pool,
      chainId: 100,
    };
    const onAction = vi.fn().mockResolvedValue(undefined);
    renderWithProviders(
      <MemoryRouter>
        <VoucherPilotJourney snapshot={state} busy={false} onAction={onAction} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: "Get Exchange Quote" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Resolve Exchange Receipt" }));
    expect(onAction).toHaveBeenCalledExactlyOnceWith({ action: "resolvePilotExchange" });
  });
  it("keeps all pilot actions unavailable on a production observation", () => {
    const state = servicePilotStorySnapshot(true);
    state.evidence = "onchain";
    state.capabilities.mutation = "unavailable";
    renderWithProviders(
      <MemoryRouter>
        <VoucherPilotJourney snapshot={state} busy={false} onAction={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
