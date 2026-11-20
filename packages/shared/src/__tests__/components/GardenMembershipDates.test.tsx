/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
import { FactRow } from "../../components/Cards/FactRow";
import { GardenMembershipDates } from "../../components/GardenMembershipDates";
import messages from "../../i18n/en.json";
import type { GardenMemberHistory } from "../../types/domain";

const history: GardenMemberHistory = {
  garden: "0x1111111111111111111111111111111111111111",
  account: "0x2222222222222222222222222222222222222222",
  joinedAt: Date.UTC(2026, 0, 10),
  memberSince: Date.UTC(2026, 4, 20),
  roleSince: { gardener: Date.UTC(2026, 4, 20), steward: Date.UTC(2026, 6, 3) },
};
const show = (props: Parameters<typeof GardenMembershipDates>[0]) =>
  render(
    <IntlProvider locale="en" messages={messages} timeZone="UTC">
      <GardenMembershipDates {...props} />
    </IntlProvider>
  );

describe("GardenMembershipDates", () => {
  it("folds roles into the join or rejoin they began with and dates later roles once", () => {
    const { container } = show({ history });
    expect(screen.getByText("Joined this garden")).toBeInTheDocument();
    expect(screen.getByText("Rejoined as Gardener")).toBeInTheDocument();
    expect(screen.getByText("Became Steward")).toBeInTheDocument();
    expect(screen.getByText("Jul 3, 2026").closest("time")).toHaveAttribute(
      "dateTime",
      "2026-07-03T00:00:00.000Z"
    );
    expect(container.querySelectorAll("dt")).toHaveLength(3);
  });

  it("names every role that began on the join day in one row with the date once", () => {
    const sameDay = Date.UTC(2026, 5, 12);
    show({
      history: {
        ...history,
        joinedAt: sameDay,
        memberSince: sameDay,
        roleSince: { gardener: sameDay, steward: sameDay },
      },
    });
    expect(screen.getByText("Joined as Steward and Gardener")).toBeInTheDocument();
    expect(screen.getAllByText("Jun 12, 2026")).toHaveLength(1);
    expect(screen.queryByText(/since/)).not.toBeInTheDocument();
  });

  it("groups roles that began together on a later day", () => {
    const joined = Date.UTC(2026, 0, 10);
    const later = Date.UTC(2026, 3, 2);
    show({
      history: {
        ...history,
        joinedAt: joined,
        memberSince: joined,
        roleSince: { gardener: joined, steward: later, evaluator: later },
      },
    });
    expect(screen.getByText("Joined as Gardener")).toBeInTheDocument();
    expect(screen.getByText("Became Steward and Evaluator")).toBeInTheDocument();
  });

  it("never labels a continuous membership as a rejoin and keeps compact facts short", () => {
    show({ history: { ...history, memberSince: history.joinedAt }, compact: true });
    expect(screen.queryByText("Rejoined")).not.toBeInTheDocument();
    expect(screen.queryByText("Steward since")).not.toBeInTheDocument();
  });

  it("distinguishes loading from unavailable history without rendering a fake date", () => {
    const { rerender, container } = show({ isLoading: true });
    expect(screen.getByRole("status")).toHaveTextContent("Loading membership dates");
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <GardenMembershipDates isError />
      </IntlProvider>
    );
    expect(screen.getByText("Membership dates unavailable")).toBeInTheDocument();
    expect(container.querySelector("time")).toBeNull();
  });

  it("marks a current role with no recorded grant as unknown", () => {
    show({ history, roles: ["owner"] });
    expect(screen.getByText("Owner since")).toBeInTheDocument();
    expect(screen.getByText("Date unknown")).toBeInTheDocument();
    expect(screen.queryByText("Became Steward")).not.toBeInTheDocument();
  });

  it("keeps further facts in the same list, and after an unavailable history", () => {
    const extra = <FactRow label="Last recorded contribution" value="Nov 15, 2026" />;
    const { container, rerender } = show({ history, children: extra });
    expect(container.querySelectorAll("dl")).toHaveLength(1);
    expect(container.querySelectorAll("dt")).toHaveLength(4);
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <GardenMembershipDates isError>{extra}</GardenMembershipDates>
      </IntlProvider>
    );
    expect(screen.getByText("Membership dates unavailable")).toBeInTheDocument();
    expect(screen.getByText("Last recorded contribution")).toBeInTheDocument();
  });
});
