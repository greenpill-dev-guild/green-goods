/** @vitest-environment jsdom */

import type { ProtocolFundingOperationsController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { HexString } from "@green-goods/shared/modules/commitment-pooling/types-core";
import type { Address } from "@green-goods/shared/types/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtocolFundingOperationsCard } from "@/views/Community/components/ProtocolFundingOperationsCard";
import { ProtocolFundingOperationsPanel } from "@/views/Community/components/ProtocolFundingOperationsPanel";
import { storyPoolFunding } from "@/views/Garden/Pool/poolStoryControllers";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const PROTOCOL = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const AIYELOJA = "0xf7b892886998dae960d64a9db488336684f137a0" as Address;
const RECIPIENT = "0xa23716f7b0dbbb0387fb1274f1ae8247670dcc37" as Address;
const G = 10n ** 18n;
const TX_HASH = `0x${"1".repeat(64)}` as HexString;
const TAS = "0xa2df8eb73444a3f3cf9b8e3749313c7471d7d5e3" as Address;
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
    expect(screen.getByText("Protocol Safe").parentElement).toHaveTextContent("4,120 G$");
    expect(screen.getByText("0xa237…cc37")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review seed or top-up…" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/Queue 2 G\$.*Aiyeloja/)).toBeInTheDocument();
    expect(within(dialog).getByText(/no commitment ID/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Queue seed or top-up" }));

    await waitFor(() => expect(queueFunding).toHaveBeenCalledWith(AIYELOJA, 2n * G));
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Transaction submitted" })
      )
    );
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
    expect(screen.getByText(/Funding \/ ProtocolToGarden/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Dispatch" })).not.toBeInTheDocument();
  });

  it("exposes only the row actions selected for the connected authority", async () => {
    const dispatch = vi.fn(async (): Promise<HexString> => TX_HASH);
    renderWithProviders(
      <ProtocolFundingOperationsCard
        operations={controller({
          dispatch,
          rows: [
            {
              id: "42161-10",
              disbursementId: 10n,
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

    fireEvent.click(screen.getByRole("button", { name: "Dispatch" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(10n));
    expect(screen.queryByRole("button", { name: "Requeue" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel…" })).not.toBeInTheDocument();
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
