/**
 * @vitest-environment jsdom
 */

import { en as enMessages, type Address } from "@green-goods/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCopy, mockUseEnsName } = vi.hoisted(() => ({
  mockCopy: vi.fn(),
  mockUseEnsName: vi.fn(),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useCopyToClipboard: () => ({
      copied: false,
      copy: mockCopy,
      reset: vi.fn(),
    }),
    useEnsName: (address: Address | null | undefined) => mockUseEnsName(address),
  };
});

import {
  EnsAddressText,
  EnsAddressWithCopy,
  formatEnsAddressName,
} from "@/components/EnsAddressText";

const TEST_ADDRESS = "0x1234567890abcdef1234567890abcdef12345678" as Address;

describe("EnsAddressText", () => {
  beforeEach(() => {
    mockCopy.mockReset();
    mockUseEnsName.mockReset();
    mockUseEnsName.mockReturnValue({ data: null });
  });

  it("formats Green Goods ENS names for admin display", () => {
    expect(formatEnsAddressName(TEST_ADDRESS, "river.greengoods.eth")).toBe("river");
  });

  it("renders the resolved ENS name when no explicit fallback name exists", () => {
    mockUseEnsName.mockReturnValue({ data: "river.greengoods.eth" });

    render(<EnsAddressText address={TEST_ADDRESS} />);

    expect(screen.getByText("river")).toBeInTheDocument();
    expect(mockUseEnsName).toHaveBeenCalledWith(TEST_ADDRESS);
  });

  it("keeps the shortened address fallback when ENS is unavailable", () => {
    render(<EnsAddressText address={TEST_ADDRESS} />);

    expect(screen.getByText("0x12...678")).toBeInTheDocument();
  });

  it("uses stored display names without firing an address lookup", () => {
    render(<EnsAddressText address={TEST_ADDRESS} fallbackName="Alice Gardener" />);

    expect(screen.getByText("Alice Gardener")).toBeInTheDocument();
    expect(mockUseEnsName).toHaveBeenCalledWith(null);
  });

  it("keeps copy controls usable while rendering ENS names", async () => {
    const user = userEvent.setup();
    mockUseEnsName.mockReturnValue({ data: "river.greengoods.eth" });

    render(
      <IntlProvider locale="en" messages={enMessages}>
        <EnsAddressWithCopy address={TEST_ADDRESS} />
      </IntlProvider>
    );

    expect(screen.getByText("river")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /copy/i }));

    expect(mockCopy).toHaveBeenCalledWith(TEST_ADDRESS);
  });
});
