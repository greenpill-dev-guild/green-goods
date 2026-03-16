/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import enMessages from "@green-goods/shared/i18n/en";

const { mockUseAddressInput } = vi.hoisted(() => ({
  mockUseAddressInput: vi.fn(),
}));

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");

  return {
    ...actual,
    formatAddress: (address: string) => address,
    useAddressInput: mockUseAddressInput,
  };
});

import { resetCreateGardenStore } from "@green-goods/shared";
import { TeamStep } from "../../../components/Garden/CreateGardenSteps/TeamStep";

describe("components/Garden/CreateGardenSteps/TeamStep", () => {
  beforeEach(() => {
    resetCreateGardenStore();
    mockUseAddressInput.mockReset();
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
});
