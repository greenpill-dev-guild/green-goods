import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", () => ({
  cn: (...values: Array<string | false | null | undefined>) => values.filter(Boolean).join(" "),
  copyToClipboard: vi.fn(),
  formatAddress: (address: string) => address,
  toastService: { error: vi.fn(), success: vi.fn() },
  useEnsAvatar: () => ({ data: null, isLoading: false }),
  useEnsName: () => ({ data: null }),
  useGreenGoodsEnsName: () => ({ data: null }),
}));

vi.mock("@/components/Actions", () => ({
  Button: ({ label, onClick }: { label: string; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/Communication", () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));

vi.mock("@/components/Display", () => ({
  Avatar: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  AvatarFallback: () => null,
  AvatarImage: ({ alt }: { alt: string }) => <img alt={alt} />,
  AvatarSkeleton: () => null,
}));

vi.mock("@/components/Inputs", () => ({
  AddressCopy: ({ address }: { address: string }) => <span>{address}</span>,
}));

import { GardenGardeners, type GardenMember } from "../../components/Features/Garden/Gardeners";

const messages = {
  "app.garden.gardeners.stewardBadge": "Steward",
  "app.garden.gardeners.registered": "Registered",
  "app.garden.gardeners.unknownUser": "Unknown user",
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
    expect(within(dialog).getByText("Member 0")).toBeInTheDocument();
  });
});
