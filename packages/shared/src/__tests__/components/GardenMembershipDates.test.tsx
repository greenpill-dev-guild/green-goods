/** @vitest-environment happy-dom */
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it } from "vitest";
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
  it("shows first join, rejoin, and each current role as distinct dated facts", () => {
    const { container } = show({ history });
    expect(screen.getByText("Joined this garden")).toBeInTheDocument();
    expect(screen.getByText("Rejoined")).toBeInTheDocument();
    expect(screen.getByText("Steward since")).toBeInTheDocument();
    expect(screen.getByText("Jul 3, 2026").closest("time")).toHaveAttribute(
      "dateTime",
      "2026-07-03T00:00:00.000Z"
    );
    expect(container.querySelectorAll("dt")).toHaveLength(4);
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
    expect(screen.queryByText("Steward since")).not.toBeInTheDocument();
  });
});
