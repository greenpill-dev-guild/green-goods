/** @vitest-environment happy-dom */

import type {
  PoolFundingControllerView,
  ProtocolFundingOperationsController,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { HexString } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtocolFundingOperationsCard } from "@/views/Community/components/ProtocolFundingOperationsCard";
import { ProtocolFundingOperationsPanel } from "@/views/Community/components/ProtocolFundingOperationsPanel";
import { storyPoolFunding } from "@/views/Garden/Pool/poolStoryControllers";
import { storyProtocolSafeFunding } from "@/views/Garden/Pool/poolStorySettlement";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const PROTOCOL = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const AIYELOJA = "0xf7b892886998dae960d64a9db488336684f137a0" as Address;
const RECIPIENT = "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37" as Address;
const G = 10n ** 18n;
const TX_HASH = `0x${"1".repeat(64)}` as HexString;
const TAS = "0xa2df8eb73444a3f3cf9b8e3749313c7471d7d5e3" as Address;
// Existing settlement cases explicitly exercise the future enabled lane.
const releaseScope = vi.hoisted(() => ({ settlementEnabled: true }));
vi.mock("@green-goods/shared/config/app", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/config/app")>()),
  get SETTLEMENT_ENABLED() {
    return releaseScope.settlementEnabled;
  },
}));
beforeEach(() => {
  releaseScope.settlementEnabled = true;
});

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  gardensRefetch: vi.fn(async () => undefined),
  gardens: [] as Array<{ id: Address; name: string }>,
  pools: [] as Array<{ garden: Address }>,
  operations: null as ProtocolFundingOperationsController | null,
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { success: mocks.toastSuccess, error: vi.fn() },
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: mocks.gardens, refetch: mocks.gardensRefetch }),
}));

vi.mock("@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling", () => ({
  useCommitmentPools: () => ({ pools: mocks.pools }),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/pool/useProtocolFundingOperationsController", () => ({
  useProtocolFundingOperationsController: () => mocks.operations,
}));

function controller(
  overrides: Partial<ProtocolFundingOperationsController> = {}
): ProtocolFundingOperationsController {
  return {
    chainId: 42161,
    viewer: PROTOCOL,
    protocolGarden: PROTOCOL,
    targetGarden: AIYELOJA,
    isOnline: true,
    canQueueFunding: true,
    canDispatchOrRetry: true,
    canRequeueOrCancel: true,
    authorityResolved: true,
    showOperations: true,
    sourceFunding: storyPoolFunding(),
    targetFunding: storyPoolFunding({
      snapshot: {
        ...storyPoolFunding().snapshot!,
        safe: RECIPIENT,
        routeAddresses: { account: RECIPIENT, indexed: RECIPIENT, live: RECIPIENT },
        balance: {
          ...storyPoolFunding().snapshot!.balance!,
          value: 1n * G,
        },
      },
    }),
    rows: [],
    lastAct: null,
    isActing: false,
    queueFunding: vi.fn(async (): Promise<HexString> => TX_HASH),
    dispatch: vi.fn(async (): Promise<HexString> => TX_HASH),
    retry: vi.fn(async (): Promise<HexString> => TX_HASH),
    requeue: vi.fn(async (): Promise<HexString> => TX_HASH),
    cancel: vi.fn(async (): Promise<HexString> => TX_HASH),
    refetch: vi.fn(async () => undefined),
    ...overrides,
  };
}

const gardens = [{ id: AIYELOJA, name: "Aiyeloja" }];

describe("ProtocolFundingOperationsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.operations = controller();
    mocks.gardens = [];
    mocks.pools = [];
  });

  it("uses registered pools for recipients while a persisted garden catalog catches up", async () => {
    mocks.gardens = [{ id: PROTOCOL, name: "Green Goods Community Garden" }];
    mocks.pools = [{ garden: PROTOCOL }, { garden: AIYELOJA }, { garden: TAS }];

    renderWithProviders(
      <ProtocolFundingOperationsPanel chainId={42161} protocolGarden={PROTOCOL} />
    );

    const select = screen.getByLabelText("Receiving garden");
    expect(within(select).getAllByRole("option")).toHaveLength(3);
    expect(within(select).getByRole("option", { name: "0xf7b8…37a0" })).toHaveValue(AIYELOJA);
    expect(within(select).getByRole("option", { name: "0xa2df…d5e3" })).toHaveValue(TAS);
    await waitFor(() => expect(mocks.gardensRefetch).toHaveBeenCalledTimes(1));
  });

  it("reviews and queues a 2 G$ protocol-to-garden transfer without commitment identity", async () => {
    const queueFunding = vi.fn(async (): Promise<HexString> => TX_HASH);
    renderWithProviders(
      <ProtocolFundingOperationsCard
        operations={controller({ queueFunding })}
        gardens={gardens}
        targetGarden={AIYELOJA}
        onTargetGardenChange={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue("Aiyeloja")).toBeInTheDocument();
    expect(
      screen.getByText("Protocol Safe").closest('[data-component="FactRow"]')
    ).toHaveTextContent("4,120 G$");
    expect(screen.getByText("0xa237…cc37")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review Seed or Top-Up…" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Queue 2 G\$.*Aiyeloja/)).toBeInTheDocument();
    // The review is in stewards' words: no enum names (A6).
    expect(dialog).not.toHaveTextContent(/ProtocolToGarden|no commitment ID/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Queue Seed or Top-Up" }));

    await waitFor(() => expect(queueFunding).toHaveBeenCalledWith(AIYELOJA, 2n * G));
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Transaction submitted" })
      )
    );
  });

  it("refuses a transfer over a known limit by name, at the review and at its confirm", async () => {
    const queueFunding = vi.fn(async (): Promise<HexString> => TX_HASH);
    const card = (sourceFunding: PoolFundingControllerView) => (
      <ProtocolFundingOperationsCard
        operations={controller({ queueFunding, sourceFunding })}
        gardens={gardens}
        targetGarden={AIYELOJA}
        onTargetGardenChange={vi.fn()}
      />
    );
    const { rerender } = renderWithProviders(card(storyProtocolSafeFunding()));
    const amount = screen.getByLabelText("Amount (G$)");
    const review = screen.getByRole("button", { name: "Review Seed or Top-Up…" });

    // A 7.2M seed is over the 7M cap alone: the field says so and the review stays shut.
    fireEvent.change(amount, { target: { value: "7200000" } });
    expect(screen.getByRole("alert")).toHaveTextContent("More than the per-transfer cap.");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(review).toBeDisabled();
    expect(
      screen.getByText("Period allowance remaining").closest('[data-component="FactRow"]')
    ).toHaveTextContent("15,000,000 G$");

    // A cap that could not be read holds the review too: Celo refuses only after the CCIP fee.
    rerender(card(storyProtocolSafeFunding({ cap: null })));
    expect(screen.getByText(/balance and limits haven't been read/)).toBeInTheDocument();
    expect(review).toBeDisabled();

    // Within every limit that was read, the review opens.
    rerender(card(storyProtocolSafeFunding()));
    fireEvent.change(amount, { target: { value: "6000000" } });
    expect(screen.queryByText(/balance and limits haven't been read/)).not.toBeInTheDocument();
    fireEvent.click(review);
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Queue 6,000,000 G\$.*Aiyeloja/)).toBeInTheDocument();

    // A refresh that leaves the Safe short while the review is open shuts its confirm too.
    rerender(card(storyProtocolSafeFunding({ balance: 5_000_000n * G })));
    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "More than the protocol Safe holds."
    );
    const confirm = within(dialog).getByRole("button", { name: "Queue Seed or Top-Up" });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(queueFunding).not.toHaveBeenCalled();
  });

  it("won't open the review until the receiving garden can take the transfer", () => {
    const snapshot = storyPoolFunding().snapshot!;
    const card = (targetFunding: PoolFundingControllerView) => (
      <ProtocolFundingOperationsCard
        operations={controller({ sourceFunding: storyProtocolSafeFunding(), targetFunding })}
        gardens={gardens}
        targetGarden={AIYELOJA}
        onTargetGardenChange={vi.fn()}
      />
    );
    const { rerender } = renderWithProviders(
      card(
        storyPoolFunding({
          snapshot: { ...snapshot, fundingUnavailableReasons: ["inactive_account"] },
        })
      )
    );
    const review = screen.getByRole("button", { name: "Review Seed or Top-Up…" });
    expect(review).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The receiving garden has no active settlement account."
    );

    // Not read yet, or a failed read: no message to give, and still no review.
    rerender(card(storyPoolFunding({ snapshot: null })));
    expect(review).toBeDisabled();
    rerender(card(storyPoolFunding({ isError: true })));
    expect(review).toBeDisabled();

    rerender(card(storyPoolFunding()));
    expect(review).toBeEnabled();
  });

  it("shuts the review while a Safe proposal is out, and says why a transfer is held", () => {
    renderWithProviders(
      <ProtocolFundingOperationsCard
        operations={controller({
          sourceFunding: storyProtocolSafeFunding(),
          lastAct: { kind: "queue-funding", phase: "proposed", hash: TX_HASH },
          rows: [
            {
              id: "42161-9",
              disbursementId: 9n,
              recipient: RECIPIENT,
              amount: 2n * G,
              state: "queued",
              executionKey: null,
              canDispatch: false,
              canRetry: false,
              canRequeue: false,
              canCancel: true,
              sendBlock: "balance",
            },
            {
              id: "42161-10",
              disbursementId: 10n,
              recipient: RECIPIENT,
              amount: 2n * G,
              state: "queued",
              executionKey: null,
              canDispatch: false,
              canRetry: false,
              canRequeue: false,
              canCancel: true,
              sendBlock: "limits_unread",
            },
          ],
        })}
        gardens={gardens}
        targetGarden={AIYELOJA}
        onTargetGardenChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("protocol-funding-status")).toHaveTextContent(/Sent to your Safe/);
    expect(screen.getByRole("button", { name: "Review Seed or Top-Up…" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Dispatch…" })).not.toBeInTheDocument();
    const held = screen.getAllByTestId("protocol-funding-send-block");
    expect(held[0]).toHaveTextContent("More than the protocol Safe holds.");
    expect(held[1]).toHaveTextContent("Can't be sent until the protocol Safe's limits are read.");
  });

  it("keeps deployer-only funding read-only", () => {
    renderWithProviders(
      <ProtocolFundingOperationsCard
        operations={controller({
          canQueueFunding: false,
          canDispatchOrRetry: false,
          canRequeueOrCancel: false,
          rows: [
            {
              id: "42161-9",
              disbursementId: 9n,
              recipient: RECIPIENT,
              amount: 2n * G,
              state: "queued",
              executionKey: null,
              canDispatch: false,
              canRetry: false,
              canRequeue: false,
              canCancel: false,
            },
          ],
        })}
        gardens={gardens}
        targetGarden={null}
        onTargetGardenChange={vi.fn()}
      />
    );

    expect(screen.getByTestId("protocol-funding-unavailable")).toBeInTheDocument();
    expect(screen.queryByLabelText("Receiving garden")).not.toBeInTheDocument();
    expect(screen.getByText(/^Transfer #9/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dispatch…" })).not.toBeInTheDocument();
  });

  it("names the receiving garden, and reviews a transfer before the wallet is asked", async () => {
    const dispatch = vi.fn(async (): Promise<HexString> => TX_HASH);
    renderWithProviders(
      <ProtocolFundingOperationsCard
        operations={controller({
          dispatch,
          rows: [
            {
              id: "42161-10",
              disbursementId: 10n,
              garden: AIYELOJA,
              recipient: RECIPIENT,
              amount: 2n * G,
              state: "queued",
              executionKey: null,
              canDispatch: true,
              canRetry: false,
              canRequeue: false,
              canCancel: false,
            },
          ],
        })}
        gardens={gardens}
        targetGarden={AIYELOJA}
        onTargetGardenChange={vi.fn()}
      />
    );

    const row = screen.getByText(/^2 G\$ to Aiyeloja$/).closest("li")!;
    expect(row).toHaveTextContent("Transfer #10");
    expect(row).not.toHaveTextContent(/ProtocolToGarden|no commitment ID/);
    // Only the acts the connected authority holds are offered.
    expect(within(row).queryByRole("button", { name: "Requeue…" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "Cancel…" })).not.toBeInTheDocument();

    fireEvent.click(within(row).getByRole("button", { name: "Dispatch…" }));
    const review = await screen.findByRole("alertdialog", { name: "Review Before Sending" });
    expect(review).toHaveTextContent(/Dispatch disbursement #10 for 2 G\$ to Aiyeloja/);
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.click(within(review).getByRole("button", { name: "Send Transaction" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(10n));
  });

  it("renders Celo execution separately from indexed confirmation", () => {
    renderWithProviders(
      <ProtocolFundingOperationsCard
        operations={controller({
          rows: [
            {
              id: "42161-11",
              disbursementId: 11n,
              recipient: RECIPIENT,
              amount: 2n * G,
              state: "acknowledgement-pending",
              executionKey: `0x${"1".repeat(64)}`,
              canDispatch: false,
              canRetry: false,
              canRequeue: false,
              canCancel: false,
            },
          ],
        })}
        gardens={gardens}
        targetGarden={AIYELOJA}
        onTargetGardenChange={vi.fn()}
      />
    );

    expect(screen.getByText("Acknowledgment pending")).toBeInTheDocument();
    expect(screen.queryByText("Confirmed")).not.toBeInTheDocument();
  });
});

describe("app-only release funding", () => {
  it("retains the supplied protocol workspace layout without funding controls", () => {
    releaseScope.settlementEnabled = false;
    const layout = vi.fn(() => <div>Protocol promises and review</div>);
    renderWithProviders(
      <ProtocolFundingOperationsPanel
        chainId={42161}
        protocolGarden={PROTOCOL}
        renderLayout={layout}
      />
    );
    expect(layout).toHaveBeenCalledWith(null, null);
    expect(screen.getByText("Protocol promises and review")).toBeInTheDocument();
  });
  it("does not mount the protocol funding controls while settlement is deferred", () => {
    releaseScope.settlementEnabled = false;
    const { container } = renderWithProviders(
      <ProtocolFundingOperationsPanel chainId={42161} protocolGarden={PROTOCOL} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
