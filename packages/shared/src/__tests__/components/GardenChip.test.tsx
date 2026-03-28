/**
 * GardenChip Tests
 *
 * Verifies the GardenChip renders a static label for single gardens,
 * opens a popover dropdown for multi-garden selection, and handles
 * "All Gardens" and "Create Garden" interactions.
 *
 * @vitest-environment jsdom
 */

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock react-intl
vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => {
      const messages: Record<string, string> = {
        "cockpit.gardenChip.allGardens": "All Gardens",
        "cockpit.gardenChip.createGarden": "Create Garden",
      };
      return messages[id] ?? id;
    },
  }),
}));

import { GardenChip } from "../../components/Cockpit/GardenChip";

const GARDEN_A = { id: "0x1111", name: "Wildflower Meadow" };
const GARDEN_B = { id: "0x2222", name: "Urban Composting" };

describe("GardenChip", () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // --------------------------------------------------------------------------
  // Single garden (static label, D47)
  // --------------------------------------------------------------------------

  it("renders a static label when only 1 garden", () => {
    render(<GardenChip gardens={[GARDEN_A]} selectedGarden={GARDEN_A} onSelectGarden={() => {}} />);

    expect(screen.getByText("Wildflower Meadow")).toBeTruthy();
    // Should be a span, not a button
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("does not show a dropdown trigger for single garden", () => {
    render(<GardenChip gardens={[GARDEN_A]} selectedGarden={GARDEN_A} onSelectGarden={() => {}} />);

    // No button = no dropdown trigger
    expect(screen.queryByRole("button")).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Multiple gardens (dropdown)
  // --------------------------------------------------------------------------

  it("renders a button trigger when multiple gardens", () => {
    render(
      <GardenChip
        gardens={[GARDEN_A, GARDEN_B]}
        selectedGarden={GARDEN_A}
        onSelectGarden={() => {}}
      />
    );

    const trigger = screen.getByRole("button");
    expect(trigger).toBeTruthy();
    expect(trigger.textContent).toContain("Wildflower Meadow");
  });

  it("shows 'All Gardens' when selectedGarden is null", () => {
    render(
      <GardenChip gardens={[GARDEN_A, GARDEN_B]} selectedGarden={null} onSelectGarden={() => {}} />
    );

    const trigger = screen.getByRole("button");
    expect(trigger.textContent).toContain("All Gardens");
  });

  it("opens dropdown on click and shows all options", async () => {
    render(
      <GardenChip
        gardens={[GARDEN_A, GARDEN_B]}
        selectedGarden={GARDEN_A}
        onSelectGarden={() => {}}
        onCreateGarden={() => {}}
      />
    );

    await user.click(screen.getByRole("button"));

    // Should see "All Gardens", both garden names, and "Create Garden"
    // "Wildflower Meadow" appears in both the trigger chip and the dropdown list
    expect(screen.getByText("All Gardens")).toBeTruthy();
    expect(screen.getAllByText("Wildflower Meadow").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Urban Composting")).toBeTruthy();
    expect(screen.getByText("Create Garden")).toBeTruthy();
  });

  it("calls onSelectGarden(null) when 'All Gardens' is clicked", async () => {
    const onSelectGarden = vi.fn();
    render(
      <GardenChip
        gardens={[GARDEN_A, GARDEN_B]}
        selectedGarden={GARDEN_A}
        onSelectGarden={onSelectGarden}
      />
    );

    await user.click(screen.getByRole("button"));

    // The dropdown "All Gardens" button
    const allGardensBtn = screen.getByText("All Gardens").closest("button")!;
    await user.click(allGardensBtn);

    expect(onSelectGarden).toHaveBeenCalledWith(null);
  });

  it("calls onSelectGarden with the garden when a garden option is clicked", async () => {
    const onSelectGarden = vi.fn();
    render(
      <GardenChip
        gardens={[GARDEN_A, GARDEN_B]}
        selectedGarden={null}
        onSelectGarden={onSelectGarden}
      />
    );

    await user.click(screen.getByRole("button"));

    const gardenBBtn = screen.getByText("Urban Composting").closest("button")!;
    await user.click(gardenBBtn);

    expect(onSelectGarden).toHaveBeenCalledWith(GARDEN_B);
  });

  it("calls onCreateGarden when 'Create Garden' is clicked", async () => {
    const onCreateGarden = vi.fn();
    render(
      <GardenChip
        gardens={[GARDEN_A, GARDEN_B]}
        selectedGarden={GARDEN_A}
        onSelectGarden={() => {}}
        onCreateGarden={onCreateGarden}
      />
    );

    await user.click(screen.getByRole("button"));

    const createBtn = screen.getByText("Create Garden").closest("button")!;
    await user.click(createBtn);

    expect(onCreateGarden).toHaveBeenCalledOnce();
  });

  it("does not render 'Create Garden' when onCreateGarden is not provided", async () => {
    render(
      <GardenChip
        gardens={[GARDEN_A, GARDEN_B]}
        selectedGarden={GARDEN_A}
        onSelectGarden={() => {}}
      />
    );

    await user.click(screen.getByRole("button"));

    expect(screen.queryByText("Create Garden")).toBeNull();
  });

  it("truncates long garden names with title attribute", () => {
    const longNameGarden = {
      id: "0x3333",
      name: "An Extremely Long Garden Name That Should Be Truncated",
    };

    render(
      <GardenChip
        gardens={[longNameGarden]}
        selectedGarden={longNameGarden}
        onSelectGarden={() => {}}
      />
    );

    const truncatedSpan = screen.getByTitle(
      "An Extremely Long Garden Name That Should Be Truncated"
    );
    expect(truncatedSpan).toBeTruthy();
  });

  it("applies max-w-[200px] to the chip container", () => {
    render(
      <GardenChip
        gardens={[GARDEN_A, GARDEN_B]}
        selectedGarden={GARDEN_A}
        onSelectGarden={() => {}}
      />
    );

    const trigger = screen.getByRole("button");
    expect(trigger.className).toContain("max-w-[200px]");
  });
});
