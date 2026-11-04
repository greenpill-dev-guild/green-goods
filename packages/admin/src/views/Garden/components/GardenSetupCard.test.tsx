import type { GardenSetup } from "@green-goods/shared/hooks/garden/useGardenOperations";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../../__tests__/test-utils";
import { GardenSetupCard } from "./GardenSetupCard";

function setupWith(overrides: Partial<GardenSetup> = {}): GardenSetup {
  return {
    steps: [
      { id: "name", status: "missing", fix: "self" },
      { id: "community", status: "done", fix: "team" },
      { id: "jars", status: "missing", fix: "team" },
    ],
    needsAttention: true,
    hasPending: false,
    slug: "rio-lab",
    isLoading: false,
    finishing: null,
    finish: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("GardenSetupCard", () => {
  it("stays out of the way for a complete garden", () => {
    const { container } = renderWithProviders(
      <GardenSetupCard setup={setupWith({ needsAttention: false })} />
    );

    expect(container.querySelector('[data-component="GardenSetup"]')).toBeNull();
  });

  it("finishes a part this person can finish and says who can finish the rest", async () => {
    const setup = setupWith();
    const user = userEvent.setup();
    renderWithProviders(<GardenSetupCard setup={setup} />);

    expect(screen.getByText("rio-lab.greengoods.eth")).toBeInTheDocument();
    expect(screen.getByText("The Green Goods team can finish this for you.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Register Name" }));
    expect(setup.finish).toHaveBeenCalledWith("name");
  });

  it("offers no action on a name that waits for the fund", () => {
    renderWithProviders(
      <GardenSetupCard
        setup={setupWith({ steps: [{ id: "name", status: "missing", fix: "waiting" }] })}
      />
    );

    expect(screen.queryByRole("button", { name: "Register Name" })).toBeNull();
    expect(screen.getByText("Waiting for the Green Goods name fund.")).toBeInTheDocument();
  });

  it("shows a part a Green Goods update brings as coming soon, not as missing", () => {
    renderWithProviders(
      <GardenSetupCard
        setup={setupWith({
          needsAttention: false,
          hasPending: true,
          steps: [
            { id: "stewardSafe", status: "done", fix: "team" },
            { id: "settlement", status: "pending", fix: "team", pendingOn: "update" },
          ],
        })}
      />
    );

    expect(
      screen.getByText("Your garden is ready to use. Anything still to come arrives on its own.")
    ).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(
      screen.getByText("Arrives with a Green Goods update. Nothing to do here.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Not set up")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not call a part missing when its read failed", () => {
    renderWithProviders(
      <GardenSetupCard
        setup={setupWith({
          steps: [
            { id: "name", status: "unknown", fix: "self" },
            { id: "jars", status: "missing", fix: "team" },
          ],
        })}
      />
    );

    expect(screen.queryByText("Web name")).toBeNull();
    expect(screen.getByText("Cookie jars")).toBeInTheDocument();
  });
});
