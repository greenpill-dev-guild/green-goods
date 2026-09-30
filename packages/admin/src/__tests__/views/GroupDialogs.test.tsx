/**
 * @vitest-environment happy-dom
 */

/**
 * Seed More Like This and Add to This Group: which way the steward can go, and
 * what an Add sends. The send is Shared's `useAddToGroup`, proven with its own
 * test; here it is a stand-in that records the count and answers as scripted.
 */

import type { AddToGroupOutcome } from "@green-goods/shared/hooks/admin-ui/pool/useAddToGroup";
import { buildCommitmentMetadata } from "@green-goods/shared/modules/commitment-pooling/metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, renderWithProviders, screen, waitFor, within } from "../test-utils";

const GARDEN = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;
const STEWARD = "0x1111111111111111111111111111111111111111" as const;

type AddModule = typeof import("@green-goods/shared/hooks/admin-ui/pool/useAddToGroup");

const mocks = vi.hoisted(() => ({
  added: [] as number[],
  outcome: "sent" as AddToGroupOutcome,
}));

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

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [{ id: GARDEN, name: "Rocinha" }] }),
}));

const { AddToGroupDialog } = await import("@/views/Garden/Pool/Group/AddToGroupDialog");
const { SeedMoreDialog } = await import("@/views/Garden/Pool/Group/SeedMoreDialog");

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
