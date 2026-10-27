import { RiDeleteBinLine, RiSendPlaneLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { expect, fn, userEvent, within } from "storybook/test";
import { expectItemRowsFit } from "../../../../.storybook/itemRowFit";
import enMessages from "../../../i18n/en.json";
import esMessages from "../../../i18n/es.json";
import ptMessages from "../../../i18n/pt.json";
import type { Address } from "../../../types/domain";
import { IconButton } from "../../IconButton";
import { CommitmentRow, type CommitmentRowProps } from "./CommitmentRow";

const MARIA = "0x2222222222222222222222222222222222222222" as Address;
const TOMI = "0x1111111111111111111111111111111111111111" as Address;
const taken = {
  direction: "OFFER" as const,
  creator: TOMI,
  leadProvider: TOMI,
  counterparty: MARIA,
};

const offer: CommitmentRowProps = {
  direction: "OFFER",
  title: "Water the seedlings weekly",
  status: { label: "In progress", tone: "info" },
  due: { text: "due 24 Oct", dateTime: "2026-10-24T15:00:00.000Z", title: "October 24, 2026" },
  party: { commitment: taken, seat: "provider" },
};

/** One column of rows at a phone's list width, the way a list stacks them (12px apart). */
function Column({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-(--gg-list-gap)" style={{ width }}>
      {children}
    </div>
  );
}

const queueActs = (
  <span className="flex items-center gap-1">
    <IconButton aria-label="Discard" icon={<RiDeleteBinLine aria-hidden="true" />} />
    <IconButton
      emphasis="primary"
      aria-label="Send Now"
      icon={<RiSendPlaneLine aria-hidden="true" />}
    />
  </span>
);

/** Every list shows these: a promise in each state and each queue or act state. */
function EveryState() {
  return (
    <>
      <CommitmentRow {...offer} onOpen={fn()} />
      <CommitmentRow
        {...offer}
        direction="REQUEST"
        title="Repair the drip line on the north beds"
        status={{ label: "Needs you", tone: "warning" }}
        party={{ commitment: { ...taken, direction: "REQUEST" }, seat: "confirmer" }}
        onOpen={fn()}
      />
      <CommitmentRow {...offer} title="Run a composting workshop" pending="confirming" />
      <CommitmentRow
        {...offer}
        title="Help turning the compost bays"
        pending="notSent"
        note="Saved on this phone. It waits here until you send it, and appears here once it lands."
        party={null}
        action={queueActs}
      />
      <CommitmentRow
        {...offer}
        title="Bring seedlings to the market"
        pending="sendFailed"
        onOpen={fn()}
      />
      <CommitmentRow
        {...offer}
        direction="REQUEST"
        title="Household water survey"
        status={{ label: "4 available", tone: "info" }}
        party={null}
        group={{ size: 10, counts: "3 in progress, 3 kept" }}
        onOpen={fn()}
      />
    </>
  );
}

const meta: Meta<typeof CommitmentRow> = {
  title: "Shared/Cards/CommitmentRow",
  component: CommitmentRow,
  tags: ["autodocs", "storybook-ci"],
  args: { ...offer, onOpen: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "One promise in a list on both surfaces (DL-110): the shared item row led by the offer or request icon, its one pill (the state in the surface's words, or a queue or act state: Confirming…, Not sent, Didn't send), and the due date, then the other person, on the detail line. Copies made together are one row with their number on the tile.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof CommitmentRow>;

/** An offer someone took up, read by the one who offered it: the taker is the other person. */
export const Default: Story = {
  render: (args) => (
    <Column width={358}>
      <CommitmentRow {...args} />
    </Column>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole("button");
    await expect(row).toHaveAccessibleName(
      /Offer.*Water the seedlings weekly.*In progress.*due 24 Oct.*0x22\.\.\.222/
    );
    await expect(row).toHaveAttribute("data-edge", "info");
    await userEvent.click(row);
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
    await expectItemRowsFit(canvasElement);
  },
};

/** A queue or act state takes the pill's place; its words lead the details while it lasts. */
export const QueueAndActStates: Story = {
  render: () => (
    <Column width={358}>
      <EveryState />
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Confirming…")).toBeVisible();
    await expect(canvas.getByText("Not sent")).toBeVisible();
    await expect(canvas.getByText("Didn't send")).toBeVisible();
    await expect(canvas.getByText("In progress")).toBeVisible();
    const notSent = canvasElement.querySelector('[data-pending="notSent"]') as HTMLElement;
    await expect(notSent).toHaveAttribute("data-edge", "warning");
    await expect(within(notSent).getByRole("button", { name: "Send Now" })).toBeVisible();
    // A group carries its number on the tile, and names it for screen readers.
    await expect(canvas.getByText("A group of 10 separate promises")).toBeInTheDocument();
    await expectItemRowsFit(canvasElement);
  },
};

/** The same rows at the app's density and the cockpit's: 15px and 13px titles, one height. */
export const Densities: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8">
      <section className="flex flex-col gap-2">
        <h3 className="type-label-sm text-text-sub-600">Installed app</h3>
        <Column width={358}>
          <EveryState />
        </Column>
      </section>
      <section className="flex flex-col gap-2" data-surface-scope="admin">
        <h3 className="type-label-sm text-text-sub-600">Cockpit</h3>
        <Column width={366}>
          <EveryState />
        </Column>
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
    const [app, cockpit] = [...canvasElement.querySelectorAll<HTMLElement>("section")];
    const titleSize = (section: HTMLElement) =>
      getComputedStyle(section.querySelector(".gg-item-row-title") as HTMLElement).fontSize;
    await expect(titleSize(app)).toBe("15px");
    await expect(titleSize(cockpit)).toBe("13px");
  },
};

const catalogs = { en: enMessages, es: esMessages, pt: ptMessages } as const;

/**
 * Every state at the app's phone columns (320, 360 and 390px phones) in English, Spanish and
 * Portuguese: each row 88px, and every detail whole or dropped whole.
 */
export const FitsEveryLanguage: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => (
    <div className="flex flex-col gap-8">
      {(Object.keys(catalogs) as (keyof typeof catalogs)[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={catalogs[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            {[288, 328, 358].map((width) => (
              <Column key={width} width={width}>
                <EveryState />
              </Column>
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

/**
 * Services on a garden's list of promises (PRD-1299, surface 5): an offer says what booking takes
 * first, then who promises delivery, in the due date's and the person's places. One pill, one
 * height, and the right slot as on any row; no amount or voucher badge. The lab's services, in
 * each language at the list's width on a 320px and a 390px phone.
 */
function ServiceRows() {
  const { formatMessage } = useIntl();
  const hold = formatMessage({ id: "app.commitments.row.service.hold" }, { count: "9" });
  const exchange = formatMessage({ id: "app.commitments.row.service.exchange" });
  const offered = { label: "Offered", tone: "info" as const };
  return (
    <>
      <CommitmentRow
        direction="OFFER"
        title="Hub day at Tech and Sun"
        status={offered}
        service={{ booking: hold, promisedBy: "Tech and Sun" }}
        onOpen={fn()}
      />
      <CommitmentRow
        direction="OFFER"
        title="Claude access, one month"
        status={offered}
        service={{ booking: exchange, promisedBy: "Green Goods" }}
        onOpen={fn()}
      />
      <CommitmentRow {...offer} direction="REQUEST" title="Help build the seed library shelves" />
    </>
  );
}

export const ServiceOffers: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => (
    <div className="flex flex-col gap-8">
      {(Object.keys(catalogs) as (keyof typeof catalogs)[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={catalogs[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            {[288, 358].map((width) => (
              <Column key={width} width={width}>
                <ServiceRows />
              </Column>
            ))}
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
    const words = {
      en: ["You hold 9", "Exchange first"],
      es: ["Tienes 9", "Cambia primero"],
      pt: ["Você tem 9", "Troque primeiro"],
    } as const;
    for (const section of canvasElement.querySelectorAll<HTMLElement>("[data-locale]")) {
      const [hold, exchange] = words[section.dataset.locale as keyof typeof words];
      const services = [...section.querySelectorAll<HTMLElement>('[data-service="offer"]')];
      await expect(services).toHaveLength(4);
      for (const row of services) {
        const line = row.querySelector<HTMLElement>(".gg-item-row-details");
        const lineBox = line?.getBoundingClientRect();
        // Both details sit whole on the line at either width: booking first, then the issuer.
        const shown = [...row.querySelectorAll<HTMLElement>(".gg-item-row-detail")].filter(
          (detail) => lineBox && detail.getBoundingClientRect().top < lineBox.bottom - 1
        );
        await expect(shown.map((detail) => detail.textContent)).toEqual(
          row.textContent?.includes("Hub day") ? [hold, "Tech and Sun"] : [exchange, "Green Goods"]
        );
      }
    }
  },
};

/** The member services the lab lists: one booking line each, then the member who delivers. */
const MEMBER_SERVICES = [
  { title: "Integration lesson, 60 minutes", by: "Teo Alves", line: "hold" },
  { title: "Measurement coaching, 60 minutes", by: "Maya Ruiz", line: "exchange" },
  { title: "Integration lesson, 60 minutes", by: "Teo Alves", line: "paused" },
  { title: "Measurement coaching, 60 minutes", by: "Maya Ruiz", line: "delisted" },
] as const;

function MemberServiceRows() {
  const { formatMessage } = useIntl();
  const booking = (line: (typeof MEMBER_SERVICES)[number]["line"]) =>
    line === "hold"
      ? formatMessage({ id: "app.commitments.row.service.hold" }, { count: "1" })
      : line === "exchange"
        ? formatMessage({ id: "app.commitments.row.service.exchange" })
        : {
            text: formatMessage({ id: `app.commitments.row.service.${line}` }),
            tone: "error" as const,
          };
  return (
    <>
      {MEMBER_SERVICES.map(({ title, by, line }) => (
        <CommitmentRow
          key={`${title}:${line}`}
          direction="OFFER"
          title={title}
          status={{ label: "Offered", tone: "info" }}
          service={{ booking: booking(line), promisedBy: by }}
          onOpen={fn()}
          data-line={line}
        />
      ))}
    </>
  );
}

/**
 * A member's own service on the same row (slice 2): Teo's lesson the reader can redeem, Maya's
 * coaching to exchange for first, then each after its issuer paused bookings or left the
 * exchange pool. The reason takes the booking's place, marked as one to act on, and the member
 * who promises delivery stays whole on the line in each language at both phone widths.
 */
export const MemberServiceOffers: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => (
    <div className="flex flex-col gap-8">
      {(Object.keys(catalogs) as (keyof typeof catalogs)[]).map((locale) => (
        <IntlProvider key={locale} locale={locale} messages={catalogs[locale]}>
          <section className="flex flex-wrap items-start gap-4" data-locale={locale}>
            {[288, 358].map((width) => (
              <Column key={width} width={width}>
                <MemberServiceRows />
              </Column>
            ))}
          </section>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
    for (const section of canvasElement.querySelectorAll<HTMLElement>("[data-locale]")) {
      const words = catalogs[section.dataset.locale as keyof typeof catalogs] as Record<
        string,
        string
      >;
      const lineText = {
        hold: words["app.commitments.row.service.hold"]!.replace("{count}", "1"),
        exchange: words["app.commitments.row.service.exchange"],
        paused: words["app.commitments.row.service.paused"],
        delisted: words["app.commitments.row.service.delisted"],
      };
      const rows = [...section.querySelectorAll<HTMLElement>('[data-service="offer"]')];
      await expect(rows).toHaveLength(MEMBER_SERVICES.length * 2);
      for (const row of rows) {
        const spec = MEMBER_SERVICES.find(
          ({ title, line }) => row.dataset.line === line && row.textContent?.includes(title)
        );
        const line = row.querySelector<HTMLElement>(".gg-item-row-details");
        const lineBox = line?.getBoundingClientRect();
        const shown = [...row.querySelectorAll<HTMLElement>(".gg-item-row-detail")].filter(
          (detail) => lineBox && detail.getBoundingClientRect().top < lineBox.bottom - 1
        );
        await expect(shown.map((detail) => detail.textContent)).toEqual([
          spec && lineText[spec.line],
          spec?.by,
        ]);
        const reason = spec?.line === "paused" || spec?.line === "delisted";
        await expect(shown[0]?.dataset.tone).toBe(reason ? "error" : undefined);
      }
    }
  },
};
