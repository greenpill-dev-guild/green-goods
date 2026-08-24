import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter, Route, RouterProvider, Routes, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGardenWorkspaceController } from "@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController";
import enMessages from "@green-goods/shared/i18n/en";
import { GardenWorkspaceContent } from "./components/GardenWorkspaceContent";
import { SubmitWorkPanel } from "./SubmitWork";

const gardenAddress = "0xAbCdEf1234567890aBcDeF1234567890aBcDeF12";

const { mockCanManageGarden, settingsEditorProbe } = vi.hoisted(() => ({
  mockCanManageGarden: vi.fn(() => true),
  // Captures the dirty-state reporter the workspace passes to the (mocked)
  // settings editor, so tests can drive the dialog's close guard directly.
  settingsEditorProbe: {
    reportDirtyState: undefined as
      | undefined
      | ((state: { isDirty: boolean; isSaving: boolean }) => void),
  },
}));

vi.mock("@green-goods/shared/components/Canvas/useViewActions", () => ({
  useViewActions: ({ actions }: { actions: Array<{ visible?: boolean }> }) => ({
    desktopActions: actions.filter((action) => action.visible !== false),
  }),
}));

vi.mock("@green-goods/shared/hooks/admin-ui/garden/useGardenWorkspaceController", async () => {
  const Router = await import("react-router-dom");
  return {
    useGardenWorkspaceController: () => {
      // Route-faithful stub: the real controller derives the view from the
      // pathname and closes the settings dialog by navigating — the dirty-close
      // guard's router blocker only exists on that navigation path.
      const navigate = Router.useNavigate();
      const location = Router.useLocation();
      return {
        activityFilter: "all",
        assessments: [],
        assessmentsError: null,
        canManage: mockCanManageGarden(),
        canReview: false,
        canvasActivityEvents: [],
        clearSection: vi.fn(),
        community: null,
        containerRef: { current: null },
        derived: {
          overviewAlerts: [],
          domainLabels: [],
          impactBadge: { severity: "none" },
          gardenHealthLabel: "Healthy",
          approvedInRangeCount: 0,
          approvedInLastThirtyDays: 0,
          impactVelocityDelta: 0,
          medianReviewAgeHours: 0,
          pendingWorks: [],
          filteredActivityEvents: [],
        },
        desktopActions: [],
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
        handleSettingsClose: () => navigate("/garden/health"),
        handleTabChange: (nextView: string) =>
          navigate(nextView === "settings" ? "/garden/settings" : "/garden/health"),
        hypercertId: undefined,
        hypercerts: [],
        hypercertSheetCloseTo: "/garden",
        isOwner: true,
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
        settingsOpen: location.pathname.endsWith("/settings"),
        treasuryBalance: "0",
        updateOverviewQueryState: vi.fn(),
        view: location.pathname.endsWith("/impact")
          ? "impact"
          : location.pathname.endsWith("/activity")
            ? "activity"
            : "health",
      };
    },
  };
});

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", () => ({
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
}));

vi.mock("@green-goods/shared/hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({
    selectedGarden: {
      id: gardenAddress,
      tokenAddress: gardenAddress,
      name: "No Domain Garden",
    },
    gardenOptions: [],
    handleSelectGarden: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenDerivedState", () => ({
  useGardenDerivedState: () => ({
    overviewAlerts: [],
    domainLabels: [],
    impactBadge: { severity: "none" },
    gardenHealthLabel: "Healthy",
    approvedInRangeCount: 0,
    approvedInLastThirtyDays: 0,
    impactVelocityDelta: 0,
    medianReviewAgeHours: 0,
    pendingWorks: [],
    filteredActivityEvents: [],
  }),
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenDetailData", () => ({
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
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenDomains", () => ({
  useGardenDomains: () => ({ data: 0n, isLoading: false }),
}));

vi.mock("@green-goods/shared/hooks/garden/useGardenPermissions", () => ({
  useGardenPermissions: () => ({ canManageGarden: mockCanManageGarden }),
}));

vi.mock("@green-goods/shared/hooks/garden/useSetGardenDomains", () => ({
  useSetGardenDomains: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
}));

vi.mock("@green-goods/shared/hooks/navigation/useCanvasSearchParams", () => ({
  useCanvasSearchParams: () => ({
    searchParams: new URLSearchParams(),
    updateSearch: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/hooks/ui/useMediaQuery", () => ({
  useMediaQuery: () => true,
}));

vi.mock("@green-goods/shared/hooks/useSheetWidth", () => ({
  useSheetWidth: () => ({ containerRef: { current: null } }),
}));

vi.mock("@green-goods/shared/hooks/utils/useBeforeUnloadWhilePending", () => ({
  useBeforeUnloadWhilePending: () => undefined,
}));

vi.mock("@green-goods/shared/hooks/work/useWorkMutation", () => ({
  useWorkMutation: () => ({
    error: null,
    isPending: false,
    mutate: vi.fn(),
  }),
}));

vi.mock("@green-goods/shared/providers/Auth", () => ({
  useAuthState: () => ({ isAuthenticated: true, authMode: "wallet" }),
}));

vi.mock("@green-goods/shared/stores/useGardenStateStore", () => ({
  useGardenStateStore: (selector: (state: unknown) => unknown) =>
    selector({
      getGardenWorkspaceState: () => ({
        activeMode: "settings",
        filter: "all",
        scrollPosition: 0,
      }),
      setGardenWorkspaceState: vi.fn(),
    }),
}));

vi.mock("@/components/Garden/GardenSettingsEditor", () => ({
  GardenSettingsEditor: (props: {
    onDirtyStateChange?: (state: { isDirty: boolean; isSaving: boolean }) => void;
  }) => {
    settingsEditorProbe.reportDirtyState = props.onDirtyStateChange;
    return <div data-testid="garden-settings-editor" />;
  },
}));

// The settings dialog also hosts the cookie-jar manage modal, whose
// useGardenCookieJars hook reads wagmi context this harness doesn't provide —
// out of scope for the domain-editor flow under test.
vi.mock("@/views/Hub/components/CookieJarManageModal", () => ({
  CookieJarManageModal: () => null,
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

  // Data router (not <MemoryRouter>): the settings dialog's dirty-close guard
  // uses useBlocker, which requires the data-router APIs — same pattern as
  // CreateAssessmentDialog.test.tsx.
  function renderWorkspaceAtSettings() {
    const router = createMemoryRouter(
      [
        { path: "/garden/settings", element: <GardenWorkspaceHarness /> },
        { path: "/garden/health", element: <div>Health route</div> },
      ],
      { initialEntries: ["/garden/settings"] }
    );
    render(
      <TestProviders>
        <RouterProvider router={router} />
      </TestProviders>
    );
    return router;
  }

  it("closes pristine garden settings straight to health with no discard prompt", async () => {
    const user = userEvent.setup();

    renderWorkspaceAtSettings();

    expect(screen.getByRole("dialog", { name: "Garden Profile" })).toBeVisible();

    await user.keyboard("{Escape}");

    expect(await screen.findByText("Health route")).toBeVisible();
    expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
  });

  it("prompts before discarding dirty garden settings and keeps editing on cancel", async () => {
    const user = userEvent.setup();

    renderWorkspaceAtSettings();
    act(() => settingsEditorProbe.reportDirtyState?.({ isDirty: true, isSaving: false }));

    await user.keyboard("{Escape}");

    expect(await screen.findByText("Discard Changes?")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Keep editing" }));

    expect(screen.getByRole("dialog", { name: "Garden Profile" })).toBeVisible();
    expect(screen.queryByText("Health route")).not.toBeInTheDocument();
  });

  it("discards dirty garden settings to health on confirm", async () => {
    const user = userEvent.setup();

    renderWorkspaceAtSettings();
    act(() => settingsEditorProbe.reportDirtyState?.({ isDirty: true, isSaving: false }));

    await user.keyboard("{Escape}");
    await user.click(await screen.findByRole("button", { name: "Discard" }));

    expect(await screen.findByText("Health route")).toBeVisible();
  });

  it("hard-blocks closing garden settings while a save is in flight", async () => {
    const user = userEvent.setup();

    renderWorkspaceAtSettings();
    act(() => settingsEditorProbe.reportDirtyState?.({ isDirty: true, isSaving: true }));

    await user.keyboard("{Escape}");

    expect(screen.getByRole("dialog", { name: "Garden Profile" })).toBeVisible();
    expect(screen.queryByText("Discard Changes?")).not.toBeInTheDocument();
  });

  it("routes Submit Work's empty domain state back to garden settings", async () => {
    const user = userEvent.setup();

    render(
      <TestProviders>
        <MemoryRouter initialEntries={["/hub/work/submit"]}>
          <Routes>
            <Route
              path="/hub/work/submit"
              element={
                <SubmitWorkPanel
                  layout="page"
                  auth={{
                    authMode: "wallet",
                    isAuthenticated: true,
                    primaryAddress: gardenAddress,
                  }}
                />
              }
            />
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
