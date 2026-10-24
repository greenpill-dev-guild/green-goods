import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider, useIntl } from "react-intl";
import { expect, fn, within } from "storybook/test";
import { FIXTURE_WORK_MEDIA, hoursAgo } from "../../../../.storybook/fixtures";
import { expectItemRowsFit, measureItemRowFit } from "../../../../.storybook/itemRowFit";
import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";
import ptMessages from "../../../i18n/pt.json";
import { WorkCard, type WorkCardData, type WorkCardProps, WorkCardSkeleton } from "./WorkCard";

const mockWork: WorkCardData = {
  id: "work-1",
  title: "Planted 50 native trees",
  status: "approved",
  createdAt: hoursAgo(2),
  mediaPreview: [FIXTURE_WORK_MEDIA[0]],
  gardenerDisplayName: "Alice.eth",
  gardenName: "Community Garden",
  imageCount: 3,
};

const meta: Meta<typeof WorkCard> = {
  title: "Shared/Cards/WorkCard",
  component: WorkCard,
  tags: ["autodocs", "storybook-ci"],
  // A row is a button only when it has something to open.
  args: { onClick: fn() },
  argTypes: {
    showGardener: { control: "boolean", description: "The gardener leads the detail line" },
    showMediaCount: { control: "boolean", description: "The photo count, on the photo" },
    showErrorBadge: { control: "boolean", description: "A failed work says so in its pill" },
  },
  // A phone's list width at 390px; the fit story lays out its own columns.
  decorators: [
    (Story, context) =>
      context.parameters.ownColumns ? (
        <Story />
      ) : (
        <div style={{ width: 358 }}>
          <Story />
        </div>
      ),
  ],
};

export default meta;
type Story = StoryObj<typeof WorkCard>;

/** The work row (F7): the photo with its count, the title, the pill under it, the age. */
export const Default: Story = {
  args: { work: mockWork },
};

/** Who did it, then how long ago: the garden's Work tab. */
export const WithGardener: Story = {
  args: { work: mockWork, showGardener: true },
  play: async ({ canvasElement }) => {
    const row = within(canvasElement).getByRole("button");
    await expect(row).toHaveAccessibleName(
      /Planted 50 native trees.*Approved.*Alice\.eth.*2 hr\. ago/
    );
    // The age is a moment: a <time> with its machine-readable form and exact time.
    const age = canvasElement.querySelector("time");
    await expect(age).toHaveTextContent("2 hr. ago");
    await expect(age?.getAttribute("datetime")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    await expectItemRowsFit(canvasElement);
  },
};

/** A list words feedback as the second detail, in place of the age. */
export const Rejected: Story = {
  args: {
    work: { ...mockWork, status: "rejected", feedback: "Please add the planting site." },
    contextLabel: "Your work was reviewed",
    supportingText: "Feedback",
  },
};

/** A failure replaces the status in the one pill; the retry count stays on the work's page. */
export const Failed: Story = {
  args: {
    work: { ...mockWork, status: "sync_failed", error: "Network error occurred", retryCount: 2 },
    showErrorBadge: true,
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getAllByRole("status")).toHaveLength(1);
    await expect(within(canvasElement).getByRole("status")).toHaveTextContent("Error");
  },
};

/** A work with no photo keeps its photo slot, so titles in a list stay at one offset. */
export const NoMedia: Story = {
  args: { work: { ...mockWork, mediaPreview: undefined, imageCount: 0 } },
};

export const StatusCatalog: Story = {
  render: () => (
    <div className="flex flex-col gap-(--gg-list-gap)">
      <WorkCard work={{ ...mockWork, status: "approved", title: "Approved Work" }} />
      <WorkCard work={{ ...mockWork, status: "pending", title: "Pending Review" }} />
      <WorkCard work={{ ...mockWork, status: "rejected", title: "Rejected Work" }} />
      <WorkCard work={{ ...mockWork, status: "syncing", title: "Syncing to Chain" }} />
      <WorkCard work={{ ...mockWork, status: "sync_failed", title: "Failed Submission" }} />
      <WorkCard work={{ ...mockWork, status: "offline", title: "On This Phone" }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
  },
};

/** A row with nothing to open is content: it presses nowhere and takes no focus. */
export const NonInteractive: Story = {
  args: { work: mockWork, interactive: false },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole("button")).toBeNull();
  },
};

/**
 * While a list loads, each row is its own frame with nothing in it: the photo, the title
 * line, the pill and the detail line land where the loaded row's do.
 */
export const LoadingPlaceholder: Story = {
  render: () => (
    <div className="flex flex-col gap-(--gg-list-gap)">
      <WorkCard work={mockWork} showGardener interactive={false} />
      <WorkCardSkeleton />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [row, skeleton] = [...canvasElement.querySelectorAll<HTMLElement>(".gg-item-row")];
    const box = (element: Element) => element.getBoundingClientRect();
    const offset = (selector: string, root: HTMLElement) => {
      const element = root.querySelector(selector) as HTMLElement;
      return {
        left: Math.round(box(element).left - box(root).left),
        width: Math.round(box(element).width),
      };
    };
    await expect(box(skeleton).height).toBe(box(row).height);
    await expect(offset(".gg-item-row-photo", skeleton)).toEqual(offset(".gg-item-row-photo", row));
    await expect(offset(".gg-item-row-body", skeleton)).toEqual(offset(".gg-item-row-body", row));
  },
};

const CATALOGS = { en: enMessages, es: esMessages, pt: ptMessages } as const;
type Locale = keyof typeof CATALOGS;

/**
 * The phone list widths: 320, 360 and 390px less the app's 16px gutters and the
 * cockpit's 12px ones.
 */
const WIDTHS = {
  app: [288, 328, 358],
  cockpit: [296, 336, 366],
} as const;

const TITLES: Record<Locale, string[]> = {
  en: ["Planted native saplings along the river path", "Composting", "Cleaned the solar panels"],
  es: [
    "Plantación de plántulas nativas junto al río",
    "Compostaje",
    "Limpieza de los paneles solares",
  ],
  pt: ["Plantio de mudas nativas na beira do rio", "Compostagem", "Limpeza dos painéis solares"],
};

/**
 * The rows every list draws, with long real values: names display without the protocol's
 * `.greengoods.eth` and addresses as `0x7b2e...41c9`, as `formatAddress` gives them.
 */
function LocalizedRows({ surface }: { surface: "app" | "cockpit" }) {
  const intl = useIntl();
  const locale = intl.locale as Locale;
  const text = (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values);
  const labels: WorkCardProps["labels"] = {
    untitledWork: text("app.workCard.untitledWork"),
    status: {
      approved: text("app.status.approved"),
      pending: text("app.status.pending"),
      rejected: text("app.status.rejected"),
    },
  };
  const rows: WorkCardProps[] =
    surface === "app"
      ? [
          // The garden's Work tab: who, then how long ago.
          {
            work: {
              ...mockWork,
              title: TITLES[locale][0],
              status: "pending",
              gardenerDisplayName: "chidinma-okonkwo",
            },
            showGardener: true,
          },
          // Your Work, Completed: whose work it was, then the age, or feedback in its place.
          {
            work: { ...mockWork, title: TITLES[locale][1], status: "approved" },
            contextLabel: text("app.workDashboard.badge.yourWorkReviewed"),
          },
          {
            work: {
              ...mockWork,
              title: TITLES[locale][2],
              status: "rejected",
              createdAt: hoursAgo(26),
            },
            contextLabel: text("app.workDashboard.badge.reviewedByYou"),
            supportingText: text("app.workCard.feedback"),
          },
        ]
      : [
          // The cockpit's phone queue: a neutral Pending (DL-044), who, then how long ago.
          {
            work: {
              ...mockWork,
              title: TITLES[locale][0],
              status: "pending",
              gardenerDisplayName: "0x7b2e...41c9",
            },
            showGardener: true,
            statusLabel: text("app.admin.work.filter.pending"),
            statusTone: "neutral",
          },
          {
            work: {
              ...mockWork,
              title: TITLES[locale][2],
              status: "approved",
              gardenerDisplayName: "regenerativa",
            },
            showGardener: true,
            statusLabel: text("app.admin.work.filter.approved"),
            statusTone: "success",
          },
        ];
  return (
    <>
      {rows.map((row) => (
        <WorkCard
          key={`${row.work.title}-${row.work.status}`}
          {...row}
          labels={labels}
          onClick={fn()}
        />
      ))}
    </>
  );
}

/**
 * Done when (PRD-1273): every row in a list is one height, and no detail line wraps at
 * 320, 360 or 390px in English, Spanish or Portuguese, on the app's lists and the
 * cockpit's phone queue. A detail that does not fit drops whole.
 */
export const FitsEveryLanguage: Story = {
  parameters: { ownColumns: true },
  render: () => (
    <div className="flex flex-col gap-8">
      {(Object.keys(CATALOGS) as Locale[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={CATALOGS[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            {WIDTHS.app.map((width) => (
              <div
                key={`app-${width}`}
                className="flex flex-col gap-(--gg-list-gap)"
                style={{ width }}
              >
                <LocalizedRows surface="app" />
              </div>
            ))}
            {WIDTHS.cockpit.map((width) => (
              <div
                key={`cockpit-${width}`}
                data-surface-scope="admin"
                className="flex flex-col gap-(--gg-list-gap)"
                style={{ width }}
              >
                <LocalizedRows surface="cockpit" />
              </div>
            ))}
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
    // At 390px (the widest column of each surface) every detail fits whole.
    for (const column of canvasElement.querySelectorAll<HTMLElement>(
      '[style*="width: 358px"], [style*="width: 366px"]'
    )) {
      await expect(measureItemRowFit(column).dropped).toBe(0);
    }
  },
};
