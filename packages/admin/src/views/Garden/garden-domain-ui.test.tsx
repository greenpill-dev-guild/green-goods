import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enMessages from "../../../../shared/src/i18n/en.json";
import { useGardenWorkspaceController } from "@green-goods/shared";
import { GardenDomainSummaryRow } from "./components/GardenDetailHelpers";
import { GardenWorkspaceContent } from "./components/GardenWorkspaceContent";
import { SubmitWorkPanel } from "./SubmitWork";

const gardenAddress = "0xAbCdEf1234567890aBcDeF1234567890aBcDeF12";

const { mockCanManageGarden } = vi.hoisted(() => ({
  mockCanManageGarden: vi.fn(() => true),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  const React = await import("react");

  return {
    ...actual,
    useGardenWorkspaceController: () => {
      const [domainEditorOpen, setDomainEditorOpen] = React.useState(false);
      return {
        activityFilter: "all",
        assessments: [],
        assessmentsError: null,
        canManage: mockCanManageGarden(),
        canReview: false,
        canvasActivityEvents: [],
        clearSection: vi.fn(),
        closeDomainEditor: () => setDomainEditorOpen(false),
        community: null,
        containerRef: { current: null },
        derived: {
          overviewAlerts: [],
          gardenHealthLabel: "Healthy",
          approvedInRangeCount: 0,
          impactVelocityDelta: 0,
          medianReviewAgeHours: 0,
          pendingWorks: [],
          filteredActivityEvents: [],
        },
        desktopActions: [],
        domainEditorOpen,
        error: null,
        fetching: false,
        fetchingAssessments: false,
        garden: {
          id: gardenAddress,
          tokenAddress: gardenAddress,
          tokenID: "1",
          chainId: 11155111,
          name: "No Domain Garden",
          description: "A garden without domains",
          location: "Earth",
          bannerImage: "",
          domainMask: 0,
          openJoining: true,
          maxGardeners: 42,
          gardeners: [],
          operators: [],
          evaluators: [],
          funders: [],
          owners: [gardenAddress],
        },
        gardenAddress,
        gardenOptions: [],
        handleSelectGarden: vi.fn(),
        handleTabChange: vi.fn(),
        hypercertId: undefined,
        hypercerts: [],
        hypercertSheetCloseTo: "/garden",
        isOwner: true,
        openDomainEditor: () => setDomainEditorOpen(true),
        openSection: vi.fn(),
        range: "30d",
        section: undefined,
        selectedGarden: {
          id: gardenAddress,
          tokenAddress: gardenAddress,
          name: "No Domain Garden",
        },
        selectedItem: undefined,
        setActivityFilter: vi.fn(),
        treasuryBalance: "0",
        updateOverviewQueryState: vi.fn(),
        view: "settings",
      };
    },
    useCanvasSearchParams: () => ({
      searchParams: new URLSearchParams(),
      updateSearch: vi.fn(),
    }),
    useGardenStateStore: (selector: (state: unknown) => unknown) =>
      selector({
        getGardenWorkspaceState: () => ({
          activeMode: "settings",
          filter: "all",
          scrollPosition: 0,
        }),
        setGardenWorkspaceState: vi.fn(),
      }),
    useSheetWidth: () => ({ containerRef: { current: null } }),
    useMediaQuery: () => true,
    useViewActions: ({ actions }: { actions: Array<{ visible?: boolean }> }) => ({
      desktopActions: actions.filter((action) => action.visible !== false),
    }),
    useAdminGardenWorkspaceSelection: () => ({
      selectedGarden: {
        id: gardenAddress,
        tokenAddress: gardenAddress,
        name: "No Domain Garden",
      },
      gardenOptions: [],
      handleSelectGarden: vi.fn(),
    }),
    useGardenDetailData: () => ({
      garden: {
        id: gardenAddress,
        tokenAddress: gardenAddress,
        tokenID: "1",
        chainId: 11155111,
        name: "No Domain Garden",
        description: "A garden without domains",
        location: "Earth",
        bannerImage: "",
        domainMask: 0,
        openJoining: true,
        maxGardeners: 42,
        gardeners: [],
        operators: [],
        evaluators: [],
        funders: [],
        owners: [gardenAddress],
      },
      fetching: false,
      error: null,
      canManage: mockCanManageGarden(),
      canReview: false,
      isOwner: true,
      assessments: [],
      fetchingAssessments: false,
      assessmentsError: null,
      community: null,
      gardenVaults: [],
      vaultNetDeposited: 0n,
      allocations: [],
      works: [],
      hypercerts: [],
      roleMembers: {},
    }),
    useGardenDerivedState: () => ({
      overviewAlerts: [],
      gardenHealthLabel: "Healthy",
      approvedInRangeCount: 0,
      impactVelocityDelta: 0,
      medianReviewAgeHours: 0,
      pendingWorks: [],
      filteredActivityEvents: [],
    }),
    useGardens: () => ({
      data: [
        {
          id: gardenAddress,
          name: "No Domain Garden",
          domainMask: 0,
        },
      ],
    }),
    useActions: () => ({ data: [] }),
    useAuthState: () => ({ isAuthenticated: true }),
    useGardenPermissions: () => ({ canManageGarden: mockCanManageGarden }),
    useBeforeUnloadWhilePending: () => undefined,
    useGardenDomains: () => ({ data: 0n, isLoading: false }),
    useSetGardenDomains: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
  };
});

vi.mock("@/components/Garden/GardenSettingsEditor", () => ({
  GardenSettingsEditor: () => <div data-testid="garden-settings-editor" />,
}));

function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={enMessages}>
        {children}
      </IntlProvider>
    </QueryClientProvider>
  );
}

describe("garden domain recovery UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanManageGarden.mockReturnValue(true);
  });

  function GardenWorkspaceHarness() {
    const workspace = useGardenWorkspaceController();
    return <GardenWorkspaceContent workspace={workspace} />;
  }

  it("opens the existing domain editor from the garden settings Domains row", async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MemoryRouter initialEntries={["/garden/settings"]}>
          <Routes>
            <Route path="/garden/settings" element={<GardenWorkspaceHarness />} />
          </Routes>
        </MemoryRouter>
      </TestProviders>
    );

    expect(screen.getByText("No domains configured")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Edit domains" }));

    expect(screen.getByRole("dialog", { name: "Edit Domains" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Save domains" })).toBeVisible();
  });

  it("shows the empty-domain status with an inline edit action for managers", () => {
    render(
      <TestProviders>
        <GardenDomainSummaryRow domainMask={0} canManage onEditDomains={vi.fn()} />
      </TestProviders>
    );

    expect(screen.getByText("No domains configured")).toBeVisible();
    expect(screen.getByRole("button", { name: "Edit domains" })).toBeVisible();
  });

  it("keeps the inline edit action hidden for read-only operators", () => {
    render(
      <TestProviders>
        <GardenDomainSummaryRow domainMask={0} canManage={false} onEditDomains={vi.fn()} />
      </TestProviders>
    );

    expect(screen.getByText("No domains configured")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit domains" })).not.toBeInTheDocument();
  });

  it("keeps configured domain labels status-only", () => {
    render(
      <TestProviders>
        <GardenDomainSummaryRow domainMask={1} canManage={false} onEditDomains={vi.fn()} />
      </TestProviders>
    );

    expect(screen.queryByText("No domains configured")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit domains" })).not.toBeInTheDocument();
  });

  it("routes Submit Work's empty domain state back to garden settings", async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MemoryRouter initialEntries={["/hub/work/submit"]}>
          <Routes>
            <Route path="/hub/work/submit" element={<SubmitWorkPanel layout="page" />} />
            <Route path="/garden/settings" element={<div>Garden settings route</div>} />
          </Routes>
        </MemoryRouter>
      </TestProviders>
    );

    expect(screen.getByText("No actions available for this garden's domains")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Configure domains" }));

    expect(screen.getByText("Garden settings route")).toBeVisible();
  });
});
