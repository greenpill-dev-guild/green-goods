/**
 * @vitest-environment jsdom
 */

import { commitmentFixture } from "@green-goods/shared/__tests__/test-utils/commitment-pooling-fixtures";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, within } from "../test-utils";
import { Provenance } from "../../views/Home/Garden/Commitment/ConfirmOutcome";

const STEWARD = "0x3333333333333333333333333333333333333333" as const;

describe("ConfirmProvenance", () => {
  afterEach(() => vi.restoreAllMocks());

  it("composes the real AddressDisplay inside valid fallback markup", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { container } = renderWithProviders(
      <Provenance
        commitment={commitmentFixture({
          fulfilledBy: STEWARD,
          confirmationPath: "POOL_FALLBACK",
          fallbackReason: "The neighbour moved away before confirming.",
        })}
      />
    );

    const provenance = container.querySelector('[data-component="ConfirmProvenance"]');
    expect(provenance).toBeInstanceOf(HTMLDivElement);
    expect(
      within(provenance as HTMLElement).getByRole("button", { name: "0x33...333" })
    ).toBeInTheDocument();
    expect(provenance).toHaveTextContent("Confirmed by your garden steward, as a fallback:");
    expect(provenance).toHaveTextContent("Reason: The neighbour moved away before confirming.");
    expect(screen.queryByText(/cannot be a descendant/i)).not.toBeInTheDocument();
    expect(consoleError.mock.calls.flat().join(" ")).not.toMatch(
      /cannot be a descendant|validateDOMNesting|hydration/i
    );
  });
});
