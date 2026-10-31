import type { Address } from "@green-goods/shared/types/domain";
import type { CommitmentReadModel, InboxCommitment } from "@green-goods/shared/commitment-pooling";
import enMessages from "@green-goods/shared/i18n/en";
import esMessages from "@green-goods/shared/i18n/es";
import ptMessages from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, fn, within } from "storybook/test";
import { expectItemRowsFit } from "../../../../../shared/.storybook/itemRowFit";
import { PromiseRow } from "./PromiseRow";

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
 * One commitment as a member sees it in their own list, on the shared commitment row:
 * offer or request on its icon, where it stands or that it waits on them in its one pill,
 * and when it is due and who is on the other side on the detail line.
 */
const meta: Meta<typeof PromiseRow> = {
  title: "Client/Commitments/PromiseRow",
  component: PromiseRow,
  tags: ["autodocs", "storybook-ci"],
  globals: { viewport: { value: "mobile" } },
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
type Story = StoryObj<typeof PromiseRow>;

export const ProviderNeedsYou: Story = {
  args: { row: row() },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("button", { name: /3 hours/ })).toBeVisible();
    await expect(canvas.getByText("Needs you")).toBeVisible();
  },
};

/** Named, with nothing waiting on the reader and no seat: the units live on the promise. */
export const Named: Story = {
  args: { row: row({ seat: null, needsYou: false }), title: "Compost delivery to the beds" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Compost delivery to the beds")).toBeVisible();
    await expect(canvas.queryByText("3 hours")).not.toBeInTheDocument();
    await expect(canvas.getByText("In progress")).toBeVisible();
  },
};

/**
 * One 88px row whatever it says: a long title keeps one line and shows in full on hover,
 * with the pill under it and the due date and the other person on the line below.
 */
export const LongTitleNeedsYou: Story = {
  args: {
    row: row({
      commitment: commitment({ direction: "REQUEST", creator: OTHER, counterparty: OTHER }),
    }),
    title: "Repair the north fence panel by the compost bays before the first frost",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rowElement = canvas.getByRole("button", { name: /Repair the north fence panel/ });
    await expect(rowElement.getBoundingClientRect().height).toBe(88);
    const titleElement = within(rowElement).getByText(/Repair the north fence panel/);
    await expect(titleElement).toHaveAttribute("title", expect.stringContaining("first frost"));
    await expect(within(rowElement).getByRole("status").getBoundingClientRect().height).toBe(22);
    await expect(canvas.getByText("Needs you")).toBeVisible();
    await expectItemRowsFit(canvasElement);
  },
};

/** A request leads with the helping hand, named for screen readers; its edge follows its pill. */
export const Request: Story = {
  args: {
    row: row({
      commitment: commitment({
        direction: "REQUEST",
        derivedState: "REQUESTED",
        onchainState: "REQUESTED",
        unitLabel: "rides",
      }),
      needsYou: false,
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rowElement = canvas.getByRole("button", { name: /3 rides/ });
    await expect(rowElement).toHaveAttribute("data-direction", "REQUEST");
    await expect(within(rowElement).getByRole("img", { name: "Request" })).toBeVisible();
    await expect(rowElement).toHaveAttribute("data-edge", "info");
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
    // Team size and how the reader helps live on the promise; the row names the lead.
    const canvas = within(canvasElement);
    await expect(canvas.getByText("0x22...222")).toBeVisible();
    await expect(canvas.queryByText("You are helping with this")).not.toBeInTheDocument();
    await expect(canvas.queryByText("3 people on the team")).not.toBeInTheDocument();
  },
};

/** A send that gave up replaces the state in the pill, and outranks Needs you. */
export const SendFailed: Story = {
  args: { row: row({ needsYou: true }), sendFailed: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Didn't send")).toBeVisible();
    await expect(canvas.queryByText("Needs you")).not.toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /3 hours/ })).toHaveAttribute(
      "data-edge",
      "error"
    );
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
                <PromiseRow
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

const DUE = BigInt(Math.floor(Date.UTC(2026, 9, 24, 15) / 1000));
const catalogs = { en: enMessages, es: esMessages, pt: ptMessages } as const;

/** What a garden's To confirm tab shows: what kind of ask it is leads the details. */
export const ToConfirm: Story = {
  args: {
    row: row({
      commitment: commitment({ creator: OTHER, leadProvider: OTHER, dueDate: DUE }),
      seat: "confirmer",
      needsYou: true,
    }),
    title: "Repair the drip line",
    kind: "Garden claim",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Garden claim")).toBeVisible();
    await expect(canvas.getByText("Needs you")).toBeVisible();
  },
};

/**
 * Every seat and state at the app's phone columns (320, 360 and 390px phones) in English,
 * Spanish and Portuguese: each row 88px, and every detail whole or dropped whole.
 */
export const FitsEveryLanguage: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => (
    <div className="flex flex-col gap-8">
      {(Object.keys(catalogs) as (keyof typeof catalogs)[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={catalogs[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            {[288, 328, 358].map((width) => (
              <div key={width} className="flex flex-col gap-(--gg-list-gap)" style={{ width }}>
                <PromiseRow
                  row={row({ commitment: commitment({ dueDate: DUE }) })}
                  title="Water the seedlings weekly until the first rains"
                  onOpen={() => {}}
                />
                <PromiseRow
                  row={row({
                    commitment: commitment({
                      direction: "REQUEST",
                      creator: OTHER,
                      leadProvider: VIEWER,
                      counterparty: VIEWER,
                      derivedState: "EVIDENCE_SUBMITTED",
                      dueDate: DUE,
                    }),
                    seat: "provider",
                    needsYou: false,
                  })}
                  title="Repair the drip line on the north beds"
                  onOpen={() => {}}
                />
                <PromiseRow
                  row={row({ commitment: commitment({ dueDate: DUE }), needsYou: false })}
                  title="Run a composting workshop"
                  sendFailed
                  onOpen={() => {}}
                />
                <PromiseRow
                  row={row({
                    commitment: commitment({
                      creator: OTHER,
                      leadProvider: OTHER,
                      derivedState: "FULFILLED",
                      onchainState: "FULFILLED",
                      dueDate: DUE,
                    }),
                    seat: "contributor",
                    needsYou: false,
                  })}
                  title="Turn the compost bays"
                  onOpen={() => {}}
                />
              </div>
            ))}
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
  },
};
