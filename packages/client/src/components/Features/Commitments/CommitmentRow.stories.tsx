import type { Address } from "@green-goods/shared/types/domain";
import type { CommitmentReadModel, InboxCommitment } from "@green-goods/shared/commitment-pooling";
import enMessages from "@green-goods/shared/i18n/en";
import esMessages from "@green-goods/shared/i18n/es";
import ptMessages from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, fn, within } from "storybook/test";
import { CommitmentRow } from "./CommitmentRow";

const VIEWER = "0x1111111111111111111111111111111111111111" as Address;
const OTHER = "0x2222222222222222222222222222222222222222" as Address;

function commitment(overrides: Partial<CommitmentReadModel> = {}): CommitmentReadModel {
  return {
    id: "42161-9",
    chainId: 42161,
    commitmentId: 9n,
    creationSeen: true,
    onchainState: "ACCEPTED",
    derivedState: "ACTIVE",
    state: "ACCEPTED",
    approvedUnits: 0n,
    evidenceCount: 0,
    cycleId: null,
    declaredUnitValue: null,
    declaredValueBasis: null,
    targetUnits: 3n,
    unitLabel: "hours",
    creator: VIEWER,
    leadProvider: VIEWER,
    counterparty: OTHER,
    direction: "OFFER",
    confirmers: [],
    contributorCount: 1,
    contributorsFrozen: false,
    ...overrides,
  };
}

function row(overrides: Partial<InboxCommitment> = {}): InboxCommitment {
  return { commitment: commitment(), seat: "provider", needsYou: true, ...overrides };
}

/**
 * One commitment as a member sees it in their own list: what it is, which
 * side they are on, where it stands, and whether it is waiting on them.
 */
const meta: Meta<typeof CommitmentRow> = {
  title: "Client/Commitments/CommitmentRow",
  component: CommitmentRow,
  tags: ["autodocs", "storybook-ci"],
  parameters: { viewport: { defaultViewport: "mobile1" } },
  decorators: [
    (Story) => (
      <div className="max-w-sm space-y-2 p-4">
        <Story />
      </div>
    ),
  ],
  args: { onOpen: fn() },
};

export default meta;
type Story = StoryObj<typeof CommitmentRow>;

export const ProviderNeedsYou: Story = {
  args: { row: row() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /3 hours/ })).toBeVisible();
    await expect(canvas.getByText("Needs you")).toBeVisible();
  },
};

export const Named: Story = {
  args: { row: row(), title: "Compost delivery to the beds" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Compost delivery to the beds")).toBeVisible();
    await expect(canvas.getByText("3 hours")).toBeVisible();
  },
};

export const ConfirmerWaiting: Story = {
  args: {
    row: row({
      commitment: commitment({
        creator: OTHER,
        leadProvider: OTHER,
        counterparty: VIEWER,
        derivedState: "READY_FOR_CONFIRMATION",
        onchainState: "READY_FOR_CONFIRMATION",
        evidenceCount: 2,
      }),
      seat: "confirmer",
      needsYou: true,
    }),
  },
};

export const OnTheTeam: Story = {
  args: {
    row: row({
      commitment: commitment({ creator: OTHER, leadProvider: OTHER, contributorCount: 3 }),
      seat: "contributor",
      needsYou: false,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3 people on the team")).toBeVisible();
  },
};

export const SendFailed: Story = {
  args: { row: row({ needsYou: false }), sendFailed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Didn't send")).toBeVisible();
  },
};

export const Settled: Story = {
  args: {
    row: row({
      commitment: commitment({ derivedState: "FULFILLED", onchainState: "FULFILLED" }),
      needsYou: false,
    }),
  },
};

/** Without a destination the row is a record, not a control. */
export const RecordOnly: Story = {
  args: { row: row({ needsYou: false }), onOpen: undefined },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByRole("button")).not.toBeInTheDocument();
  },
};

const quantityLocales = [
  { locale: "en", messages: enMessages },
  { locale: "es", messages: esMessages },
  { locale: "pt", messages: ptMessages },
] as const;

const quantityUnits = ["sessions", "repairs", "rides"] as const;

/** The composer units use each locale's own singular and plural nouns. */
export const QuantityGrammar: Story = {
  render: () => (
    <div className="space-y-6">
      {quantityLocales.map(({ locale, messages }) => (
        <IntlProvider key={locale} locale={locale} messages={messages}>
          <section lang={locale} className="space-y-2" aria-label={`${locale} quantities`}>
            <p className="text-xs font-semibold uppercase">{locale}</p>
            {quantityUnits.flatMap((unit, unitIndex) =>
              ([1n, 2n] as const).map((count) => (
                <CommitmentRow
                  key={`${unit}-${count}`}
                  row={row({
                    commitment: commitment({
                      id: `42161-${unitIndex}-${count}`,
                      commitmentId: BigInt(unitIndex * 2) + count,
                      targetUnits: count,
                      unitLabel: unit,
                    }),
                    needsYou: false,
                  })}
                />
              ))
            )}
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const expected = {
      en: ["1 session", "2 sessions", "1 repair", "2 repairs", "1 ride", "2 rides"],
      es: ["1 sesión", "2 sesiones", "1 reparación", "2 reparaciones", "1 viaje", "2 viajes"],
      pt: ["1 sessão", "2 sessões", "1 conserto", "2 consertos", "1 carona", "2 caronas"],
    } as const;

    for (const locale of quantityLocales) {
      const section = canvasElement.querySelector(`section[lang="${locale.locale}"]`);
      await expect(section).toBeInTheDocument();
      const localized = within(section as HTMLElement);
      for (const quantity of expected[locale.locale]) {
        await expect(localized.getByText(quantity)).toBeVisible();
      }
    }
  },
};
