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
const NOBODY = "0x0000000000000000000000000000000000000000" as Address;

const { useEnsName, useGreenGoodsEnsName } = vi.hoisted(() => ({
  useEnsName: vi.fn((address?: string | null) => ({
    data: address === "0x2222222222222222222222222222222222222222" ? "maria.eth" : null,
  })),
  useGreenGoodsEnsName: vi.fn(() => ({ data: null })),
}));
vi.mock("../../../hooks/blockchain/useEnsName", () => ({ useEnsName }));
vi.mock("../../../hooks/ens/useGreenGoodsEnsName", () => ({ useGreenGoodsEnsName }));

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
    // A list's rows read their Green Goods names together, in one batch.
    expect(useGreenGoodsEnsName).toHaveBeenCalledWith(TAKER, { list: true });
  });

  it("reads the other person from the reader's seat, and names nobody before anyone takes it up", () => {
    const { rerender } = renderRow({ party: { commitment, seat: "confirmer" } });
    // The taker reads the maker, by short address while no name resolves.
    expect(screen.getByRole("button")).toHaveTextContent("0x11...111");
    expect(screen.getByRole("button")).not.toHaveTextContent("maria.eth");

    // Nobody has taken it up, whether the seat is empty or holds the chain's zero address.
    for (const counterparty of [null, NOBODY]) {
      rerender(
        <IntlProvider locale="en" messages={messages}>
          <CommitmentRow
            {...base}
            party={{ commitment: { ...commitment, counterparty }, seat: "provider" }}
          />
        </IntlProvider>
      );
      expect(screen.getByRole("button")).toHaveAccessibleName(/due 24 Oct$/);
    }

    // The one who asked, on their own request nobody has taken up, never reads their own name.
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <CommitmentRow
          {...base}
          direction="REQUEST"
          party={{
            commitment: {
              direction: "REQUEST",
              creator: MAKER,
              leadProvider: null,
              counterparty: null,
            },
            seat: "confirmer",
          }}
        />
      </IntlProvider>
    );
    expect(screen.getByRole("button")).toHaveAccessibleName(/due 24 Oct$/);
  });

  it("puts a queue or act state in the one pill, edged in its tone, its words leading the line", () => {
    useEnsName.mockClear();
    const queued = {
      pending: "notSent",
      note: "Saved on this phone.",
      onOpen: undefined,
      action: <button type="button">Send Now</button>,
    } as const;
    const { rerender } = renderRow(queued);

    expect(screen.getByText("Not sent")).toBeInTheDocument();
    expect(screen.queryByText("In progress")).not.toBeInTheDocument();
    const row = document.querySelector(".gg-item-row");
    expect(row).toHaveAttribute("data-edge", "warning");
    const details = () => document.querySelector(".gg-item-row-details");
    expect(details()).toHaveTextContent(/^Saved on this phone\.\s*due 24 Oct$/);
    // The person's place is taken, so no name is looked up for it.
    expect(useEnsName.mock.calls.every(([address]) => address === null)).toBe(true);

    // A promise still on the device has no page to show its units, so they lead the line.
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <CommitmentRow {...base} {...queued} units="6 hours" />
      </IntlProvider>
    );
    expect(details()).toHaveTextContent(/^6 hours\s*Saved on this phone\.$/);

    // While something stops the send, what stops it leads, so a phone keeps it in view.
    rerender(
      <IntlProvider locale="en" messages={messages}>
        <CommitmentRow
          {...base}
          {...queued}
          note="Your wallet needs to be on Arbitrum One."
          units="6 hours"
          blocked
        />
      </IntlProvider>
    );
    expect(details()).toHaveTextContent(/^Your wallet needs to be on Arbitrum One\.\s*6 hours$/);
  });

  it("keeps its row, and the reader's focus, when someone takes the promise up", () => {
    const untaken = {
      commitment: { ...commitment, counterparty: null },
      seat: "provider",
    } as const;
    const { rerender } = renderRow({ party: untaken });
    const row = screen.getByRole("button");
    row.focus();

    rerender(
      <IntlProvider locale="en" messages={messages}>
        <CommitmentRow {...base} party={{ commitment, seat: "provider" }} />
      </IntlProvider>
    );
    expect(screen.getByRole("button")).toBe(row);
    expect(row).toHaveFocus();
    expect(row).toHaveAccessibleName(/maria\.eth$/);
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
