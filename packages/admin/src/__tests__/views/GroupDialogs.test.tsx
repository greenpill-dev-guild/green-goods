/**
 * @vitest-environment happy-dom
 */

/**
 * The group inspector's dialogs. Edit Reward: what the steward's dollars
 * become, and what a Try Again sends. Seed More Like This and Add to This
 * Group: which way the steward can go, and what an Add sends. The sends are
 * Shared's `useEditReward` (proven with the wallet in `commitment-reward-edit`)
 * and `useAddToGroup` (in `commitment-group-additions`); here they are
 * stand-ins that record what they were asked and answer as scripted.
 */

import type { AddToGroupOutcome } from "@green-goods/shared/hooks/admin-ui/pool/useAddToGroup";
import type { RewardEditProgress } from "@green-goods/shared/hooks/admin-ui/pool/useEditReward";
import { buildCommitmentMetadata } from "@green-goods/shared/modules/commitment-pooling/metadata";
import type { GoodDollarPriceState } from "@green-goods/shared/modules/wallet/good-dollar-price";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addToGroupRefusal } from "@/views/Garden/Pool/Group/addToGroupStatus";
import { createIntl } from "react-intl";
import { editRewardSummary } from "@/views/Garden/Pool/Group/editRewardStatus";
import { editRewardStatus } from "@/views/Garden/Pool/Group/editRewardStatus";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const STEWARD = "0x1111111111111111111111111111111111111111" as const;
/** The rate shown while the steward types, and the fresher one read at the change. */
const SHOWN_PRICE = 128_647_930_734_508n;
const CHANGE_PRICE = 100_000_000_000_000n;

type EditRewardModule = typeof import("@green-goods/shared/hooks/admin-ui/pool/useEditReward");
type AddModule = typeof import("@green-goods/shared/hooks/admin-ui/pool/useAddToGroup");

const mocks = vi.hoisted(() => ({
  price: { status: "ready", price: 0n, readAt: 0 } as GoodDollarPriceState,
  readNow: vi.fn(),
  changes: [] as Array<{ ids: bigint[]; amount: bigint }>,
  /** Which copies the wallet leaves unchanged on the next change. */
  unchanged: new Set<bigint>(),
  added: [] as number[],
  outcome: "sent" as AddToGroupOutcome,
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

vi.mock("@green-goods/shared/hooks/admin-ui/pool/useAddToGroup", async () => {
  const react = await import("react");
  const useAddToGroup: AddModule["useAddToGroup"] = () => ({
    mode: "bundle",
    isSending: false,
    copies: null,
    pass: null,
    retryCount: 0,
    locked: false,
    reset: react.useCallback(() => undefined, []),
    add: async (count) => {
      mocks.added.push(count);
      return mocks.outcome;
    },
  });
  return { useAddToGroup };
});

vi.mock("@green-goods/shared/hooks/blockchain/useGoodDollarPrice", () => ({
  useGoodDollarPrice: () => ({ state: mocks.price, readNow: mocks.readNow }),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [{ id: GARDEN, name: "Rocinha" }] }),
}));

const { EditRewardDialog } = await import("@/views/Garden/Pool/Group/EditRewardDialog");
const { AddToGroupDialog } = await import("@/views/Garden/Pool/Group/AddToGroupDialog");
const { SeedMoreDialog } = await import("@/views/Garden/Pool/Group/SeedMoreDialog");

function renderDialog(
  props: {
    settlementActive?: boolean;
    availableRewards?: readonly { wei: bigint | null; centsAsSet: bigint | null }[];
  } = {}
) {
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
      availableRewards={
        props.availableRewards ??
        Array.from({ length: 4 }, () => ({
          wei: 23_319_457_863_579_084_743_441n,
          centsAsSet: 300n,
        }))
      }
      takenBy={["Joon Park", "Sofia Mendes"]}
      takenRewards={[
        { wei: 23_319_457_863_579_084_743_441n, centsAsSet: 300n },
        { wei: 23_319_457_863_579_084_743_441n, centsAsSet: 300n },
      ]}
      currentWei={23_319_457_863_579_084_743_441n}
      currentCentsAsSet={300n}
      settlementActive={props.settlementActive ?? true}
    />
  );
  return { onChanged };
}

function renderAdd() {
  const onAdded = vi.fn();
  renderWithProviders(
    <AddToGroupDialog
      open
      onClose={vi.fn()}
      onBack={vi.fn()}
      onAdded={onAdded}
      chainId={42161}
      garden={GARDEN}
      isProtocol={false}
      owner={STEWARD}
      title="Household water survey"
      group={{
        displayGroupId: "group-00000001",
        dueDate: 1_792_000_000n,
        templateCommitmentId: 21n,
        metadata: buildCommitmentMetadata({
          title: "Household water survey",
          displayGroup: { version: 1, id: "group-00000001" },
        }),
        gardenAddress: GARDEN,
      }}
      counts={{ published: 10, available: 4, inProgress: 3, kept: 2, ended: 1 }}
      terms={[["Each asks for", "1 survey · The pool requests"]]}
      rewardCents={500n}
    />
  );
  return { onAdded };
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
      "Joon Park and Sofia Mendes keep the rewards agreed at take-up."
    );
    // It starts at the reward as set, which would change nothing.
    expect(within(dialog()).getByRole("button", { name: "Change 4 Rewards" })).toBeDisabled();
    expect(screen.getByTestId("reward-prompt-count")).toHaveTextContent(/type the new amount/i);
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

describe("reward totals after earlier edits", () => {
  it("sums mixed untaken child amounts in the real dialog after a partial earlier edit", () => {
    mocks.price = { status: "ready", price: SHOWN_PRICE, readAt: Date.now() };
    renderDialog({
      availableRewards: [
        { wei: 23_319_457_863_579_084_743_441n, centsAsSet: 300n },
        { wei: 23_319_457_863_579_084_743_441n, centsAsSet: 300n },
        { wei: 38_865_763_105_965_141_239_068n, centsAsSet: 500n },
        { wei: 38_865_763_105_965_141_239_068n, centsAsSet: 500n },
      ],
    });
    expect(screen.getByTestId("edit-reward")).toHaveTextContent("2 × $3.00 · 2 × $5.00");
    expect(screen.getByTestId("edit-reward")).toHaveTextContent("up to $22.00");
    expect(within(dialog()).getByRole("button", { name: "Change 4 Rewards" })).toBeEnabled();
    fireEvent.change(within(dialog()).getByLabelText(/^amount for each/i), {
      target: { value: "7.00" },
    });
    expect(screen.getByTestId("edit-reward")).toHaveTextContent("up to $22.00 → up to $34.00");
  });
  it("shows an unknown available before-total honestly in the real dialog", () => {
    mocks.price = { status: "ready", price: SHOWN_PRICE, readAt: Date.now() };
    renderDialog({
      availableRewards: [
        { wei: 23_319_457_863_579_084_743_441n, centsAsSet: 300n },
        { wei: 23_319_457_863_579_084_743_441n, centsAsSet: 300n },
        { wei: 38_865_763_105_965_141_239_068n, centsAsSet: 500n },
        { wei: null, centsAsSet: null },
      ],
    });
    expect(screen.getByTestId("edit-reward")).toHaveTextContent("2 × $3.00 · 1 × $5.00 · 1 × —");
    fireEvent.change(within(dialog()).getByLabelText(/^amount for each/i), {
      target: { value: "7.00" },
    });
    expect(screen.getByTestId("edit-reward")).toHaveTextContent("— → up to $34.00");
  });
  const intl = createIntl({ locale: "en", messages: {} });
  const rows = (
    taken: Array<{ current: string; readCents: bigint | null; estimated: boolean }>,
    available: Array<{
      current: string;
      readCents: bigint | null;
      estimated: boolean;
    }> = Array.from({ length: 4 }, () => ({ current: "$5.00", readCents: 500n, estimated: false }))
  ) =>
    editRewardSummary({
      available,
      taken,
      newCents: 700n,
      formatUsd: (cents) => `$${Number(cents) / 100}.00`,
      formatMessage: intl.formatMessage,
    });
  it("preserves three $3 agreements while four available rewards move from $5 to $7", () => {
    const summary = rows(
      Array.from({ length: 3 }, () => ({ current: "$3.00", readCents: 300n, estimated: false }))
    );
    expect(summary[1]?.[1]).toBe("3 × $3.00 · unchanged, as agreed");
    expect(summary[2]?.[1]).toBe("up to $29.00 → up to $37.00");
  });
  it("sums distinct taken agreements, labels estimates and refuses unknown totals", () => {
    const agreements = [
      { current: "$3.00", readCents: 300n, estimated: false },
      { current: "about $5.00", readCents: 500n, estimated: true },
    ];
    expect(rows(agreements)[1]?.[1]).toBe("1 × $3.00 · 1 × about $5.00 · unchanged, as agreed");
    expect(rows(agreements)[2]?.[1]).toBe("up to about $28.00 → up to about $36.00");
    expect(rows([{ current: "10 G$", readCents: null, estimated: true }])[2]?.[1]).toBe("— → —");
  });
  it("refuses an unknown available before-total while computing only a known replacement total", () => {
    const summary = rows(
      [],
      [
        { current: "$5.00", readCents: 500n, estimated: false },
        { current: "—", readCents: null, estimated: true },
      ]
    );
    expect(summary.at(-1)?.[1]).toBe("— → up to $14.00");
  });
});

describe("Add to This Group", () => {
  beforeEach(() => {
    mocks.added = [];
    mocks.outcome = "sent";
  });

  it("adds the chosen number, compares the group before and after, and closes back", async () => {
    const { onAdded } = renderAdd();
    fireEvent.click(within(dialog()).getByRole("button", { name: "5" }));

    const added = screen.getByTestId("add-to-group");
    expect(added).toHaveTextContent("Adds 5 promises to this group");
    expect(added).toHaveTextContent("10 → 15");
    expect(added).toHaveTextContent("up to $50.00 → up to $75.00");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Add 5 Promises" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith(5));
    expect(mocks.added).toEqual([5]);
  });

  it("says why nothing can join once the deadline has passed", async () => {
    mocks.outcome = "expired";
    const { onAdded } = renderAdd();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Add Promise" }));

    await waitFor(() =>
      expect(screen.getByTestId("add-prompt-count")).toHaveTextContent(/deadline has passed/i)
    );
    expect(onAdded).not.toHaveBeenCalled();
  });
});

describe("Seed More Like This", () => {
  it("closes adding past the deadline, in a pool or cycle not taking promises, and to others", () => {
    const CREATOR = "0x1111111111111111111111111111111111111111" as const;
    const now = 1_790_000_000_000;
    const first = { creator: CREATOR, cycleId: 4n, dueDate: BigInt(now / 1000 + 86_400) };
    const open = {
      first,
      poolState: "OPEN" as const,
      cycle: { state: "OPEN" as const },
      viewer: CREATOR,
      now,
    };

    expect(addToGroupRefusal(open)).toBeNull();
    expect(addToGroupRefusal({ ...open, now: now + 2 * 86_400_000 })).toBe("expired");
    // The chain creates into an open pool and an open cycle only.
    expect(addToGroupRefusal({ ...open, poolState: "PAUSED" })).toBe("closed");
    expect(addToGroupRefusal({ ...open, cycle: { state: "RECONCILED" } })).toBe("closed");
    expect(addToGroupRefusal({ ...open, cycle: undefined })).toBe("closed");
    // A group in no cycle needs only the pool open.
    expect(
      addToGroupRefusal({ ...open, first: { ...first, cycleId: null }, cycle: undefined })
    ).toBeNull();
    expect(
      addToGroupRefusal({ ...open, viewer: "0x2222222222222222222222222222222222222222" })
    ).toBe("not-creator");
  });

  it("leaves only a new group once adding is closed, and says why", () => {
    const onContinue = vi.fn();
    renderWithProviders(
      <SeedMoreDialog
        open
        onClose={vi.fn()}
        onContinue={onContinue}
        title="Household water survey"
        due="Mon, Oct 12, 2026, 3:42 PM PDT"
        addRefusal="expired"
      />
    );

    expect(within(dialog()).getByRole("radio", { name: /^add to this group/i })).toBeDisabled();
    expect(dialog()).toHaveTextContent(/deadline has passed/i);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledWith("new");
  });
});
