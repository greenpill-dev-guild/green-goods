/**
 * CommitmentRow Tests
 * @vitest-environment happy-dom
 *
 * The row's own rules (DL-110): the direction leads and is named, a queue or act state takes
 * the one pill and the edge follows it, the details give the due date and then the other
 * person from the reader's seat, and a state's words lead them while it lasts. Layout (one
 * 88px height, a line that never wraps) is measured in a real browser by the stories.
 */

import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import {
  CommitmentRow,
  type CommitmentRowProps,
} from "../../../components/Cards/CommitmentRow/CommitmentRow";
import messages from "../../../i18n/en.json";
import type { Address } from "../../../types/domain";

const MAKER = "0x1111111111111111111111111111111111111111" as Address;
const TAKER = "0x2222222222222222222222222222222222222222" as Address;

vi.mock("../../../hooks/blockchain/useEnsName", () => ({
  useEnsName: (address?: string | null) => ({
    data: address?.toLowerCase() === TAKER.toLowerCase() ? "maria.eth" : null,
  }),
}));
vi.mock("../../../hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: () => ({ data: null }),
}));

const commitment = {
  direction: "OFFER" as const,
  creator: MAKER,
  leadProvider: MAKER,
  counterparty: TAKER,
};

const base: CommitmentRowProps = {
  direction: "OFFER",
  title: "Water the seedlings weekly",
  status: { label: "In progress", tone: "info" },
  due: { text: "due 24 Oct" },
  party: { commitment, seat: "provider" },
  onOpen: vi.fn(),
};

const renderRow = (props: Partial<CommitmentRowProps> = {}) =>
  render(
    <IntlProvider locale="en" messages={messages}>
      <CommitmentRow {...base} {...props} />
    </IntlProvider>
  );

describe("CommitmentRow", () => {
  it("leads with the direction, named, then the state, the due date and the other person", () => {
    renderRow();

    const row = screen.getByRole("button");
    expect(row).toHaveAccessibleName(
      /^Offer Water the seedlings weekly In progress due 24 Oct\s*maria\.eth$/
    );
    expect(row).toHaveAttribute("data-edge", "info");
  });

  it("reads the other person from the reader's seat, and names nobody before anyone takes it up", () => {
    const { rerender } = renderRow({ party: { commitment, seat: "confirmer" } });
    // The taker reads the maker, by short address while no name resolves.
    expect(screen.getByRole("button")).toHaveTextContent("0x11...111");
    expect(screen.getByRole("button")).not.toHaveTextContent("maria.eth");

    rerender(
      <IntlProvider locale="en" messages={messages}>
        <CommitmentRow
          {...base}
          party={{ commitment: { ...commitment, counterparty: null }, seat: "provider" }}
        />
      </IntlProvider>
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(/due 24 Oct$/);
  });

  it("puts a queue or act state in the one pill, edged in its tone, its words leading the line", () => {
    renderRow({
      pending: "notSent",
      note: "Saved on this phone.",
      onOpen: undefined,
      action: <button type="button">Send Now</button>,
    });

    expect(screen.getByText("Not sent")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
    const row = document.querySelector(".gg-item-row");
    expect(row).toHaveAttribute("data-edge", "warning");
    expect(row?.querySelector(".gg-item-row-details")).toHaveTextContent(
      /^Saved on this phone\.\s*due 24 Oct$/
    );
  });

  it.each([
    ["confirming", "Confirming…", "info"],
    ["sendFailed", "Didn't send", "error"],
  ] as const)("says %s in the shared words", (pending, label, tone) => {
    renderRow({ pending });

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveAttribute("data-edge", tone);
  });

  it("marks a group's size on its tile and gives its counts in the person's place", () => {
    renderRow({
      direction: "REQUEST",
      party: null,
      group: { size: 10, counts: "3 in progress, 3 kept" },
    });

    const row = screen.getByRole("button");
    expect(row).toHaveAccessibleName(
      /^Request A group of 10 separate promises Water the seedlings weekly In progress due 24 Oct\s*3 in progress, 3 kept$/
    );
  });

  it("claims no direction for a record not read yet", () => {
    renderRow({ direction: null });

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
