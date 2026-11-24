import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useAwaitingJoinRequests } from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import type { Garden } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, screen, userEvent, within } from "storybook/test";
import { withInstalledPwa, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  AIYELOJA,
  activeGarden,
  ILHAS,
  memberGarden,
  STORY_ACCOUNT,
  TAS_HUB,
  VIDA_VERDE,
} from "../../../../../shared/.storybook/homeFixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { Explore } from "./index";

const LISTED: Garden[] = [VIDA_VERDE, ILHAS, TAS_HUB, AIYELOJA];

function exploreState({ listed = LISTED, isPending = false } = {}) {
  return () => {
    mocked(usePrimaryAddress).mockReturnValue(STORY_ACCOUNT);
    mocked(useActiveGarden).mockReturnValue(
      activeGarden(
        "ready",
        [memberGarden(TAS_HUB, ["steward"]), memberGarden(AIYELOJA, ["gardener"])],
        TAS_HUB.id
      )
    );
    mocked(useGardens).mockReturnValue({
      data: isPending ? undefined : listed,
      isPending,
      isLoading: isPending,
      isFetching: isPending,
      isError: false,
      refetch: () => Promise.resolve(),
    } as unknown as ReturnType<typeof useGardens>);
    mocked(useAwaitingJoinRequests).mockReturnValue(new Set([VIDA_VERDE.id.toLowerCase()]));
    return resetHookMocks(usePrimaryAddress, useActiveGarden, useGardens, useAwaitingJoinRequests);
  };
}

/**
 * Explore (DL-125, DL-126): every garden the app lists, under Home so the bottom bar stays on
 * Home, with the member's own first and one tag on each card's photo (Member, Waiting for approval or
 * Open), under a top bar with Back, the title and Filters. A card visits its garden and leaves
 * the active garden alone.
 */
const meta: Meta<typeof Explore> = {
  title: "Client/PWA/Explore",
  component: Explore,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withRouter(["/home/explore"]), withInstalledPwa()],
};

export default meta;
type Story = StoryObj<typeof Explore>;

/** The member's gardens first, then the rest newest first, each card with one tag at most. */
export const Gardens: Story = {
  beforeEach: exploreState(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("heading", { level: 1, name: "Explore Gardens" })
    ).toBeVisible();
    const cards = canvas.getAllByTestId("garden-card");
    await expect(cards.map((card) => card.querySelector("h3")?.textContent)).toEqual([
      "TAS HUB",
      "Aiyeloja Family Garden",
      "Vida Verde",
      "Ilhas de Abundância",
    ]);
    await expect(
      cards.map((card) => card.querySelector("[data-slot='media-label']")?.textContent ?? null)
    ).toEqual(["Member", "Member", "Waiting for approval", "Open"]);
    // Every card keeps one height, tag or none.
    await expect(new Set(cards.map((card) => card.getBoundingClientRect().height)).size).toBe(1);
    await userEvent.click(canvas.getByRole("button", { name: "Filters" }));
    await expect(await screen.findByRole("dialog", { name: "Filter Gardens" })).toBeVisible();
  },
};

/** The list holds its cards' frames while the gardens load. */
export const Loading: Story = {
  beforeEach: exploreState({ isPending: true }),
};
