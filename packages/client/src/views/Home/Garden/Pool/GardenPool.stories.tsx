import { GardenTab } from "@green-goods/shared/hooks/garden/useGardenTabs";
import { useGardenPoolController } from "@green-goods/shared/hooks/client-ui/pool/useGardenPoolController";
import { useElementHeight } from "@green-goods/shared/hooks/utils/useElementHeight";
import { RiCalendarEventFill, RiMapPin2Fill } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { expect, mocked, userEvent, waitFor, within } from "storybook/test";
import {
  gardenPoolControllerFixture,
  JOURNEY_CYCLE_NAMES,
  JOURNEY_POOL,
  LIVE_PROMISES,
  SETTLED_PROMISES,
} from "../../../../../../shared/.storybook/clientJourneyFixtures";
import {
  withAppPage,
  withRouter,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { FIXTURE_IMAGE_BANNER } from "../../../../../../shared/.storybook/fixtures";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import { StandardTabs } from "@/components/Navigation";
import { buildGardenTabs } from "../gardenTabs";
import { GardenPool } from "./GardenPool";

/**
 * The garden page around the tab, as the page draws it: banner, name and place,
 * and the section tabs. It stands in for the page's own header, which this tab
 * does not change, so a capture can sit beside the design frame.
 */
function GardenPageFrame({ children }: { children: ReactNode }) {
  const intl = useIntl();
  // As on the page: the spacer under the fixed header is the header's measured height.
  const [measureHeader, headerHeight] = useElementHeight();
  return (
    <div className="relative flex h-dvh min-h-0 w-full flex-col overflow-hidden bg-bg-white-0">
      <div ref={measureHeader} className="fixed left-0 right-0 top-0 z-20 bg-bg-white-0">
        <div className="relative h-36 w-full overflow-hidden rounded-b-2xl">
          <img
            src={FIXTURE_IMAGE_BANNER}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        </div>
        <div className="mt-3 flex flex-col gap-1.5 bg-bg-white-0 px-4 pb-3">
          <h1 className="line-clamp-2 text-2xl font-bold">Riverside Commons Garden</h1>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-text-sub-600">
              <RiMapPin2Fill className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="truncate">Riverside District</span>
            </div>
            <div className="flex min-w-0 items-center gap-1.5 text-sm text-text-sub-600">
              <RiCalendarEventFill className="h-4 w-4 flex-shrink-0 text-primary" />
              <span className="truncate">Founded Mar 14, 2024</span>
            </div>
          </div>
        </div>
        <div className="sticky left-0 right-0 top-0 z-10 w-full bg-bg-white-0 shadow-sm">
          <StandardTabs
            tabs={buildGardenTabs(intl, { hasPool: true })}
            activeTab={GardenTab.Pool}
            onTabChange={() => undefined}
            ariaLabel="Garden sections"
            variant="compact"
          />
        </div>
      </div>
      <div className="flex-shrink-0" style={{ height: headerHeight ?? 288 }} aria-hidden="true" />
      {/* The app hides scrollbars in its global sheet, which Storybook doesn't load. */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-24 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

const useController = (fixture: ReturnType<typeof gardenPoolControllerFixture>) => () => {
  mocked(useGardenPoolController).mockReturnValue(fixture);
  return resetHookMocks(useGardenPoolController);
};

/**
 * A garden's promises: the seasons and campaigns, one header row (the count, the
 * pool's agreement behind its ⓘ, Status and Kind), then the 88px rows, and the +
 * that opens Offer or Request for members. Fictional data from the design frames.
 */
const meta: Meta<typeof GardenPool> = {
  title: "Client/Commitments/GardenPool",
  component: GardenPool,
  tags: ["autodocs"],
  globals: { viewport: { value: "mobile" } },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <GardenPageFrame>
        <Story />
      </GardenPageFrame>
    ),
    withSeededQueryClient(JOURNEY_CYCLE_NAMES),
    withRouter(["/home/garden"]),
    withAppPage,
  ],
  args: { pool: JOURNEY_POOL },
};

export default meta;
type Story = StoryObj<typeof GardenPool>;

export const Live: Story = {
  tags: ["storybook-ci"],
  beforeEach: useController(gardenPoolControllerFixture(LIVE_PROMISES)),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("7 live")).toBeVisible();
    // The agreement's ⓘ sits 4px after the count and centred on it (D33).
    const count = canvas.getByText("7 live").getBoundingClientRect();
    const info = canvas
      .getByRole("button", { name: "What this pool is for" })
      .getBoundingClientRect();
    await expect(Math.round(info.left - count.right)).toBe(4);
    await expect(
      Math.abs(info.top + info.height / 2 - (count.top + count.height / 2))
    ).toBeLessThanOrEqual(1);
    // Status and Kind are the 32px compact filters (D27).
    for (const name of ["Status", "Kind"]) {
      const select = canvas.getByRole("combobox", { name });
      const style = getComputedStyle(select);
      const face =
        select.getBoundingClientRect().height -
        Number.parseFloat(style.borderTopWidth) -
        Number.parseFloat(style.borderBottomWidth);
      await expect(face).toBe(32);
    }
    // Every row is one 88px frame (D4).
    for (const row of canvasElement.querySelectorAll("[data-component=CommitmentRow]")) {
      await expect(row.getBoundingClientRect().height).toBe(88);
    }
  },
};

export const Settled: Story = {
  beforeEach: useController(gardenPoolControllerFixture(SETTLED_PROMISES, { liveness: "settled" })),
};

export const SeasonSelected: Story = {
  beforeEach: useController(
    gardenPoolControllerFixture(
      [LIVE_PROMISES[0], LIVE_PROMISES[1], LIVE_PROMISES[2], LIVE_PROMISES[3], LIVE_PROMISES[6]],
      { selectedCycleId: 3n }
    )
  ),
};

export const CampaignSelected: Story = {
  beforeEach: useController(
    gardenPoolControllerFixture([LIVE_PROMISES[4], LIVE_PROMISES[5]], { selectedCycleId: 4n })
  ),
};

/** Someone who isn't a member reads every promise and gets no +; the garden header offers Join Garden. */
export const Visitor: Story = {
  tags: ["storybook-ci"],
  beforeEach: useController(gardenPoolControllerFixture(LIVE_PROMISES, { canCreate: false })),
  play: async ({ canvasElement }) => {
    await expect(
      within(canvasElement).queryByRole("button", { name: "Offer or Request" })
    ).not.toBeInTheDocument();
  },
};

/** The protocol pool: its host garden's stewards start promises, with no notice about it. */
export const ProtocolPool: Story = {
  args: { pool: { ...JOURNEY_POOL, poolType: "PROTOCOL" } },
  beforeEach: useController(
    gardenPoolControllerFixture([LIVE_PROMISES[6], LIVE_PROMISES[5], LIVE_PROMISES[2]], {
      canCreate: false,
    })
  ),
};

/** Loading keeps the loaded layout: the header row, placeholders the filters' widths, 88px rows. */
export const Loading: Story = {
  tags: ["storybook-ci"],
  beforeEach: useController(
    gardenPoolControllerFixture([], { rows: [], commitments: { isLoading: true, commitments: [] } })
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const header = canvas.getByTestId("garden-list-header-loading");
    await expect(within(header).getByRole("status")).toHaveTextContent(
      "Gathering… this garden's promises"
    );
    // No ⓘ while loading: it would slide as the line becomes the count. No + either.
    await expect(canvas.queryByRole("button", { name: "What this pool is for" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Offer or Request" })).toBeNull();
    const rows = canvasElement.querySelectorAll("[data-skeleton=commitment-row]");
    await expect(rows).toHaveLength(4);
    await expect(rows[0].getBoundingClientRect().height).toBe(88);
  },
};

/** No promises yet: the count and ⓘ stay, the filters hide, and the same + starts one. */
export const Empty: Story = {
  tags: ["storybook-ci"],
  beforeEach: useController(gardenPoolControllerFixture([], { rows: [] })),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("0 live")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "What this pool is for" })).toBeVisible();
    await expect(canvas.queryByRole("combobox")).toBeNull();
    await expect(canvas.getByRole("button", { name: "Offer or Request" })).toBeVisible();
  },
};

/** Couldn't load sits exactly where No promises yet sits, as an alert with Try Again, and no +. */
export const LoadError: Story = {
  tags: ["storybook-ci"],
  beforeEach: useController(
    gardenPoolControllerFixture([], { rows: [], commitments: { isError: true, commitments: [] } })
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = canvas.getByRole("alert");
    await expect(alert).toHaveTextContent("Couldn't load promises");
    await expect(within(alert).getByRole("button", { name: "Try Again" })).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Offer or Request" })).toBeNull();
  },
};

/** Offline, the count line says when the saved list was read; the selects still narrow it. */
export const Offline: Story = {
  beforeEach: useController(
    gardenPoolControllerFixture(
      [LIVE_PROMISES[0], LIVE_PROMISES[1], LIVE_PROMISES[2], LIVE_PROMISES[4]],
      { isOnline: false }
    )
  ),
};

/** The ⓘ beside the count opens the pool's agreement in today's compact sheet. */
export const Agreement: Story = {
  tags: ["storybook-ci"],
  beforeEach: useController(gardenPoolControllerFixture(LIVE_PROMISES)),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "What this pool is for" })
    );
    await waitFor(() =>
      expect(within(document.body).getByTestId("app-sheet")).toHaveTextContent(
        "What this pool is for"
      )
    );
  },
};

/** The + opens Offer or Request: two choice cards and a way to Help. */
export const Chooser: Story = {
  beforeEach: useController(gardenPoolControllerFixture(LIVE_PROMISES)),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Offer or Request" }));
    await waitFor(() =>
      expect(within(document.body).getByTestId("app-sheet")).toHaveTextContent("How Promises Work")
    );
  },
};

/** A season's ⓘ opens its details; Show Its Promises selects the card. */
export const SeasonDetails: Story = {
  beforeEach: useController(gardenPoolControllerFixture(LIVE_PROMISES)),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "About Autumn Planting 2026" })
    );
    await waitFor(() =>
      expect(within(document.body).getByTestId("app-sheet")).toHaveTextContent("Kept so far")
    );
  },
};

export const CampaignDetails: Story = {
  beforeEach: useController(gardenPoolControllerFixture(LIVE_PROMISES)),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: "About Seed Swap Weekend" })
    );
    await waitFor(() =>
      expect(within(document.body).getByTestId("app-sheet")).toHaveTextContent("Kept so far")
    );
  },
};
