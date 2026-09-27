import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { PublicFieldNote } from "@green-goods/shared/hooks/public/usePublicGardenDetail";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import { type Action, Domain } from "@green-goods/shared/types/domain";
import { instructionTemplates } from "@green-goods/shared/utils/action/templates";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, userEvent, within } from "storybook/test";
import { withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { FieldNotesSection } from "./GardenDetailFieldNotes";

const CHAIN_ID = 42161;
const action: Action = {
  id: `${CHAIN_ID}-1`,
  slug: "waste.sorting_breakdown",
  instructions: "ipfs://action-fixture",
  title: "Sorting & Breakdown",
  description: "Record sorted materials.",
  domain: Domain.WASTE,
  startTime: 0,
  endTime: 0,
  createdAt: 1_700_000_000_000,
  capitals: [],
  media: [],
  inputs: instructionTemplates["waste.sorting_breakdown"].uiConfig.details.inputs.map((input) => ({
    ...input,
    repeaterFields: input.repeaterFields?.map((field) =>
      field.key === "weightKg" ? { ...field, title: "Weight", unit: "kg" } : field
    ),
  })),
  translations: Object.fromEntries(
    [
      ["pt", "Separação por categoria", "Categoria", "Plástico", "Peso"],
      ["es", "Separación por categoría", "Categoría", "Plástico", "Peso"],
    ].map(([locale, title, category, plastic, weight]) => [
      locale,
      {
        status: "reviewed",
        data: {
          uiConfig: {
            details: {
              inputs: [
                {
                  key: "categoryBreakdown",
                  title,
                  repeaterFields: [
                    { key: "category", title: category, options: { Plastic: plastic } },
                    { key: "weightKg", title: weight },
                  ],
                },
              ],
            },
          },
        },
      },
    ])
  ),
};

const note: PublicFieldNote = {
  id: `0x${"1".repeat(64)}`,
  title: "Waste sorting",
  feedback: "15 kg",
  metadata: JSON.stringify({
    schemaVersion: "work_metadata_v2",
    timeSpentMinutes: 90,
    details: { categoryBreakdown: [{ category: "Plastic", weightKg: 15 }] },
  }),
  media: [],
  gardenerAddress: "0x1111111111111111111111111111111111111111",
  gardenAddress: "0x2222222222222222222222222222222222222222",
  actionUID: 1,
  createdAt: 1_700_000_000,
};

const meta = {
  title: "Client/Public/GardenFieldNotes",
  component: FieldNotesSection,
  tags: ["storybook-ci"],
  decorators: [
    withSeededQueryClient([
      [queryKeys.actions.byChain(CHAIN_ID), []],
      [queryKeys.actions.atWork(CHAIN_ID, note.actionUID, note.id), action],
    ]),
  ],
  args: { notes: [note], total: 1, loading: false, unavailable: false, chainId: CHAIN_ID },
} satisfies Meta<typeof FieldNotesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Portuguese: Story = {
  render: (args) => (
    <IntlProvider locale="pt" messages={pt}>
      <FieldNotesSection {...args} />
    </IntlProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Waste sorting/ }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(dialog.getByText("Separação por categoria")).toBeVisible();
    await expect(dialog.getByText("Categoria: Plástico, Peso (kg): 15")).toBeVisible();
  },
};

export const Spanish: Story = {
  render: (args) => (
    <IntlProvider locale="es" messages={es}>
      <FieldNotesSection {...args} />
    </IntlProvider>
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Waste sorting/ }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(dialog.getByText("Separación por categoría")).toBeVisible();
    await expect(dialog.getByText("Categoría: Plástico, Peso (kg): 15")).toBeVisible();
  },
};

export const UnavailableInstructions: Story = {
  decorators: [
    withSeededQueryClient([
      [
        queryKeys.actions.atWork(CHAIN_ID, note.actionUID, note.id),
        { ...action, instructionsFallback: true },
      ],
    ]),
  ],
  render: Portuguese.render,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Waste sorting/ }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(
      dialog.getByText(pt["public.gardenDetail.notes.detailsUnavailable"])
    ).toBeVisible();
    await expect(dialog.getByText("1h 30m")).toBeVisible();
    await expect(dialog.queryByText("Separação por categoria")).not.toBeInTheDocument();
    await expect(
      dialog.getByRole("button", { name: pt["public.gardenDetail.retry"] })
    ).toBeVisible();
  },
};

export const IncompleteTranslation: Story = {
  decorators: [
    withSeededQueryClient([
      [
        queryKeys.actions.atWork(CHAIN_ID, note.actionUID, note.id),
        {
          ...action,
          translations: { pt: { status: "reviewed", data: { title: "Triagem" } } },
        },
      ],
    ]),
  ],
  render: Portuguese.render,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /Waste sorting/ }));
    const dialog = within(await within(canvasElement.ownerDocument.body).findByRole("dialog"));
    await expect(
      dialog.getByText(pt["public.gardenDetail.notes.detailsUnavailable"])
    ).toBeVisible();
    await expect(dialog.getByText("1h 30m")).toBeVisible();
    await expect(dialog.queryByText(/Category: Plastic/)).not.toBeInTheDocument();
  },
};
