import {
  type ServiceOfferLine,
  useServiceOfferLines,
} from "@green-goods/shared/commitment-pooling";
import { useGardenPoolController } from "@green-goods/shared/hooks/client-ui/pool/useGardenPoolController";
import enMessages from "@green-goods/shared/i18n/en";
import esMessages from "@green-goods/shared/i18n/es";
import ptMessages from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, mocked } from "storybook/test";
import {
  gardenPoolControllerFixture,
  JOURNEY_CYCLE_NAMES,
  JOURNEY_POOL,
  LIVE_PROMISES,
} from "../../../../../../shared/.storybook/clientJourneyFixtures";
import {
  withAppPage,
  withRouter,
  withSeededQueryClient,
} from "../../../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";
import { GardenPool } from "./GardenPool";

type Lang = "en" | "es" | "pt";
const MESSAGES = { en: enMessages, es: esMessages, pt: ptMessages } as const;
/** The lab's SServices states that slice 2 adds: members' services, then an issuer paused or delisted. */
type ServicesState = "browse" | "issuerPaused" | "delisted";

const OFFERED = LIVE_PROMISES[2]!;
const REQUESTED = LIVE_PROMISES[1]!;

/** An approval-gated individual offer, the kind of promise the tab reads a service from. */
function service(commitmentId: bigint, title: string) {
  return {
    title,
    row: {
      ...OFFERED.row,
      commitment: {
        ...OFFERED.row.commitment,
        id: `42161-${commitmentId}`,
        commitmentId,
        metadataCID: `bafy-service-${commitmentId}`,
        claimMode: "APPROVAL_GATED" as const,
        claimType: "INDIVIDUAL" as const,
        targetUnits: 1n,
        unitLabel: null,
      },
    },
  };
}

/** The lab's list: Teo's lesson, Maya's coaching and Tech and Sun's hub day, then a request. */
const ROWS = [
  service(61n, "Integration lesson, 60 minutes"),
  service(62n, "Measurement coaching, 60 minutes"),
  service(63n, "Hub day, up to 4 hours"),
  REQUESTED,
];
const VOUCHER = 1_000_000n;

/** What the reads make of each service for a visitor holding 1 Teo voucher and 9 of Tech and Sun's. */
function serviceLines(state: ServicesState): ReadonlyMap<string, ServiceOfferLine> {
  return new Map<string, ServiceOfferLine>([
    [
      "61",
      {
        promisedBy: "Teo Alves",
        booking:
          state === "issuerPaused"
            ? { kind: "paused" }
            : { kind: "hold", held: VOUCHER, decimals: 6 },
      },
    ],
    [
      "62",
      {
        promisedBy: "Maya Ruiz",
        booking: state === "delisted" ? { kind: "delisted" } : { kind: "exchange" },
      },
    ],
    [
      "63",
      { promisedBy: "Tech and Sun", booking: { kind: "hold", held: 9n * VOUCHER, decimals: 6 } },
    ],
  ]);
}

function ServicesTab({ state, lang }: { state: ServicesState; lang: Lang }) {
  mocked(useGardenPoolController).mockReturnValue(
    gardenPoolControllerFixture(ROWS, { canCreate: false })
  );
  mocked(useServiceOfferLines).mockReturnValue(serviceLines(state));
  return (
    <IntlProvider key={lang} locale={lang} messages={MESSAGES[lang]}>
      <div className="min-h-dvh bg-bg-canvas px-4 pb-24 pt-3">
        <GardenPool pool={JOURNEY_POOL} />
      </div>
    </IntlProvider>
  );
}

/**
 * Services on a garden's Promises tab as a visitor reads them (PRD-1299 surface 5, slice 2): a
 * member's own service sits on the same row as a garden's, its line saying what booking takes
 * first and then the member who promises delivery. An issuer that paused bookings, or whose
 * vouchers left the exchange pool, keeps its row, and the reason takes the booking's place.
 * Pick the language with `lang`. Fictional people and amounts from the design lab.
 */
const meta: Meta<typeof ServicesTab> = {
  title: "Client/Commitments/GardenPool Services",
  component: ServicesTab,
  tags: ["storybook-ci"],
  globals: { viewport: { value: "mobile" } },
  parameters: { layout: "fullscreen" },
  decorators: [
    withSeededQueryClient(JOURNEY_CYCLE_NAMES),
    withRouter(["/home/garden"]),
    withAppPage,
  ],
  beforeEach: () => resetHookMocks(useGardenPoolController, useServiceOfferLines),
  argTypes: {
    state: { control: false },
    lang: { control: "inline-radio", options: ["en", "es", "pt"] },
  },
  args: { lang: "en" },
};
export default meta;
type Story = StoryObj<typeof ServicesTab>;

/** Each service's line as shown, booking first: the details a row keeps on its one line. */
function shownLines(canvasElement: HTMLElement): (string | null)[][] {
  return [...canvasElement.querySelectorAll<HTMLElement>('[data-service="offer"]')].map((row) => {
    const box = row.querySelector(".gg-item-row-details")?.getBoundingClientRect();
    return [...row.querySelectorAll<HTMLElement>(".gg-item-row-detail")]
      .filter((detail) => box && detail.getBoundingClientRect().top < box.bottom - 1)
      .map((detail) => detail.textContent);
  });
}

const playLines =
  (state: ServicesState): Story["play"] =>
  async ({ canvasElement, args }) => {
    const words = MESSAGES[args.lang] as Record<string, string>;
    const say = (kind: ServiceOfferLine["booking"]["kind"], count = "") =>
      words[`app.commitments.row.service.${kind}`]!.replace("{count}", count);
    await expect(shownLines(canvasElement)).toEqual([
      [state === "issuerPaused" ? say("paused") : say("hold", "1"), "Teo Alves"],
      [state === "delisted" ? say("delisted") : say("exchange"), "Maya Ruiz"],
      [say("hold", "9"), "Tech and Sun"],
    ]);
    // A reason reads as one the reader acts on; a booking line stays plain.
    const reasons = [
      ...canvasElement.querySelectorAll('[data-service="offer"] [data-tone="error"]'),
    ].map((detail) => detail.textContent);
    await expect(reasons).toEqual(
      state === "browse" ? [] : [say(state === "issuerPaused" ? "paused" : "delisted")]
    );
  };

/** Teo's lesson the visitor can redeem, Maya's coaching to exchange for first, and a hub day. */
export const Browse: Story = { args: { state: "browse" }, play: playLines("browse") };

/** Teo paused his bookings: no new booking starts, though he still promises the lesson. */
export const IssuerPaused: Story = {
  args: { state: "issuerPaused" },
  play: playLines("issuerPaused"),
};

/** Maya's vouchers left the exchange pool: there is nothing to exchange for first. */
export const Delisted: Story = { args: { state: "delisted" }, play: playLines("delisted") };
