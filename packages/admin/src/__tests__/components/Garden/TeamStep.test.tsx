/**
 * @vitest-environment jsdom
 */

import { en as enMessages, type Address } from "@green-goods/shared";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseAddressInput, mockUseEnsName } = vi.hoisted(() => ({
  mockUseAddressInput: vi.fn(),
  mockUseEnsName: vi.fn(),
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    formatAddress: (
      address: string,
      options: { ensName?: string | null; variant?: "default" | "card" | "long" } = {}
    ) => {
      const ensName = options.ensName?.trim();
      if (ensName?.toLowerCase().endsWith(".greengoods.eth")) {
        return ensName.slice(0, -".greengoods.eth".length);
      }
      if (ensName) return ensName;
      return address;
    },
    useAddressInput: mockUseAddressInput,
    useEnsName: (address: Address | null | undefined) => mockUseEnsName(address),
  };
});

import { resetCreateGardenStore } from "@green-goods/shared";
import { TeamStep } from "../../../components/Garden/CreateGardenSteps/TeamStep";

describe("components/Garden/CreateGardenSteps/TeamStep", () => {
  beforeEach(() => {
    resetCreateGardenStore();
    mockUseAddressInput.mockReset();
    mockUseEnsName.mockReset();
    mockUseEnsName.mockReturnValue({ data: null });
    mockUseAddressInput.mockReturnValue({
      input: "",
      setInput: vi.fn(),
      error: null,
      trimmedInput: "",
      isHexAddress: false,
      shouldResolveEns: false,
      resolvedAddress: null,
      resolvingEns: false,
      handleAdd: vi.fn(),
    });
  });

  it("renders operator and gardener sections with advisory about overlap", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <TeamStep />
      </IntlProvider>
    );

    expect(screen.getByLabelText("Operators")).toBeInTheDocument();
    expect(screen.getByLabelText("Gardeners")).toBeInTheDocument();
    expect(screen.getByText("Planned team members")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Note: Operators automatically have gardener access. You don't need to add them to both lists."
      )
    ).toBeInTheDocument();
  });

  it("renders resolved ENS confirmations with the readable reverse name when available", () => {
    mockUseAddressInput
      .mockReturnValueOnce({
        input: "river.greengoods.eth",
        setInput: vi.fn(),
        error: null,
        trimmedInput: "river.greengoods.eth",
        isHexAddress: false,
        shouldResolveEns: true,
        resolvedAddress: "0x1234567890123456789012345678901234567890",
        resolvingEns: false,
        handleAdd: vi.fn(),
      })
      .mockReturnValueOnce({
        input: "",
        setInput: vi.fn(),
        error: null,
        trimmedInput: "",
        isHexAddress: false,
        shouldResolveEns: false,
        resolvedAddress: null,
        resolvingEns: false,
        handleAdd: vi.fn(),
      });
    mockUseEnsName.mockReturnValue({ data: "river.greengoods.eth" });

    render(
      <IntlProvider locale="en" messages={enMessages}>
        <TeamStep />
      </IntlProvider>
    );

    expect(screen.getByText(/resolves to/i)).toBeInTheDocument();
    expect(screen.getByText("river")).toBeInTheDocument();
  });
});
