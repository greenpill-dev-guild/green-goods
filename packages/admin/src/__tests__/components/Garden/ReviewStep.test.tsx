/**
 * @vitest-environment jsdom
 */

import {
  en as enMessages,
  resetCreateGardenStore,
  useCreateGardenStore,
  type Address,
} from "@green-goods/shared";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseEnsName } = vi.hoisted(() => ({
  mockUseEnsName: vi.fn(),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    useEnsName: (address: Address | null | undefined) => mockUseEnsName(address),
  };
});

import { ReviewStep } from "../../../components/Garden/CreateGardenSteps/ReviewStep";

const OPERATOR_AND_GARDENER = "0x1234567890123456789012345678901234567890";
const GARDENER = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("components/Garden/CreateGardenSteps/ReviewStep", () => {
  beforeEach(() => {
    mockUseEnsName.mockReset();
    mockUseEnsName.mockImplementation((address: Address | null | undefined) => ({
      data:
        address === OPERATOR_AND_GARDENER
          ? "river.greengoods.eth"
          : address === GARDENER
            ? "meadow.greengoods.eth"
            : null,
    }));

    resetCreateGardenStore();
    const store = useCreateGardenStore.getState();

    store.setField("name", "River Garden");
    store.setField("slug", "river-garden");
    store.setField("description", "Protecting the river delta");
    store.setField("location", "Portland, Oregon");
    store.addOperator(OPERATOR_AND_GARDENER);
    store.addGardener(OPERATOR_AND_GARDENER);
    store.addGardener(GARDENER);
  });

  it("shows garden details, team lists, and team assignment notice", () => {
    render(
      <IntlProvider locale="en" messages={enMessages}>
        <ReviewStep />
      </IntlProvider>
    );

    expect(screen.getByText("River Garden")).toBeInTheDocument();
    expect(screen.getByText("Portland, Oregon")).toBeInTheDocument();
    expect(screen.getByText("Protecting the river delta")).toBeInTheDocument();
    expect(screen.getByText("Planned gardeners")).toBeInTheDocument();
    expect(screen.getByText("Planned operators")).toBeInTheDocument();
    expect(screen.getAllByText("river").length).toBeGreaterThan(0);
    expect(screen.getByText("meadow")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Planned members are included in deployment. Verify role grants from Garden Members after creation."
      )
    ).toBeInTheDocument();
  });
});
