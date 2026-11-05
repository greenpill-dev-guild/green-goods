// TEST-QUALITY: allow-small-test-file - the Actions view's tabs and header line render together nowhere else, and these two cases prove DL-134 where a total could land on either.
import { Domain } from "@green-goods/shared/types/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { renderWithProviders, screen, within } from "../../test-utils";
import Actions from "@/views/Actions";

const mocks = vi.hoisted(() => ({ domain: undefined as number | undefined }));

const ACTIONS = [{ domain: 0 }, { domain: 0 }, { domain: 1 }, { domain: 3 }, { domain: null }];

vi.mock("@green-goods/shared/hooks/admin-ui/actions/useActionsController", () => ({
  useActionsController: () => ({
    actions: ACTIONS,
    canManageActions: false,
    desktopActions: [],
    domainCounts: { all: 5, 0: 2, 1: 1, 2: 0, 3: 1 },
    filters: { sort: "default", domain: mocks.domain },
    isLoading: false,
    isRefreshing: false,
    refetch: vi.fn(),
    routeState: {},
    setFilter: vi.fn(),
    showToolbar: true,
    sortOptions: [],
    stageFilteredActions: [],
  }),
}));
vi.mock("@/views/Actions/ActionsSheetDescriptor", () => ({
  ActionsSheetDescriptor: () => null,
}));

function renderActions() {
  return renderWithProviders(
    <MemoryRouter>
      <Actions />
    </MemoryRouter>
  );
}

/** The route header's status line, as the steward reads it. */
function headerLine() {
  const line = document.querySelector('[data-component="MetaStrip"]');
  return line?.textContent?.replace(/\s+/g, " ").trim();
}

describe("Actions domain tabs (DL-134)", () => {
  beforeEach(() => {
    mocks.domain = undefined;
  });

  it("says the registry's total in the header line and puts no number on a tab", () => {
    renderActions();

    expect(headerLine()).toBe("5actions·3domains");
    const rail = within(screen.getByRole("tablist", { name: "Filter actions by domain" }));
    // A count would join a tab's accessible name, so these exact names prove none.
    for (const name of ["All", "Solar", "Agroforestry", "Education", "Waste"]) {
      expect(rail.getByRole("tab", { name })).toBeInTheDocument();
    }
  });

  it("follows the open domain's tab with that domain's total alone", () => {
    mocks.domain = Domain.SOLAR;
    renderActions();

    expect(headerLine()).toBe("2actions");
    expect(screen.getByRole("tab", { name: "Solar" })).toHaveAttribute("aria-selected", "true");
  });
});
