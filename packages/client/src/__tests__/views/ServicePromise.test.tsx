import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { bookingStorySnapshot } from "../../../../shared/.storybook/voucherBookingFixtures";
import { ServiceLiveExchange } from "../../views/Home/Garden/Commitment/ServiceLiveExchange";
import {
  issuerStoryAssets,
  issuerStorySnapshot,
} from "../../views/Profile/serviceIssuerStoryFixtures";
import { ServicePromise } from "../../views/Home/Garden/Commitment/ServicePromise";
import { renderWithProviders, screen, userEvent } from "../test-utils";

const mocks = vi.hoisted(() => ({ send: vi.fn(), issuer: vi.fn(), walletRefetch: vi.fn() }));
vi.mock("@green-goods/shared/commitment-pooling", async (original) => ({
  ...(await original<typeof import("@green-goods/shared/commitment-pooling")>()),
  useServiceIssuerOperations: (...args: unknown[]) => mocks.issuer(...args),
  useServiceAccessMutation: () => ({ isPending: false, mutateAsync: mocks.send }),
  useVoucherWallet: () => ({ data: undefined, isError: false, refetch: mocks.walletRefetch }),
  useVoucherIssuerApproval: () => ({ data: undefined }),
}));

function page(options: { online?: boolean; failed?: boolean; checking?: boolean } = {}) {
  const snapshot = bookingStorySnapshot("hubDay", "waitingApproval");
  snapshot.voucherSetups[0]!.destination!.result.phase = "none";
  snapshot.voucherSetups[0]!.source.authorizationMessageId = snapshot.voucherSetups[0]!.setupId;
  const refetch = vi.fn();
  renderWithProviders(
    <MemoryRouter>
      <ServicePromise
        serviceKey={snapshot.key}
        access={{ data: snapshot, refetch, isError: options.failed, isFetching: options.checking }}
        coreState="OFFERED"
        creator={null}
        gardenName="Test garden"
        heading="Hub day"
        hasCoreAct={false}
        isOnline={options.online ?? true}
        onReport={null}
        takeUp={null}
      >
        {({ body, bar }) => (
          <>
            {body}
            {bar}
          </>
        )}
      </ServicePromise>
    </MemoryRouter>
  );
  return refetch;
}

describe("checking a voucher promise's remote status", () => {
  it("checks the existing read, and the reader's vouchers, without submitting another transaction", async () => {
    const refetch = page();
    await userEvent.click(screen.getByRole("button", { name: "Check Status" }));
    expect(refetch).toHaveBeenCalledOnce();
    expect(mocks.walletRefetch).toHaveBeenCalledOnce();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("retains the booking and explains a failed refresh", () => {
    page({ failed: true });
    expect(screen.getByRole("status")).toHaveTextContent("Showing the last known result");
    expect(screen.getByRole("region", { name: "Service Access" })).toBeInTheDocument();
  });
  it("disables checking offline while retaining the last known booking", () => {
    page({ online: false });
    expect(screen.getByRole("button", { name: "Check Status" })).toBeDisabled();
    expect(screen.getByText(/You are offline. Showing the last known status/)).toBeInTheDocument();
  });
  it("provides a tracking link only inside transaction details, with checking feedback", () => {
    page({ checking: true });
    expect(screen.getByRole("button", { name: "Checking Status…" })).toBeDisabled();
    const link = screen.getByText("Track Request in CCIP Explorer");
    expect(link.closest("details")).not.toBeNull();
    expect(link).toHaveAttribute("href", expect.stringContaining("https://ccip.chain.link/msg/0x"));
  });
});

describe("live service exchange checkout", () => {
  it("requires selecting the exact pool before reading or preparing a holder exchange", async () => {
    const snapshot = issuerStorySnapshot();
    const review = vi.fn();
    mocks.issuer.mockReturnValue({
      snapshot: { data: snapshot, refetch: vi.fn() },
      review: { mutateAsync: review },
      quote: { mutateAsync: vi.fn() },
      execute: { mutateAsync: vi.fn() },
      reconcile: { mutateAsync: vi.fn() },
    });
    mocks.issuer.mockClear();
    renderWithProviders(
      <ServiceLiveExchange
        account={snapshot.actor.address}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
        choices={[
          {
            key: "local",
            routeId: "fictional-story",
            poolId: "fictional-local",
            poolName: "Local garden",
            input: issuerStoryAssets[0]!,
            output: issuerStoryAssets[1]!,
            held: 1_000_000n,
            requiredOutput: 2_000_000n,
          },
        ]}
      />
    );
    expect(mocks.issuer).not.toHaveBeenCalled();
    await userEvent.selectOptions(screen.getByLabelText("Exchange Pool"), "local");
    expect(mocks.issuer).toHaveBeenLastCalledWith({
      address: snapshot.actor.address,
      routeId: "fictional-story",
      assetId: issuerStoryAssets[0]!.id,
      poolId: "fictional-local",
    });
    expect(screen.getByText("Vouchers I Hold")).toBeInTheDocument();
    expect(screen.queryByText("Services I Offer")).not.toBeInTheDocument();
    expect(review).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
