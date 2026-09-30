/**
 * @vitest-environment happy-dom
 */

/**
 * Edit Reward, the dialog: what the steward's dollars become, and what a Try
 * Again sends. The send itself is Shared's `useEditReward`, proven with the
 * wallet in `commitment-reward-edit`; here it is a stand-in that records what it
 * was asked to change.
 */

import type { RewardEditProgress } from "@green-goods/shared/hooks/admin-ui/pool/useEditReward";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { editRewardStatus } from "@/views/Garden/Pool/Group/editRewardStatus";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
/** The rate shown while the steward types, and the fresher one read at the change. */
const SHOWN_PRICE = 128_647_930_734_508n;
const CHANGE_PRICE = 100_000_000_000_000n;

type EditRewardModule = typeof import("@green-goods/shared/hooks/admin-ui/pool/useEditReward");

const mocks = vi.hoisted(() => ({
  price: { status: "ready", price: 0n, readAt: 0 } as GoodDollarPriceState,
  readNow: vi.fn(),
  changes: [] as Array<{ ids: bigint[]; amount: bigint }>,
  /** Which copies the wallet leaves unchanged on the next change. */
  unchanged: new Set<bigint>(),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/pool/useEditReward", async () => {
  const react = await import("react");
  const useEditReward: EditRewardModule["useEditReward"] = () => {
    const [copies, setCopies] = react.useState<RewardEditProgress[] | null>(null);
    return {
      mode: "bundle",
      isSending: false,
      copies,
      reset: react.useCallback(() => setCopies(null), []),
      change: async (ids, amount) => {
        mocks.changes.push({ ids: [...ids], amount });
        const ended = ids.map((commitmentId) =>
          mocks.unchanged.has(commitmentId)
            ? ({ commitmentId, status: "not-changed", miss: "failed", txHash: null } as const)
            : ({ commitmentId, status: "changed", txHash: null } as const)
        );
        mocks.unchanged.clear();
        setCopies(ended);
        return ended.some((copy) => copy.status !== "changed") ? "left" : "changed";
      },
    };
  };
  return { useEditReward };
});

vi.mock("@green-goods/shared/hooks/blockchain/useGoodDollarPrice", () => ({
  useGoodDollarPrice: () => ({ state: mocks.price, readNow: mocks.readNow }),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [{ id: GARDEN, name: "Rocinha" }] }),
}));

const { EditRewardDialog } = await import("@/views/Garden/Pool/Group/EditRewardDialog");

function renderDialog(props: { settlementActive?: boolean } = {}) {
  const onChanged = vi.fn();
  renderWithProviders(
    <EditRewardDialog
      open
      onClose={vi.fn()}
      onChanged={onChanged}
      chainId={42161}
      garden={GARDEN}
      isProtocol={false}
      title="Compost bin check-ins"
      available={[3n, 4n, 5n, 6n]}
      takenBy={["Joon Park", "Sofia Mendes"]}
      currentWei={23_319_457_863_579_084_743_441n}
      currentCentsAsSet={300n}
      settlementActive={props.settlementActive ?? true}
    />
  );
  return { onChanged };
}

const dialog = () => screen.getByRole("dialog");

describe("Edit Reward", () => {
  beforeEach(() => {
    mocks.price = { status: "ready", price: SHOWN_PRICE, readAt: Date.now() };
    mocks.readNow.mockReset().mockResolvedValue({ price: CHANGE_PRICE, readAt: Date.now() });
    mocks.changes = [];
    mocks.unchanged.clear();
  });

  it("gives every copy nobody has taken the new dollars in G$ at the price read for the change", async () => {
    const { onChanged } = renderDialog();
    expect(screen.getByTestId("edit-reward")).toHaveTextContent(
      "Joon Park and Sofia Mendes took theirs at $3.00 and keep it."
    );
    fireEvent.change(within(dialog()).getByLabelText(/^amount for each/i), {
      target: { value: "4.00" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Change 4 Rewards" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(4));
    expect(mocks.readNow).toHaveBeenCalledTimes(1);
    expect(mocks.changes).toEqual([
      { ids: [3n, 4n, 5n, 6n], amount: (400n * 10n ** 34n) / CHANGE_PRICE },
    ]);
  });

  it("sends a Try Again to the ones that didn't change, at the same G$ amount", async () => {
    mocks.unchanged = new Set([5n, 6n]);
    const { onChanged } = renderDialog();
    fireEvent.change(within(dialog()).getByLabelText(/^amount for each/i), {
      target: { value: "4.00" },
    });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Change 4 Rewards" }));
    await waitFor(() =>
      expect(within(dialog()).getByRole("button", { name: "Try Again (2)" })).toBeEnabled()
    );
    // The price moved; a copy changed already carries the first amount.
    mocks.readNow.mockResolvedValue({ price: SHOWN_PRICE, readAt: Date.now() });
    fireEvent.click(within(dialog()).getByRole("button", { name: "Try Again (2)" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(mocks.changes[1]).toEqual({ ids: [5n, 6n], amount: mocks.changes[0]!.amount });
  });

  it("holds the change, and says why, while the settlement account isn't active", () => {
    renderDialog({ settlementActive: false });
    expect(within(dialog()).getByRole("button", { name: "Change 4 Rewards" })).toBeDisabled();
    expect(screen.getByTestId("reward-prompt-count")).toHaveTextContent(/settlement account/i);
  });
});

describe("Edit Reward's summary", () => {
  const copy = (commitmentId: bigint, status: RewardEditProgress["status"], miss?: string) =>
    ({ commitmentId, status, ...(miss ? { miss } : {}), txHash: null }) as RewardEditProgress;
  const view = (copies: RewardEditProgress[]) =>
    editRewardStatus({
      mode: "bundle",
      isSending: false,
      copies,
      available: copies.length,
      takenBy: [],
      current: "$3.00",
      formatMessage: ({ defaultMessage }) => defaultMessage,
      formatList: (items) => items.join(", "),
    });

  it.each([
    ["declined", [copy(3n, "not-changed", "declined")], "declined", [3n]],
    ["refused", [copy(3n, "not-changed", "refused")], "refused", [3n]],
    ["lost", [copy(3n, "not-changed", "failed")], "unconfirmed", [3n]],
    ["partial", [copy(3n, "changed"), copy(4n, "not-changed", "declined")], "partial", [4n]],
    ["changed", [copy(3n, "changed")], "changed", []],
  ] as const)("reads a %s change, with what Try Again would send", (_, copies, phase, retry) => {
    expect(view([...copies])).toMatchObject({ phase, retry });
  });
});
