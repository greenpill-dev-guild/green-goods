import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useGreenGoodsEnsName } from "@green-goods/shared/hooks/ens/useGreenGoodsEnsName";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import { copyToClipboard } from "@green-goods/shared/utils/app/clipboard";
import { render, screen, waitFor, within } from "@testing-library/react";
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

import { GardenGardeners, type GardenMember } from "../../components/Features/Garden/Gardeners";

const messages = {
  "app.garden.gardeners.joined": "Joined {date}",
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
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.clearAllMocks();
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

  it("shows each member's highest role and when a gardener joined, and no date it lacks", () => {
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
    expect(steward).toHaveTextContent("Steward");
    expect(steward).not.toHaveTextContent("Gardener");
    expect(steward).toHaveTextContent("Joined Nov 14, 2023");
    expect(screen.getByRole("button", { name: /Member 1/i })).not.toHaveTextContent("Joined");
    expect(screen.getByRole("button", { name: /Member 2/i })).not.toHaveTextContent("Joined");
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
});
