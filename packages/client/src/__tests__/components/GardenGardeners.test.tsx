import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import en from "@green-goods/shared/i18n/en.json";
import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import type { Garden } from "@green-goods/shared/types/domain";
import { copyToClipboard } from "@green-goods/shared/utils/app/clipboard";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/utils/app/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@green-goods/shared/hooks/auth/useUser", () => ({
  useUser: vi.fn(() => ({ primaryAddress: null })),
}));

vi.mock("@green-goods/shared/hooks/profile/useProfileAvatar", () => ({
  useResolvedProfileAvatar: vi.fn(() => ({ avatarUri: "/images/avatar.png", isLoading: false })),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: () => ({ data: null }),
}));

vi.mock("@green-goods/shared/hooks/ens/useGreenGoodsEnsName", () => ({
  useGreenGoodsEnsName: vi.fn(() => ({ data: null })),
}));

vi.mock("@/components/Inputs", () => ({
  AddressCopy: ({ address }: { address: string }) => <span>{address}</span>,
}));

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
  useGardens: vi.fn(() => ({ data: [] })),
}));

import { GardenGardeners, type GardenMember } from "../../components/Features/Garden/Gardeners";

const messages = {
  "app.garden.gardeners.gardenerSince": "Gardener since {date}",
  "app.roles.gardener": "Gardener",
  "app.roles.steward": "Steward",
};

function TestIntl({ children }: { children: ReactNode }) {
  return (
    <IntlProvider locale="en" messages={messages}>
      {children}
    </IntlProvider>
  );
}

const members: GardenMember[] = Array.from({ length: 41 }, (_, index) => ({
  id: `member-${index}`,
  account: `0x${index.toString(16).padStart(40, "0")}` as GardenMember["account"],
  username: `Member ${index}`,
  registeredAt: 1_700_000_000_000 + index,
  isSteward: false,
  isGardener: true,
}));

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUser).mockImplementation(
    () => ({ primaryAddress: null }) as ReturnType<typeof useUser>
  );
  vi.mocked(useGreenGoodsEnsName).mockImplementation(
    () => ({ data: null }) as ReturnType<typeof useGreenGoodsEnsName>
  );
  vi.mocked(useResolvedProfileAvatar).mockImplementation(
    () =>
      ({
        avatarUri: "/images/avatar.png",
        isLoading: false,
      }) as ReturnType<typeof useResolvedProfileAvatar>
  );
});

describe("GardenGardeners", () => {
  it("virtualizes large member lists while preserving selection and list semantics", async () => {
    const user = userEvent.setup();
    const ref = createRef<HTMLUListElement>();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      bottom: 600,
      height: 600,
      left: 0,
      right: 640,
      top: 0,
      width: 640,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    render(
      <TestIntl>
        <GardenGardeners ref={ref} members={members} />
      </TestIntl>
    );

    expect(ref.current?.tagName).toBe("UL");
    await waitFor(() => {
      const renderedRows = screen.getAllByRole("listitem");
      expect(renderedRows.length).toBeGreaterThan(0);
      expect(renderedRows.length).toBeLessThan(members.length);
      expect(renderedRows[0]).toHaveAttribute("aria-posinset", "1");
      expect(renderedRows[0]).toHaveAttribute("aria-setsize", "41");
    });

    await user.click(screen.getByRole("button", { name: /Member 0/i }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-component", "DialogShell");
    expect(within(dialog).getByText("Member 0")).toBeInTheDocument();
  });

  it("reports a failed member-detail copy without claiming success", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue(false);
    const user = userEvent.setup();
    render(
      <TestIntl>
        <GardenGardeners members={[{ ...members[0], email: "member@example.com" }]} />
      </TestIntl>
    );

    await user.click(screen.getByRole("button", { name: /Member 0/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Copy" }));

    await waitFor(() => expect(toastService.error).toHaveBeenCalled());
    expect(copyToClipboard).toHaveBeenCalledWith("member@example.com");
    expect(toastService.success).not.toHaveBeenCalled();
  });

  it("shows each member's highest role and since when a gardener has been one, and no date it lacks", () => {
    render(
      <TestIntl>
        <GardenGardeners
          members={[
            { ...members[0], isSteward: true },
            { ...members[1], registeredAt: null },
            { ...members[2], isGardener: false, isSteward: true, registeredAt: null },
          ]}
        />
      </TestIntl>
    );

    const steward = screen.getByRole("button", { name: /Member 0/i });
    // The pill is the highest role alone. The date is the indexer's one date per gardener, their
    // first gardener role in any garden, so it never claims when they joined this garden.
    expect(within(steward).getByTitle("Steward")).toBeInTheDocument();
    expect(within(steward).queryByTitle("Gardener")).not.toBeInTheDocument();
    expect(steward).toHaveTextContent("Gardener since Nov 14, 2023");
    expect(screen.getByRole("button", { name: /Member 1/i })).not.toHaveTextContent("since");
    expect(screen.getByRole("button", { name: /Member 2/i })).not.toHaveTextContent("since");
  });

  it("uses the viewed member's published avatar and protocol name across changes", () => {
    vi.mocked(useGreenGoodsEnsName).mockImplementation(
      (account) =>
        ({
          data: account === members[0].account ? "river.greengoods.eth" : null,
        }) as ReturnType<typeof useGreenGoodsEnsName>
    );
    vi.mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: "https://images.example/first.webp",
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    const member = { ...members[0], username: undefined, avatar: "blob:unpublished-preview" };

    const { container, rerender } = render(
      <TestIntl>
        <GardenGardeners members={[member]} />
      </TestIntl>
    );
    // A Green Goods name shows as the username alone.
    expect(screen.getByText("river")).toBeInTheDocument();
    expect(screen.queryByText("river.greengoods.eth")).not.toBeInTheDocument();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://images.example/first.webp"
    );
    expect(useResolvedProfileAvatar).toHaveBeenCalledWith(
      member.account,
      "/images/avatar.png",
      expect.any(Number),
      { list: true }
    );

    vi.mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: "https://images.example/replaced.webp",
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    rerender(
      <TestIntl>
        <GardenGardeners members={[member]} />
      </TestIntl>
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://images.example/replaced.webp"
    );

    vi.mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: "/images/avatar.png",
      isLoading: false,
    } as ReturnType<typeof useResolvedProfileAvatar>);
    rerender(
      <TestIntl>
        <GardenGardeners members={[member]} />
      </TestIntl>
    );
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/images/avatar.png");
  });

  it("shows no picture or glyph while a member's photo is still being looked up", () => {
    vi.mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: "/images/avatar.png",
      isLoading: true,
    } as ReturnType<typeof useResolvedProfileAvatar>);

    const { container } = render(
      <TestIntl>
        <GardenGardeners members={[members[0]]} />
      </TestIntl>
    );

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".gg-item-row-avatar")).toBeEmptyDOMElement();
  });

  describe("how a member leaves the garden", () => {
    const [ana, bo, caio, dee, reader] = ["Ana", "Bo", "Caio", "Dee", "Reader"].map(
      (username, index) => ({ ...members[index], username, isSteward: index < 4 })
    );
    const GARDEN_ID = "0x00000000000000000000000000000000000000aa";
    const record = (roster: Partial<Garden>) => ({ id: GARDEN_ID, ...roster }) as Garden;
    const readAs = (account: string | null) =>
      vi
        .mocked(useUser)
        .mockImplementation(() => ({ primaryAddress: account }) as ReturnType<typeof useUser>);
    const renderSection = (
      garden: Garden,
      roster: GardenMember[],
      { locale = "en", catalog = en as Record<string, string> } = {}
    ) => {
      vi.mocked(useGardens).mockImplementation(
        () => ({ data: [garden] }) as unknown as ReturnType<typeof useGardens>
      );
      return render(
        <IntlProvider locale={locale} messages={catalog}>
          <GardenGardeners members={roster} garden={garden} />
        </IntlProvider>
      );
    };
    const leaveLine = () => screen.queryByText(/leave this garden/i);

    it.each([
      ["en", en, "To leave this garden, ask a steward like Ana or Bo to remove you."],
      ["es", es, "Para salir de este jardín, pide a un responsable como Ana o Bo que te retire."],
      ["pt", pt, "Para sair deste jardim, peça a um responsável como Ana ou Bo para remover você."],
    ])("tells a gardener in %s, naming the garden's stewards", (locale, catalog, line) => {
      readAs(reader.account);
      const garden = record({ stewards: [ana.account, bo.account], gardeners: [reader.account] });

      const { container } = renderSection(garden, [ana, bo, reader], { locale, catalog });

      expect(container.querySelector("li p")).toHaveTextContent(line);
    });

    it("names other stewards to a steward, three at most, and leaves the rest to the list", () => {
      readAs(ana.account);
      const stewards = [ana, bo, caio, dee].map((steward) => steward.account);

      renderSection(record({ stewards, gardeners: [] }), [ana, bo, caio, dee]);

      expect(leaveLine()).toHaveTextContent(
        "To leave this garden, ask a steward like Bo, Caio, or Dee to remove you."
      );
    });

    it.each([
      ["evaluators"],
      ["owners"],
    ])("tells a member who is listed only under %s, as Home counts them", (role) => {
      readAs(reader.account);

      renderSection(record({ stewards: [ana.account], [role]: [reader.account] }), [ana]);

      expect(leaveLine()).toHaveTextContent(
        "To leave this garden, ask a steward like Ana to remove you."
      );
    });

    it.each([
      ["a signed-out reader", null, { stewards: [ana.account] }, [ana]],
      ["a reader with no role here", dee.account, { stewards: [ana.account] }, [ana]],
      [
        "a funder, who holds no member role",
        reader.account,
        { stewards: [ana.account], funders: [reader.account] },
        [ana],
      ],
      [
        "the garden's only steward, with nobody to name",
        ana.account,
        { stewards: [ana.account] },
        [ana],
      ],
      [
        "a gardener when the record lists no steward to ask",
        reader.account,
        { stewards: [], gardeners: [reader.account] },
        [reader],
      ],
    ] satisfies Array<
      [string, string | null, Partial<Garden>, GardenMember[]]
    >)("stays away from %s", (_reader, account, roster, listed) => {
      readAs(account);

      renderSection(record(roster), listed);

      expect(leaveLine()).toBeNull();
    });

    it("shows from the moment a join lands, before the roster lists it, and goes when its time runs out", () => {
      vi.useFakeTimers();
      readAs(reader.account);
      localStorage.setItem(
        "greengoods:pending-joins",
        JSON.stringify({ [GARDEN_ID]: { address: reader.account, timestamp: Date.now() } })
      );

      renderSection(record({ stewards: [ana.account], gardeners: [] }), [ana]);
      expect(leaveLine()).toHaveTextContent(
        "To leave this garden, ask a steward like Ana to remove you."
      );

      act(() => {
        vi.advanceTimersByTime(15 * 60 * 1000 + 1);
      });
      expect(leaveLine()).toBeNull();
    });
  });
});
