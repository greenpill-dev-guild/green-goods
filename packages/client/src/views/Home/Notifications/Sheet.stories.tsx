import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import enMessages from "@green-goods/shared/i18n/en.json";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Address } from "@green-goods/shared/types/domain";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { expect, fn, mocked, screen, waitFor, within } from "storybook/test";
import { withRouter, withSeededQueryClient } from "../../../../../shared/.storybook/decorators";
import { TAS_HUB } from "../../../../../shared/.storybook/homeFixtures";
import { expectItemRowsFit } from "../../../../../shared/.storybook/itemRowFit";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import {
  NOTIFICATION_METADATA_SEEDS,
  NOTIFICATION_NAMES,
  NOTIFICATION_PROMISE_TITLES,
  notificationEvents,
} from "../../../../../shared/.storybook/notificationFixtures";
import { NotificationRow } from "./NotificationRow";
import { NotificationsSheet } from "./Sheet";

const EVENTS = notificationEvents();
const ROW_TITLES = [
  "Weekend workday",
  "Hedge Planting",
  "Seedlings for the school",
  "Compost Turn",
  "Seed Swap",
];
const catalogs = { en: enMessages, es: esMessages, pt: ptMessages } as const;
type Locale = keyof typeof catalogs;

/** The other people read by their Green Goods names; nobody here has an ENS name. */
function withNames() {
  mocked(useEnsName).mockReturnValue({ data: undefined } as ReturnType<typeof useEnsName>);
  mocked(useGreenGoodsEnsName).mockImplementation(((address?: Address | null) => ({
    data: address ? NOTIFICATION_NAMES[address.toLowerCase()] : undefined,
  })) as unknown as typeof useGreenGoodsEnsName);
  return resetHookMocks(useEnsName, useGreenGoodsEnsName);
}

/** The sheet in another of the app's languages: the nearest provider wins. */
const withLocale =
  (locale: Locale): Decorator =>
  (Story) => (
    <IntlProvider locale={locale} messages={catalogs[locale]}>
      <Story />
    </IntlProvider>
  );

/**
 * The bell's sheet (DL-130, DL-133): a full sheet over Home with All, Work and Promises tabs and
 * Clear All in its bar, the garden named beneath its title,
 * listing the garden's events for the member, one item row each, newest first: own work approved,
 * or rejected with the review's feedback; a promise of theirs taken up; and, for whoever may act
 * on them, a new submission and a take-up request. Opening it marks the listed events seen.
 */
const meta: Meta<typeof NotificationsSheet> = {
  title: "Client/Sheets/NotificationsSheet",
  component: NotificationsSheet,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobileSmall" } },
  decorators: [withRouter(["/home"]), withSeededQueryClient(NOTIFICATION_METADATA_SEEDS)],
  beforeEach: withNames,
  args: {
    open: true,
    onClose: fn(),
    gardenId: TAS_HUB.id,
    gardenName: TAS_HUB.name,
    notifications: EVENTS,
    isLoading: false,
    isError: false,
    isIncomplete: false,
    markAllSeen: fn(),
    clearAll: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof NotificationsSheet>;

async function expectEvents(sheetName: string, gardenLine: string, markAllSeen: unknown) {
  const sheet = await screen.findByRole("dialog", { name: sheetName });
  await waitFor(() => expect(sheet).toBeVisible());
  await expect(sheet).toHaveAttribute("data-sheet-size", "full");
  // All, Work and Promises (DL-133); the labels follow the locale.
  await expect(within(sheet).getAllByRole("tab")).toHaveLength(3);
  await expect(within(sheet).getByText(gardenLine)).toBeVisible();
  await expect(markAllSeen).toHaveBeenCalled();
  const rows = within(sheet).getAllByRole("listitem");
  await expect(rows.map((row) => row.querySelector(".gg-item-row-title")?.textContent)).toEqual(
    ROW_TITLES
  );
  // Rows keep one height, and every detail is whole or dropped whole.
  await expectItemRowsFit(sheet);
}

/** Frame `events`: one of each kind, newest first, at 360px. */
export const Events: Story = {
  tags: ["storybook-ci"],
  play: async ({ args }) => {
    await expectEvents("Notifications", "In TAS HUB", args.markAllSeen);
  },
};

/** The same events at the 375px phone column. */
export const EventsAt375: Story = {
  globals: { viewport: { value: "mobile" } },
  play: async ({ args }) => {
    await expectEvents("Notifications", "In TAS HUB", args.markAllSeen);
  },
};

/** Spanish: headings in sentence case, the pills in the app's words for promises. */
export const EventsSpanish: Story = {
  decorators: [withLocale("es")],
  play: async ({ args }) => {
    await expectEvents("Notificaciones", "En TAS HUB", args.markAllSeen);
  },
};

/** Portuguese. */
export const EventsPortuguese: Story = {
  decorators: [withLocale("pt")],
  play: async ({ args }) => {
    await expectEvents("Notificações", "Em TAS HUB", args.markAllSeen);
  },
};

/** Nothing new: the shared state block, at the sheet tabs' upper-middle anchor (DL-036). */
export const NothingNew: Story = {
  args: { notifications: [] },
  play: async () => {
    const sheet = await screen.findByRole("dialog", { name: "Notifications" });
    await expect(await within(sheet).findByRole("heading", { name: "Nothing New" })).toBeVisible();
    await expect(
      within(sheet).getByText("What happens in this garden shows up here.")
    ).toBeVisible();
  },
};

/** A read that answered only in part: one quiet line, and the rows it did find stay. */
export const PartialRead: Story = {
  args: { isIncomplete: true },
  play: async () => {
    const sheet = await screen.findByRole("dialog", { name: "Notifications" });
    await expect(
      await within(sheet).findByText("Some events couldn't be read. Nothing was lost.")
    ).toBeVisible();
    await expect(within(sheet).getAllByRole("listitem")).toHaveLength(EVENTS.length);
  },
};

/** The first read still running: empty row frames hold the list's place (DL-056). */
export const Loading: Story = {
  args: { notifications: [], isLoading: true },
  play: async () => {
    const sheet = await screen.findByRole("dialog", { name: "Notifications" });
    await waitFor(() =>
      expect(sheet.querySelectorAll("[data-skeleton='item-row']").length).toBeGreaterThan(0)
    );
  },
};

function Column({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div style={{ width }} className="flex shrink-0 flex-col gap-3">
      {children}
    </div>
  );
}

function EveryRow() {
  return (
    <>
      {EVENTS.map((notification) => (
        <NotificationRow
          key={notification.id}
          notification={notification}
          promiseTitle={
            "commitment" in notification && notification.commitment.metadataCID
              ? NOTIFICATION_PROMISE_TITLES[notification.commitment.metadataCID]
              : null
          }
          onOpen={fn()}
        />
      ))}
    </>
  );
}

/**
 * Every event kind at the sheet's columns on 360 and 390px phones (328 and 358px inside the
 * gutters) in English, Spanish and Portuguese: each row 88px, every detail whole or dropped whole.
 */
export const RowsFitEveryLanguage: Story = {
  globals: { viewport: { value: "desktop" } },
  parameters: { layout: "padded" },
  render: () => (
    <div className="flex flex-col gap-8">
      {(Object.keys(catalogs) as Locale[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={catalogs[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            {[328, 358].map((width) => (
              <Column key={width} width={width}>
                <EveryRow />
              </Column>
            ))}
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const fit = await expectItemRowsFit(canvasElement);
    await expect(fit.heights).toHaveLength(EVENTS.length * 2 * 3);
  },
};
