import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentType } from "react";
import { IntlProvider } from "react-intl";
import { expect, screen, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS } from "../../../../../shared/.storybook/fixtures";
import { VoucherReportVisitDialog } from "./VoucherBookingDialogs";
import { STORY_MARA_VISIT, nameVoucherMembers } from "./poolStoryVouchers";

function inLocale(locale: "es" | "pt") {
  return (Story: ComponentType) => (
    <IntlProvider locale={locale} messages={locale === "es" ? esMessages : ptMessages}>
      <Story />
    </IntlProvider>
  );
}

const meta: Meta = {
  title: "Admin/Pool/VoucherBookingDialogs",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Report Visit (PRD-1297 surface 6, `SIssuer`), opened from a hub day's row in Offers and Requests: what the steward records about the visit, as evidence for the final split, written to the pool. It moves no vouchers, and the holder still approves the split. The people and moments are fictional.",
      },
    },
  },
  beforeEach: nameVoucherMembers,
};

export default meta;
type Story = StoryObj;

const report = ({ disabled = false }: { disabled?: boolean } = {}) => (
  <VoucherReportVisitDialog
    booking={STORY_MARA_VISIT}
    title="Hub day, up to 4 hours"
    target={{ gardenName: "Tech and Sun", isProtocol: false }}
    nowMs={STORYBOOK_NOW_SECONDS * 1000}
    disabled={disabled}
    tone="garden"
    onClose={() => undefined}
    onReport={async () => undefined}
  />
);

/** Mara checked in for the whole hub day: the report is evidence, written to Tech and Sun's pool. */
export const ReportVisit: Story = {
  render: () => report(),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByText("Report Mara’s Visit")).toBeVisible();
    await expect(dialog.getByText("Mara checked in")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Report Visit" })).toBeEnabled();
  },
};

export const ReportVisitEs: Story = { render: () => report(), decorators: [inLocale("es")] };
export const ReportVisitPt: Story = { render: () => report(), decorators: [inLocale("pt")] };

/** The console went offline with the dialog open: Report Visit waits, as the row's act does. */
export const ReportVisitOffline: Story = {
  render: () => report({ disabled: true }),
  play: async () => {
    const dialog = within(await screen.findByRole("dialog"));
    await expect(dialog.getByRole("button", { name: "Report Visit" })).toBeDisabled();
  },
};
