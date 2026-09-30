/** @vitest-environment happy-dom */

/**
 * The group inspector: one row per person who took a copy, with the facts the
 * pool's activity gives; one row for the copies nobody has taken; filters by
 * count; and Edit Reward beside Seed More Like This only while it is open.
 */

import { groupCommitmentsForDisplay } from "@green-goods/shared/modules/commitment-pooling/display-groups";
import { describe, expect, it, vi } from "vitest";
import type { PoolCommitmentGroup } from "@/views/Garden/Pool/poolCommitmentRows";
import {
  STORY_GROUP_COPIES,
  STORY_GROUP_EVENTS,
  STORY_GROUP_TITLES,
} from "@/views/Garden/Pool/poolStoryGroups";
import { GroupInspector } from "@/views/Garden/Pool/Group/GroupInspector";
import { fireEvent, renderWithProviders, screen, within } from "../test-utils";

// The inspector proves what it lists; names resolve under their own tests.
vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));
vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: () => ({ data: [] }),
}));

const [GROUP] = groupCommitmentsForDisplay({
  commitments: STORY_GROUP_COPIES,
  metadataByCID: STORY_GROUP_TITLES,
}) as [PoolCommitmentGroup];

function inspector(overrides: { canEditReward?: boolean } = {}) {
  const handlers = {
    onClose: vi.fn(),
    onOpenCommitment: vi.fn(),
    onSeedMore: vi.fn(),
    onEditReward: vi.fn(),
  };
  renderWithProviders(
    <GroupInspector
      open
      group={GROUP}
      title="Household water survey"
      cycleName="Season of First Rains"
      chainId={42161}
      terms={[["Asks for", "1 survey · The pool requests"]]}
      rewarded
      canEditReward={overrides.canEditReward ?? false}
      events={STORY_GROUP_EVENTS}
      {...handlers}
    />
  );
  return handlers;
}

const people = () => within(screen.getByTestId("group-people")).getAllByRole("listitem");

describe("GroupInspector", () => {
  it("leads each taken copy with its person and its facts, and folds the rest into one row", () => {
    inspector();
    const rows = people();
    // Six taken, most in need of attention first, then the four nobody has taken.
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveTextContent(/Proof .* · Not confirmed yet · Reward not paid yet/);
    expect(rows[6]).toHaveTextContent("4 not taken up yet");
    // Each of the three took two: the later of each says so.
    expect(screen.getAllByText(/2nd from this group/)).toHaveLength(3);
    expect(screen.getAllByText(/Reward paid/)).toHaveLength(1);
  });

  it("filters by count, offering only the counts that have copies", () => {
    inspector();
    const filters = screen.getByRole("group", { name: "Which promises to show" });
    expect(
      within(filters)
        .getAllByRole("button")
        .map((chip) => chip.textContent)
    ).toEqual(["All (10)", "Available (4)", "In progress (3)", "Kept (2)", "Ended (1)"]);
    fireEvent.click(within(filters).getByRole("button", { name: "Kept (2)" }));
    expect(people()).toHaveLength(2);
    fireEvent.click(within(filters).getByRole("button", { name: "Available (4)" }));
    expect(people().map((row) => row.textContent)).toEqual([
      expect.stringContaining("4 not taken up yet"),
    ]);
  });

  it("opens a copy's own inspector from its row, and an available copy from the not-taken row", () => {
    const { onOpenCommitment } = inspector();
    fireEvent.click(within(people()[6]!).getByRole("button"));
    expect(onOpenCommitment).toHaveBeenCalledWith(STORY_GROUP_COPIES[0]);
    fireEvent.click(within(people()[0]!).getByRole("button"));
    expect(onOpenCommitment).toHaveBeenLastCalledWith(STORY_GROUP_COPIES[4]);
  });

  it("leaves Edit Reward out once a copy is kept, with Seed More Like This still there", () => {
    const { onSeedMore } = inspector();
    expect(screen.queryByRole("button", { name: "Edit Reward" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /seed more like this/i }));
    expect(onSeedMore).toHaveBeenCalled();
  });

  it("offers Edit Reward while it is open, and says until when", () => {
    const { onEditReward } = inspector({ canEditReward: true });
    fireEvent.click(screen.getByRole("button", { name: "Edit Reward" }));
    expect(onEditReward).toHaveBeenCalled();
    expect(screen.getByText("Edit Reward is open until one of this group is kept.")).toBeVisible();
  });
});
