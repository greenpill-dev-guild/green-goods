import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { bookingStorySnapshot } from "../../../../shared/.storybook/voucherBookingFixtures";
import { ServicePromise } from "../../views/Home/Garden/Commitment/ServicePromise";
import { renderWithProviders, screen, userEvent } from "../test-utils";

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@green-goods/shared/commitment-pooling", async (original) => ({
  ...(await original<typeof import("@green-goods/shared/commitment-pooling")>()),
  useServiceAccessMutation: () => ({ isPending: false, mutateAsync: mocks.send }),
  useVoucherWallet: () => ({ data: undefined }),
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
  it("checks the existing read without submitting another transaction", async () => {
    const refetch = page();
    await userEvent.click(screen.getByRole("button", { name: "Check Status" }));
    expect(refetch).toHaveBeenCalledOnce();
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
