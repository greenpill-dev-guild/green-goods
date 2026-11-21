import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { withRouter } from "../../../../shared/.storybook/decorators";
import { gardenPassportFixture } from "../../__tests__/fixtures/gardenPassport";
import { GardenPassportRecord } from "./GardenPassportRecord";

const full = gardenPassportFixture();

const meta: Meta<typeof GardenPassportRecord> = {
  title: "Client/Public/GardenPassport",
  component: GardenPassportRecord,
  tags: ["autodocs"],
  args: {
    passport: full,
    onRetry: () => {},
    gardenHref: "/gardens/riverside-garden",
    fundHref: "/fund?garden=riverside-garden",
  },
  decorators: [
    (Story) => (
      <div className="bg-bg-weak-50 px-6 py-16 sm:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-16">
          <Story />
        </div>
      </div>
    ),
    withRouter(["/gardens/riverside-garden/passport"]),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "A garden's passport for funders (DL-201): one sentence, then Promised, Supported, " +
          "Delivered and Still to deliver, then vouchers and G$. Every figure here is an invented " +
          "fixture. The public page shows live records only and never these numbers.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

/** Every line with something on it, in a record large enough to publish each split. */
export const FullRecord: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("heading", { name: "Still to deliver" })).toBeVisible();
    const still = within(canvas.getByRole("group", { name: "Still to deliver" }));
    await expect(still.getByText("7 of 12")).toBeVisible();
    // Where a figure comes from is one press away, and closed until asked for.
    const source = still.getByText("Where this comes from");
    await expect(source.closest("details")).not.toHaveAttribute("open");
  },
};

/** A small record: no split that could point at one person, and member payments held back. */
export const SmallRecord: Story = {
  args: {
    passport: gardenPassportFixture({
      promises:
        full.promises.status === "available"
          ? {
              ...full.promises,
              value: {
                ...full.promises.value,
                breakdown: null,
                units: full.promises.value.units.map((unit) => ({
                  ...unit,
                  stillToDeliver: null,
                  notDelivered: null,
                })),
              },
            }
          : full.promises,
      vouchers:
        full.vouchers.status === "available"
          ? {
              ...full.vouchers,
              value: {
                ...full.vouchers.value,
                earned: { withheld: true },
                bookings: { withheld: true },
              },
            }
          : full.vouchers,
      settlement:
        full.settlement.status === "available"
          ? {
              ...full.settlement,
              value: { ...full.settlement.value, memberPayments: { withheld: true } },
            }
          : full.settlement,
    }),
  },
};

/** A garden whose pool has just opened: every line says nothing is on record yet. */
export const NothingYet: Story = {
  args: {
    fundHref: undefined,
    passport: gardenPassportFixture({
      promises: {
        status: "available",
        asOf: null,
        value: {
          since: null,
          made: 0,
          takenUp: 0,
          due: 0,
          kept: 0,
          unresolved: 0,
          breakdown: null,
          standingOffers: 0,
          units: [],
        },
      },
      vouchers: {
        status: "available",
        asOf: null,
        value: {
          offersBookable: 0,
          capacityOnOffer: [],
          earned: {
            withheld: false,
            promisesWithApprovedTerms: 0,
            recorded: 0,
            issued: 0,
            failed: 0,
            awaiting: 0,
            tracedToKeptPromise: 0,
            confirmedByOwnConfirmers: 0,
            confirmedByFallback: 0,
          },
          bookings: {
            withheld: false,
            requested: 0,
            accepted: 0,
            declined: 0,
            settled: 0,
            transfersFailed: 0,
            services: [],
            vouchers: [],
          },
        },
      },
      settlement: {
        status: "available",
        asOf: null,
        value: {
          keptAwaitingPaymentPlan: 0,
          support: { payments: { confirmed: 0, awaiting: 0, failed: 0, cancelled: 0 }, lines: [] },
          memberPayments: {
            withheld: false,
            plans: 0,
            plansFinalized: 0,
            plansRevised: 0,
            payments: { confirmed: 0, awaiting: 0, failed: 0, cancelled: 0 },
            declared: [],
            lines: [],
          },
        },
      },
    }),
  },
};

/** Sources that could not be read say so and offer the read again. Unknown is never zero. */
export const SourcesUnavailable: Story = {
  args: {
    passport: gardenPassportFixture({
      vouchers: { status: "unavailable" },
      settlement: { status: "unavailable" },
      partialData: true,
      unavailableSources: { promises: false, vouchers: true, settlement: true },
    }),
  },
};
