// @vitest-environment happy-dom
import type { PublicGardenPassportRecord } from "@green-goods/shared/commitment-pooling/public";
import messages from "@green-goods/shared/i18n/en.json";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const { detail, passport, refetch } = vi.hoisted(() => ({
  detail: vi.fn(),
  passport: vi.fn(),
  refetch: vi.fn(),
}));
vi.mock("@green-goods/shared/hooks/public/usePublicGardenDetail", () => ({
  usePublicGardenDetail: detail,
}));
vi.mock("@green-goods/shared/commitment-pooling/public", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@green-goods/shared/commitment-pooling/public")>()),
  usePublicGardenPassport: passport,
}));
vi.mock("@green-goods/shared/config/default-chain", () => ({ DEFAULT_CHAIN_ID: 42161 }));
vi.mock("../../components/Public/PublicFooter", () => ({ PublicFooter: () => null }));
vi.mock("../../components/Public/PublicEditorialHero", () => ({
  PublicEditorialHero: ({ title, actions }: { title: ReactNode; actions?: ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {actions}
    </header>
  ),
}));

import { PublicGardenRow } from "../../components/Public/PublicGardenRow";
import GardenPassport from "../../views/Public/GardenPassport";
import { gardenPassportFixture, PASSPORT_FIXTURE_GARDEN } from "../fixtures/gardenPassport";

const GARDEN = PASSPORT_FIXTURE_GARDEN;
const record = gardenPassportFixture;
const G = 10n ** 18n;

function show(
  state: { published?: boolean; passport?: PublicGardenPassportRecord; isError?: boolean } = {},
  garden: unknown = { garden: { id: GARDEN, name: "Riverside Garden" }, unlisted: false }
) {
  detail.mockReturnValue({
    data: garden ?? undefined,
    isLoading: false,
    isError: garden === null,
    refetch,
  });
  passport.mockReturnValue({
    published: state.published ?? true,
    passport: state.passport,
    isPending: false,
    isError: state.isError ?? false,
    refetch,
  });
  return render(
    <IntlProvider locale="en" messages={messages}>
      <MemoryRouter initialEntries={[`/gardens/${GARDEN}/passport`]}>
        <Routes>
          <Route path="/gardens/:id/passport" element={<GardenPassport />} />
        </Routes>
      </MemoryRouter>
    </IntlProvider>
  );
}

const line = (name: string) => screen.getByRole("group", { name });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("a garden's public passport", () => {
  it("opens on one sentence and four lines a funder can read in order", () => {
    show({ passport: record() });

    expect(
      screen.getByRole("heading", { name: "Passport of Riverside Garden", level: 1 })
    ).toBeInTheDocument();
    // One paragraph, read as one sentence, whatever elements it is built from.
    expect(screen.getByTestId("passport-sentence")).toHaveTextContent(
      /neighbors have taken up 8 promises in this garden\. 4 are kept, and 3 are still to deliver\. 1 was not kept\. 7,200 G\$ in support has reached the garden\./
    );
    expect(
      screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)
    ).toEqual(expect.arrayContaining(["Promised", "Supported", "Delivered", "Still to deliver"]));

    expect(within(line("Promised")).getByText("8 promises taken up")).toBeInTheDocument();
    expect(within(line("Supported")).getByText("7,200 G$ received")).toBeInTheDocument();
    expect(
      within(line("Supported")).getByText("40 G$ sent and not yet confirmed.")
    ).toBeInTheDocument();
    expect(within(line("Delivered")).getByText("4 promises kept")).toBeInTheDocument();
    expect(within(line("Delivered")).getByText("3 of 12")).toBeInTheDocument();
    // Each unit keeps its own row: 12 hub days and 5 workshops are never 17 of anything.
    expect(screen.queryByText(/17/)).not.toBeInTheDocument();

    const still = within(line("Still to deliver"));
    expect(still.getByText("3 promises still to deliver")).toBeInTheDocument();
    expect(still.getByText("7 of 12")).toBeInTheDocument();
    expect(still.getByText(/Not kept: 1 promise whose term ended/)).toBeInTheDocument();
    expect(still.getByText("2 of 12")).toBeInTheDocument();
    // Past its due date but not closed on the record: still open, and said to be late.
    expect(
      still.getByText(/1 is past its due date and has not been confirmed/)
    ).toBeInTheDocument();
    // Workshops are all delivered, so they are not listed as still to deliver.
    expect(still.queryByText("workshops")).not.toBeInTheDocument();

    // Every ledger line says how fresh it is and where it comes from.
    expect(within(line("Promised")).getByText(/Last change on record/)).toBeInTheDocument();
    expect(screen.getAllByText("Where this comes from").length).toBeGreaterThanOrEqual(4);
    cleanup();

    // Promises taken up and later released are off the record. They were still taken up, so
    // the page does not say that nobody took one up.
    const full = record();
    if (full.promises.status !== "available") throw new Error("the fixture must be readable");
    show({
      passport: record({
        promises: {
          ...full.promises,
          value: { ...full.promises.value, takenUp: 2, due: 0, kept: 0, unresolved: 0, units: [] },
        },
      }),
    });
    expect(screen.getByTestId("passport-sentence")).toHaveTextContent(
      "This garden has no promises to keep right now."
    );
    expect(
      within(line("Promised")).getByText("No promise is waiting to be kept right now.")
    ).toBeInTheDocument();
    expect(screen.queryByText(/taken up a promise|has been taken up yet/)).not.toBeInTheDocument();
  });

  it("keeps vouchers and G$ apart, each in its own unit, and a declared amount unpaid", () => {
    show({ passport: record() });

    expect(
      within(line("On offer")).getByText("2 offers can be booked with a voucher")
    ).toBeInTheDocument();
    expect(
      within(line("Earned through work")).getByText("3 voucher awards issued")
    ).toBeInTheDocument();
    expect(within(line("Bought")).getByText("No vouchers bought.")).toBeInTheDocument();
    const used = within(line("Used for services"));
    expect(
      used.getByText("3 bookings: 2 accepted, 1 ended before the service started")
    ).toBeInTheDocument();
    // Delivery is what the holder approved, not the vouchers that moved.
    expect(used.getByText("20 of 60")).toBeInTheDocument();
    expect(used.getByText("7 GGV")).toBeInTheDocument();
    // What the pool holds, the most it may hold and what is outstanding are three sentences.
    const pool = within(line("In the exchange pool"));
    expect(pool.getByText("10 GGV in the Riverside exchange pool")).toBeInTheDocument();
    expect(pool.getByText("The pool may hold 40 GGV at most.")).toBeInTheDocument();
    expect(pool.getByText(/^10 GGV outstanding\. .* none is with a holder\.$/)).toBeInTheDocument();
    expect(pool.getByText(/As read on/)).toBeInTheDocument();

    const members = within(line("Paid to members"));
    expect(members.getByText("3 payments confirmed")).toBeInTheDocument();
    // 120 G$ declared for members, 60 confirmed: 60 is declared and not yet paid.
    const declared = members.getByText("Declared, not yet paid").closest("div");
    expect(declared).toHaveTextContent("60 G$");
    // Recorded is not sent: the 25 G$ waiting to go out is never shown as on its way.
    expect(members.getByText("Recorded, not yet sent").closest("div")).toHaveTextContent("25 G$");
    expect(members.getByText("Sent, not yet confirmed").closest("div")).toHaveTextContent("0 G$");
    expect(members.getByText("Declared in payment plans").closest("div")).toHaveTextContent(
      "120 G$"
    );
    // A kept promise with its payment only declared may be due to members or to a garden.
    expect(
      screen.getByText(/1 kept promise declares a G\$ payment that has no payment plan yet/)
    ).toBeInTheDocument();
    // G$ only: no figure is converted to another currency.
    expect(document.body.textContent).not.toMatch(/USD|US\$|(?<!G)\$\d/);
  });

  it("holds back figures that would point at a person, and says a failed source failed", () => {
    const base = record();
    if (
      base.promises.status !== "available" ||
      base.vouchers.status !== "available" ||
      base.settlement.status !== "available"
    ) {
      throw new Error("the fixture must be a readable record");
    }
    const small = {
      ...base.promises,
      value: {
        ...base.promises.value,
        breakdown: null,
        units: base.promises.value.units.map((unit) => ({
          ...unit,
          stillToDeliver: null,
          notDelivered: null,
        })),
      },
    };
    const members = base.settlement.value.memberPayments;
    if (members.withheld || base.vouchers.value.bookings.withheld) {
      throw new Error("the fixture must publish its groups");
    }
    show({
      passport: record({
        promises: small,
        vouchers: { status: "unavailable" },
        settlement: {
          ...base.settlement,
          value: { ...base.settlement.value, memberPayments: { withheld: true } },
        },
      }),
    });

    // A small record does not say which unresolved promise lapsed, in its lines or its sentence.
    const still = within(line("Still to deliver"));
    expect(still.getByText("4 promises not yet kept")).toBeInTheDocument();
    expect(still.getByText("9 of 12")).toBeInTheDocument();
    expect(still.queryByText(/Not kept:/)).not.toBeInTheDocument();
    expect(screen.getByTestId("passport-sentence")).toHaveTextContent(/4 are not yet kept\./);
    expect(screen.getByTestId("passport-sentence")).not.toHaveTextContent(/still to deliver/);
    expect(
      within(line("Paid to members")).getByText(/Too few members have been paid/)
    ).toBeInTheDocument();

    // The voucher read failed: its lines say so and offer the read again, never a zero.
    const earned = within(line("Earned through work"));
    expect(
      earned.getByText("This part of the record could not be read just now.")
    ).toBeInTheDocument();
    expect(earned.queryByText("No vouchers issued yet.")).not.toBeInTheDocument();
    fireEvent.click(earned.getByRole("button", { name: "Try Again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    cleanup();

    // Enough people overall, but one amount covers fewer than three: counts stay, amounts wait.
    show({
      passport: record({
        promises: {
          ...base.promises,
          value: {
            ...base.promises.value,
            breakdown: { ...base.promises.value.breakdown!, stillOpen: 0, notKept: 4 },
          },
        },
        vouchers: {
          ...base.vouchers,
          value: {
            ...base.vouchers.value,
            bookings: { ...base.vouchers.value.bookings, amounts: null },
          },
        },
        settlement: {
          ...base.settlement,
          value: {
            ...base.settlement.value,
            memberPayments: { ...members, lines: null, declaredUnpaid: null },
            support: {
              ...base.settlement.value.support,
              // Past what a floating-point number holds exactly: it must print as recorded.
              lines: [
                { ...base.settlement.value.support.lines[0]!, confirmed: 9007199254740993n * G },
              ],
            },
          },
        },
      }),
    });
    const paid = within(line("Paid to members"));
    expect(paid.getByText(/Amounts by outcome are held back/)).toBeInTheDocument();
    expect(paid.getByText("Confirmed as arrived").closest("div")).toHaveTextContent("3 payments");
    expect(paid.getByText("Declared in payment plans").closest("div")).toHaveTextContent("120 G$");
    expect(paid.queryByText(/60 G\$/)).not.toBeInTheDocument();
    const booked = within(line("Used for services"));
    expect(booked.getByText(/Unit figures are held back/)).toBeInTheDocument();
    expect(booked.queryByText("7 GGV")).not.toBeInTheDocument();
    // Nothing open and four lapsed is not "0 promises still to deliver".
    const lapsed = within(line("Still to deliver"));
    expect(lapsed.getByText("Nothing is waiting to be delivered.")).toBeInTheDocument();
    expect(lapsed.getByText(/Not kept: 4 promises/)).toBeInTheDocument();
    expect(
      within(line("Supported")).getByText("9,007,199,254,740,993 G$ received")
    ).toBeInTheDocument();
  });

  it("holds back the pool's figures once people use a voucher, and tells no voucher from no reading", () => {
    const base = record();
    if (base.supply.status !== "available") throw new Error("the fixture must be readable");
    const voucher = base.supply.value[0]!;
    const pool = () => within(line("In the exchange pool"));

    // People have used the voucher: the holding and the total could each be one person's.
    show({
      passport: record({
        supply: {
          ...base.supply,
          value: [
            {
              ...voucher,
              outstanding: null,
              heldBack: true,
              pools: [{ ...voucher.pools[0]!, holding: null }],
            },
          ],
        },
      }),
    });
    expect(
      pool().getByText("The Riverside exchange pool may hold 40 GGV at most.")
    ).toBeInTheDocument();
    expect(pool().getByText(/are held back\. People have started using/)).toBeInTheDocument();
    expect(pool().queryByText(/GGV in the Riverside exchange pool/)).not.toBeInTheDocument();
    expect(pool().queryByText(/GGV outstanding\./)).not.toBeInTheDocument();
    cleanup();

    // A pool that no longer lists the voucher says so instead of quoting a limit of zero.
    show({
      passport: record({
        supply: {
          ...base.supply,
          value: [
            {
              ...voucher,
              outstanding: 0n,
              pools: [{ ...voucher.pools[0]!, listed: false, holding: 0n, holdingLimit: 0n }],
            },
          ],
        },
      }),
    });
    expect(
      pool().getByText("The Riverside exchange pool does not list this voucher right now.")
    ).toBeInTheDocument();
    expect(
      pool().getByText("No GGV is outstanding. All of them are with the garden itself.")
    ).toBeInTheDocument();
    expect(pool().queryByText(/pool may hold/)).not.toBeInTheDocument();
    cleanup();

    show({ passport: record({ supply: { status: "available", asOf: null, value: [] } }) });
    expect(
      pool().getByText("This garden issues no voucher that the exchange pool lists.")
    ).toBeInTheDocument();
    cleanup();

    // The voucher chain could not be read: that is not the same as issuing no voucher.
    show({ passport: record({ supply: { status: "unavailable" } }) });
    expect(
      pool().getByText("This part of the record could not be read just now.")
    ).toBeInTheDocument();
    expect(pool().queryByText(/issues no voucher/)).not.toBeInTheDocument();
  });

  it("says a garden has not published a passport, without reading or showing a figure", async () => {
    show({ published: false });

    expect(screen.getByText("This garden has not published a passport.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Promised" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View the Garden" })).toHaveAttribute(
      "href",
      `/gardens/${GARDEN}`
    );
    await waitFor(() => {
      expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
        "content",
        "noindex"
      );
    });
  });

  it("tells a failed passport, a missing garden and an unreadable garden apart", () => {
    show({ isError: true });
    expect(
      screen.getByText("This public record is temporarily unavailable. Please try again.")
    ).toBeInTheDocument();
    cleanup();

    show({}, { garden: null, unlisted: false });
    expect(screen.getByRole("heading", { name: "Garden not found" })).toBeInTheDocument();
    cleanup();

    show({}, null);
    expect(
      screen.getByRole("heading", { name: "This garden could not be loaded" })
    ).toBeInTheDocument();
  });

  it("links a funder to the passport from the Fund row only where one is published", () => {
    const row = (address: string, slug: string) => (
      <IntlProvider locale="en" messages={messages}>
        <MemoryRouter>
          <PublicGardenRow
            garden={
              {
                id: address,
                address,
                slug,
                name: slug,
                stewards: [],
                gardenerCount: 0,
                fieldNoteCount: 0,
                lastActivityAt: 0,
              } as never
            }
            onSupport={() => {}}
          />
        </MemoryRouter>
      </IntlProvider>
    );
    // The one garden on the reviewed list, on the chain it is published for.
    render(row("0xf7b892886998dae960d64a9db488336684f137a0", "published-garden"));
    expect(screen.getByRole("link", { name: /Read the Passport/ })).toHaveAttribute(
      "href",
      "/gardens/0xf7b892886998dae960d64a9db488336684f137a0/passport"
    );
    cleanup();

    render(row(GARDEN, "another-garden"));
    expect(screen.queryByRole("link", { name: /Read the Passport/ })).not.toBeInTheDocument();
  });
});
