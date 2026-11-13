import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useGardenMemberHistory } from "@green-goods/shared/hooks/garden/useGardenMemberHistory";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import en from "@green-goods/shared/i18n/en.json";
import type { Garden } from "@green-goods/shared/types/domain";
import { copyToClipboard } from "@green-goods/shared/utils/app/clipboard";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/__tests__/test-utils";

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/utils/app/clipboard", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@green-goods/shared/components/Toast/toast.service", () => ({
  toastService: { error: vi.fn(), success: vi.fn() },
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

vi.mock("@green-goods/shared/hooks/garden/useGardenMemberHistory", () => ({
  useGardenMemberHistory: vi.fn(() => ({
    members: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  })),
}));

vi.mock("@/components/Inputs", () => ({
  AddressCopy: ({ address }: { address: string }) => <span>{address}</span>,
}));

import { GardenGardeners, type GardenMember } from "../../components/Features/Garden/Gardeners";

const messages = {
  ...en,
  "app.garden.gardeners.gardenerSince": "Gardener since {date}",
  "app.roles.gardener": "Gardener",
  "app.roles.steward": "Steward",
};

const garden: Garden = {
  id: "0x1111111111111111111111111111111111111111",
  name: "River garden",
  chainId: 42161,
  tokenAddress: "0x1111111111111111111111111111111111111111",
  tokenID: 1n,
  stewards: [],
  owners: [],
  evaluators: [],
  funders: [],
  communities: [],
  gardeners: [],
  description: "",
  location: "",
  bannerImage: "",
  createdAt: 1_700_000_000_000,
  assessments: [],
  works: [],
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
  vi.mocked(useGardenMemberHistory).mockReturnValue({
    members: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as ReturnType<typeof useGardenMemberHistory>);
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

    renderWithProviders(
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
    renderWithProviders(
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

  it("shows this garden's join date instead of a gardener's earlier registration", async () => {
    const joinedAt = Date.UTC(2026, 5, 12, 12);
    vi.mocked(useGardenMemberHistory).mockReturnValue({
      members: [
        {
          garden: garden.id,
          account: members[0].account,
          joinedAt,
          memberSince: Date.UTC(2026, 9, 4, 12),
          roleSince: {
            gardener: Date.UTC(2026, 9, 4, 12),
            steward: Date.UTC(2026, 9, 6, 12),
          },
        },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as ReturnType<typeof useGardenMemberHistory>);
    renderWithProviders(
      <TestIntl>
        <GardenGardeners
          garden={garden}
          members={[
            { ...members[0], isSteward: true },
            { ...members[1], registeredAt: null },
            { ...members[2], isGardener: false, isSteward: true, registeredAt: null },
          ]}
        />
      </TestIntl>
    );

    const steward = screen.getByRole("button", { name: /Member 0/i });
    expect(within(steward).getByTitle("Steward")).toBeInTheDocument();
    expect(within(steward).queryByTitle("Gardener")).not.toBeInTheDocument();
    expect(steward).toHaveTextContent("Joined Jun 12, 2026");
    expect(steward.querySelector("time")).toHaveAttribute(
      "datetime",
      new Date(joinedAt).toISOString()
    );
    expect(steward).not.toHaveTextContent("Nov 14, 2023");
    expect(screen.getByRole("button", { name: /Member 1/i })).not.toHaveTextContent("Joined");
    expect(screen.getByRole("button", { name: /Member 2/i })).not.toHaveTextContent("Joined");
    expect(useGardenMemberHistory).toHaveBeenCalledWith({
      garden: garden.id,
      chainId: garden.chainId,
    });

    await userEvent.setup().click(steward);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Jun 12, 2026");
    expect(dialog).toHaveTextContent("Oct 4, 2026");
    expect(dialog).toHaveTextContent("Oct 6, 2026");
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

    const { container, rerender } = renderWithProviders(
      <TestIntl>
        <GardenGardeners members={[member]} />
      </TestIntl>
    );
    // A Green Goods name shows as the username alone.
    expect(screen.getByText("river")).toBeInTheDocument();
    expect(screen.queryByText("river.greengoods.eth")).not.toBeInTheDocument();
    expect(container.querySelector(".gg-item-row-avatar > img")?.getAttribute("src")).toBe(
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
    expect(container.querySelector(".gg-item-row-avatar > img")?.getAttribute("src")).toBe(
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
    expect(container.querySelector(".gg-item-row-avatar > img")?.getAttribute("src")).toBe(
      "/images/avatar.png"
    );
  });

  it("keeps member identity available when membership history cannot load", async () => {
    vi.mocked(useGardenMemberHistory).mockReturnValue({
      members: [
        {
          garden: garden.id,
          account: members[0].account,
          joinedAt: Date.UTC(2026, 5, 12, 12),
          memberSince: Date.UTC(2026, 5, 12, 12),
          roleSince: { gardener: Date.UTC(2026, 5, 12, 12) },
        },
      ],
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as ReturnType<typeof useGardenMemberHistory>);
    renderWithProviders(
      <TestIntl>
        <GardenGardeners garden={garden} members={[members[0]]} />
      </TestIntl>
    );

    const row = screen.getByRole("button", { name: /Member 0/i });
    expect(row).not.toHaveTextContent("Joined");
    await userEvent.setup().click(row);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(members[0].account)).toBeInTheDocument();
    expect(dialog).toHaveTextContent(en["app.garden.membership.unavailable"]);
    expect(dialog).not.toHaveTextContent("Nov 14, 2023");
  });

  it("shows the default avatar while a member's photo is still being looked up", () => {
    vi.mocked(useResolvedProfileAvatar).mockReturnValue({
      avatarUri: "/images/avatar.png",
      isLoading: true,
    } as ReturnType<typeof useResolvedProfileAvatar>);

    const { container } = renderWithProviders(
      <TestIntl>
        <GardenGardeners members={[members[0]]} />
      </TestIntl>
    );

    expect(container.querySelector(".gg-item-row-avatar img")?.getAttribute("src")).toBe(
      "/images/avatar.png"
    );
  });

  it("keeps the leave action in Profile", () => {
    renderWithProviders(
      <IntlProvider locale="en" messages={en}>
        <GardenGardeners members={members.slice(0, 2)} />
      </IntlProvider>
    );
    expect(screen.queryByRole("button", { name: /leave garden/i })).not.toBeInTheDocument();
  });
});
