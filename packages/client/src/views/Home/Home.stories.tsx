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
import { useGardenNotifications } from "@green-goods/shared/hooks/garden/useGardenNotifications";
import { useHasRole } from "@green-goods/shared/hooks/roles/useHasRole";
import { useGardenVaults } from "@green-goods/shared/hooks/vault/useGardenVaults";
import { useVaultDeposits } from "@green-goods/shared/hooks/vault/useVaultDeposits";
import { useWorks } from "@green-goods/shared/hooks/work/useWorks";
import { useYourWorkCount } from "@green-goods/shared/hooks/work/useYourWorkCount";
import { ToastViewport } from "@green-goods/shared/components/Toast/ToastViewport";
import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Garden } from "@green-goods/shared/types/domain";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, fn, mocked, screen, userEvent, within } from "storybook/test";
import {
  withClientAppRuntime,
  withInstalledPwa,
  withQueueFailureToast,
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
import { notificationEvents } from "../../../../shared/.storybook/notificationFixtures";
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
    mocked(useArrivalState).mockReturnValue({ kind: "none" });
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
    // The bell's read model: three of the garden's events not shown on this device yet.
    const events = notificationEvents().slice(0, 3);
    mocked(useGardenNotifications).mockReturnValue({
      notifications: events.map((event) => ({ ...event, isNew: true })),
      newCount: events.length,
      isLoading: false,
      isError: false,
      isIncomplete: false,
      markSeen: fn(),
      clearAll: fn(),
    });
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
      useHasRole,
      useGardenNotifications
    );
  };
}

/**
 * Home in the member's active garden (DL-123, DL-124, DL-130): the shared garden chip in the
 * title's place, then Wallet, Promises, Your Work and the bell, in a header that stays at the
 * top. The body follows the active garden's five states: a remembered garden goes straight in
 * while the account's gardens load, a failed read says nothing was lost, no garden finds one,
 * several with none remembered offer the chooser once, and a chosen garden opens its journal.
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

/**
 * A chosen garden: the chip names it, the bell ends the header with its badge counting what is
 * new, and the journal shows the garden's page until it lands.
 */
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
    // The bell is the last launcher; its count lands once the header's reads mount at idle.
    const badge = await within(header as HTMLElement).findByTestId("notifications-badge");
    await expect(badge).toHaveTextContent("3");
    const launchers = within(header as HTMLElement).getAllByRole("button");
    await expect(launchers.at(-1)).toHaveAttribute("data-testid", "notifications-button");
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

const MESSAGES = { en, es, pt } as const;
const PHONE_VIEWPORTS = {
  homePhone360: {
    name: "Phone 360 x 800",
    styles: { width: "360px", height: "800px" },
    type: "mobile",
  },
  homePhone390: {
    name: "Phone 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

/** The toast stories pick a language through `parameters.locale`; the global decorator stays English. */
const withLocale: Decorator = (Story, context) => {
  const locale = (context.parameters.locale as keyof typeof MESSAGES | undefined) ?? "en";
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </IntlProvider>
  );
};

/** The app's toast viewport over Home, where the arrival toast lands. */
const withToastViewport: Decorator = (Story) => (
  <>
    <Story />
    <ToastViewport />
  </>
);

/**
 * Work queued in Vida Verde while the chip shows TAS HUB: the arrival toast names the garden it
 * waits in, and See Your Gardens opens the switcher there without switching (PWA Home step 12).
 */
function arrivalInAnotherGarden() {
  const reset = homeState(
    activeGarden(
      "ready",
      [memberGarden(TAS_HUB, ["steward"]), memberGarden(VIDA_VERDE, ["gardener"])],
      TAS_HUB.id
    )
  )();
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith("greengoods:arrival-shown:")) sessionStorage.removeItem(key);
  }
  mocked(useArrivalState).mockReturnValue({
    kind: "queue",
    orientation: { target: "switcher", gardenId: VIDA_VERDE.id, gardenName: VIDA_VERDE.name },
  });
  return reset;
}

const arrivalStory = (locale: keyof typeof MESSAGES): Story => ({
  beforeEach: arrivalInAnotherGarden,
  decorators: [withToastViewport, withLocale],
  parameters: { locale, viewport: { options: PHONE_VIEWPORTS } },
  globals: { viewport: { value: "homePhone360" } },
});

/** Home raises the arrival toast 700 ms after the page renders. */
const findArrivalToast = () =>
  screen.findByText("Some of your work in Vida Verde hasn't uploaded yet.", {}, { timeout: 3000 });

export const ArrivalUploadsInAnotherGarden: Story = {
  ...arrivalStory("en"),
  play: async () => {
    await expect(await findArrivalToast()).toBeVisible();
    await expect(screen.getByRole("button", { name: "See Your Gardens" })).toBeVisible();
  },
};

/** See Your Gardens opens the switcher over Home; TAS HUB stays the active garden. */
export const ArrivalSeeYourGardens: Story = {
  ...arrivalStory("en"),
  play: async () => {
    await findArrivalToast();
    await userEvent.click(screen.getByRole("button", { name: "See Your Gardens" }));
    const switcher = within(await screen.findByRole("dialog", { name: "Your Gardens" }));
    await expect(switcher.getByRole("button", { name: /Vida Verde/ })).toBeVisible();
  },
};

export const ArrivalUploadsInAnotherGardenSpanish: Story = arrivalStory("es");

export const ArrivalUploadsInAnotherGardenPortuguese: Story = arrivalStory("pt");

const unplacedArrivalStory = (locale: keyof typeof MESSAGES): Story => ({
  ...arrivalStory(locale),
  beforeEach: () => {
    const reset = homeState(activeGarden("error", [], TAS_HUB.id))();
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith("greengoods:arrival-shown:")) sessionStorage.removeItem(key);
    }
    mocked(useArrivalState).mockReturnValue({ kind: "queue", orientation: null });
    return reset;
  },
  play: async () => {
    await expect(
      await screen.findByText(
        MESSAGES[locale]["app.home.arrival.queue.message"],
        {},
        { timeout: 3000 }
      )
    ).toBeVisible();
    await expect(
      screen.queryByRole("button", { name: MESSAGES[locale]["app.home.arrival.queue.action"] })
    ).toBeNull();
  },
});

/** A failed garden read announces uploads without a potentially misleading Review action. */
export const ArrivalGardenReadFailed: Story = {
  ...unplacedArrivalStory("en"),
  tags: ["storybook-ci"],
};
export const ArrivalGardenReadFailedSpanish: Story = {
  ...unplacedArrivalStory("es"),
  tags: ["storybook-ci"],
};
export const ArrivalGardenReadFailedPortuguese: Story = {
  ...unplacedArrivalStory("pt"),
  tags: ["storybook-ci"],
};

/** A queued upload failed in Vida Verde while the chip shows TAS HUB: the queue's toast names it. */
const failedStory = (locale: keyof typeof MESSAGES): Story => ({
  beforeEach: homeState(
    activeGarden(
      "ready",
      [memberGarden(TAS_HUB, ["steward"]), memberGarden(VIDA_VERDE, ["gardener"])],
      TAS_HUB.id
    )
  ),
  decorators: [withQueueFailureToast("work", VIDA_VERDE.name), withLocale],
  parameters: { locale, viewport: { options: PHONE_VIEWPORTS } },
  globals: { viewport: { value: "homePhone360" } },
});

export const UploadFailedInAnotherGarden: Story = {
  ...failedStory("en"),
  play: async () => {
    await expect(
      await screen.findByText(
        "Your work in Vida Verde is still saved on this device. Switch to that garden to try again."
      )
    ).toBeVisible();
    await expect(screen.getByRole("button", { name: "See Your Gardens" })).toBeVisible();
  },
};

export const UploadFailedInAnotherGardenSpanish: Story = failedStory("es");

export const UploadFailedInAnotherGardenPortuguese: Story = failedStory("pt");
