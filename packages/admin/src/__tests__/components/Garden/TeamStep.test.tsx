/**
 * @vitest-environment jsdom
 */

import { default as enMessages } from "@green-goods/shared/i18n/en.json";
import { resetCreateGardenStore } from "@green-goods/shared/stores/useCreateGardenStore";
import type { Address } from "@green-goods/shared/types/domain";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseAddressInput, mockUseEnsName } = vi.hoisted(() => ({
  mockUseAddressInput: vi.fn(),
  mockUseEnsName: vi.fn(),
}));

vi.mock("@green-goods/shared/hooks/blockchain/useEnsName", () => ({
  useEnsName: (address: Address | null | undefined) => mockUseEnsName(address),
}));

vi.mock("@green-goods/shared/hooks/utils/useAddressInput", () => ({
  useAddressInput: mockUseAddressInput,
}));

vi.mock("@green-goods/shared/utils/app/text", () => ({
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
}));

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

  it("renders steward and gardener sections with advisory about overlap", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <TeamStep />
      </IntlProvider>
    );

    expect(screen.getByLabelText("Stewards")).toBeInTheDocument();
    expect(screen.getByLabelText("Gardeners")).toBeInTheDocument();
    expect(screen.getByText("Planned team members")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Note: Stewards automatically have gardener access. You don't need to add them to both lists."
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
