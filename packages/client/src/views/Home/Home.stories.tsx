import { useCommitmentPools } from "@green-goods/shared/commitment-pooling";
import { getDefaultChain } from "@green-goods/shared/config/blockchain";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useArrivalState } from "@green-goods/shared/hooks/app/useArrivalState";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import {
  useActions,
  useGardeners,
  useGardens,
} from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useConvictionStrategies } from "@green-goods/shared/hooks/conviction/useConvictionStrategies";
import { useActiveGarden } from "@green-goods/shared/hooks/garden/useActiveGarden";
import { useAwaitingJoinRequests } from "@green-goods/shared/hooks/garden/useGardenJoinRequests";
import { useHasRole } from "@green-goods/shared/hooks/roles/useHasRole";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import { useVaultDeposits } from "@green-goods/shared/hooks/vault/useVaultDeposits";
import { useWorks } from "@green-goods/shared/hooks/work/useWorks";
import { useYourWorkCount } from "@green-goods/shared/hooks/work/useYourWorkCount";
import type { Garden } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, mocked, screen, userEvent, within } from "storybook/test";
import {
  withClientAppRuntime,
  withInstalledPwa,
  withRouter,
} from "../../../../shared/.storybook/decorators";
import {
  AIYELOJA,
  activeGarden,
  communityGarden,
  ILHAS,
  memberGarden,
  STORY_ACCOUNT,
  TAS_HUB,
  VIDA_VERDE,
} from "../../../../shared/.storybook/homeFixtures";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { chooserScope, markChooserOffered } from "./chooserOffer";
import Home from "./index";

const ROOT_GARDEN =
  getDefaultChain().rootGarden?.address ?? "0x6000000000000000000000000000000000000009";
const COMMUNITY = communityGarden(ROOT_GARDEN);
const LISTED: Garden[] = [TAS_HUB, AIYELOJA, VIDA_VERDE, ILHAS, COMMUNITY];
const SEVERAL = [memberGarden(TAS_HUB, ["steward"]), memberGarden(AIYELOJA, ["gardener"])];
const CHOOSER_OFFER_PREFIX = "greengoods:garden-chooser-offered:";

/**
 * The hooks Home reads, set for one story: the account's active garden and gardens, the
 * gardens the app lists, the requests awaiting review, and the reads the garden's page makes
 * inside the journal. Returns the cleanup that gives later stories the real hooks back.
 */
function homeState(
  active: ReturnType<typeof activeGarden>,
  { awaiting = [] as Garden[], chooserOffered = false } = {}
) {
  return () => {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(CHOOSER_OFFER_PREFIX)) sessionStorage.removeItem(key);
    }
    const scope = chooserScope(DEFAULT_CHAIN_ID, STORY_ACCOUNT);
    if (chooserOffered && scope) markChooserOffered(scope);
    mocked(useActiveGarden).mockReturnValue(active);
    mocked(usePrimaryAddress).mockReturnValue(STORY_ACCOUNT);
    mocked(useUser).mockReturnValue({ primaryAddress: STORY_ACCOUNT } as ReturnType<
      typeof useUser
    >);
    mocked(useArrivalState).mockReturnValue({
      kind: "none",
      myGardenIds: [],
      needsReviewCount: 0,
    } as ReturnType<typeof useArrivalState>);
    mocked(useGardens).mockReturnValue({
      data: LISTED,
      isPending: false,
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: () => Promise.resolve(),
    } as unknown as ReturnType<typeof useGardens>);
    mocked(useGardeners).mockReturnValue({ data: [] } as unknown as ReturnType<
      typeof useGardeners
    >);
    mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
    mocked(useAwaitingJoinRequests).mockReturnValue(
      new Set(awaiting.map(({ id }) => id.toLowerCase()))
    );
    mocked(useYourWorkCount).mockReturnValue({ count: 0 } as ReturnType<typeof useYourWorkCount>);
    mocked(useWorks).mockReturnValue({
      works: [],
      isFetching: false,
      isLoading: false,
      isError: false,
      isPaused: false,
      refetch: () => undefined,
    } as unknown as ReturnType<typeof useWorks>);
    mocked(useCommitmentPools).mockReturnValue({
      pools: [],
      availability: { status: "unknown-chain" },
    } as unknown as ReturnType<typeof useCommitmentPools>);
    mocked(useConvictionStrategies).mockReturnValue({
      strategies: [],
    } as unknown as ReturnType<typeof useConvictionStrategies>);
    mocked(useGardenVaults).mockReturnValue({ vaults: [] } as unknown as ReturnType<
      typeof useGardenVaults
    >);
    mocked(useVaultDeposits).mockReturnValue({ deposits: [] } as unknown as ReturnType<
      typeof useVaultDeposits
    >);
    mocked(useHasRole).mockReturnValue({ hasRole: false } as ReturnType<typeof useHasRole>);
    return resetHookMocks(
      useActiveGarden,
      usePrimaryAddress,
      useUser,
      useArrivalState,
      useGardens,
      useGardeners,
      useActions,
      useAwaitingJoinRequests,
      useYourWorkCount,
      useWorks,
      useCommitmentPools,
      useConvictionStrategies,
      useGardenVaults,
      useVaultDeposits,
      useHasRole
    );
  };
}

/**
 * Home in the member's active garden (DL-123, DL-124): the shared garden chip in the title's
 * place, then Wallet, Promises and Your Work, in a header that stays at the top. The body
 * follows the active garden's five states: a remembered garden goes straight in while the
 * account's gardens load, a failed read says nothing was lost, no garden finds one, several
 * with none remembered offer the chooser once, and a chosen garden opens its journal.
 */
const meta: Meta<typeof Home> = {
  title: "Client/PWA/Home",
  component: Home,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withRouter(["/home"]), withInstalledPwa(), withClientAppRuntime],
};

export default meta;
type Story = StoryObj<typeof Home>;

/** A chosen garden: the chip names it, and the journal shows the garden's page until it lands. */
export const Ready: Story = {
  beforeEach: homeState(activeGarden("ready", SEVERAL, TAS_HUB.id), { awaiting: [VIDA_VERDE] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const chip = await canvas.findByRole("button", { name: /TAS HUB/ });
    const header = chip.closest<HTMLElement>("[data-component='HomeHeader']");
    await expect(header).not.toBeNull();
    await expect(getComputedStyle(header as HTMLElement).position).toBe("sticky");
    await expect(chip.getBoundingClientRect().height).toBeCloseTo(32, 0);
    await expect(canvas.queryByRole("button", { name: "Filters" })).toBeNull();
    await userEvent.click(chip);
    const switcher = within(await screen.findByRole("dialog", { name: "Your Gardens" }));
    await expect(switcher.getByRole("button", { name: /Vida Verde/ })).toHaveTextContent(
      "Awaiting review"
    );
  },
};

/** One garden: it opened by itself, and the chip still opens the switcher. */
export const OneGarden: Story = {
  beforeEach: homeState(activeGarden("ready", [memberGarden(AIYELOJA, ["gardener"])], AIYELOJA.id)),
};

/** The account's gardens are loading; the remembered garden goes straight in. */
export const LoadingRememberedGarden: Story = {
  beforeEach: homeState(activeGarden("loading", [], TAS_HUB.id)),
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole("status")).toHaveTextContent(
      "Loading garden..."
    );
  },
};

/** The read failed with nothing remembered: the state block, nothing lost, Try Again. */
export const ReadFailed: Story = {
  beforeEach: homeState(activeGarden("error")),
  play: async ({ canvasElement }) => {
    const alert = await within(canvasElement).findByRole("alert");
    await expect(alert).toHaveTextContent("Nothing was lost");
    await expect(within(alert).getByRole("button", { name: "Try Again" })).toBeVisible();
  },
};

/** No garden yet: Explore, the requests awaiting review and the Community Garden's open door. */
export const NoGardenYet: Story = {
  beforeEach: homeState(activeGarden("none"), { awaiting: [VIDA_VERDE] }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { level: 1, name: "Home" })).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Find Your Garden" })).toBeVisible();
    await expect(canvas.getByRole("region", { name: "Your Requests" })).toHaveTextContent(
      "Vida Verde"
    );
    await expect(
      canvas.getByRole("region", { name: "Join the Community Garden" })
    ).toHaveTextContent("Green Goods Community Garden");
  },
};

/** Several gardens and none remembered: the switcher opens once as Choose a Garden. */
export const ChooseOnFirstRun: Story = {
  beforeEach: homeState(activeGarden("choose", SEVERAL)),
  play: async () => {
    const chooser = within(await screen.findByRole("dialog", { name: "Choose a Garden" }));
    await expect(chooser.getByRole("button", { name: /Aiyeloja Family Garden/ })).toBeVisible();
  },
};

/** The chooser was dismissed: a quiet prompt stays, and only a pick writes. */
export const ChoosePrompt: Story = {
  beforeEach: homeState(activeGarden("choose", SEVERAL), { chooserOffered: true }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("button", { name: "See Your Gardens" })).toBeVisible();
    await expect(screen.queryByRole("dialog")).toBeNull();
  },
};
