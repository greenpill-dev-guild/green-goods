// TEST-QUALITY: allow-small-test-file - the stage redirect's route item, the older-work reading and the refresh's stage are wiring only this controller owns.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RefreshActionProvider,
  useRefreshActionValue,
} from "../../../components/Canvas/RefreshActionContext";
import { useHubWorkbenchController } from "../../../hooks/admin-ui/hub/useHubWorkbenchController";

const GARDEN = "0x1111111111111111111111111111111111111111";

const pages = () => ({
  hasOlder: false,
  loadOlder: vi.fn(),
  reread: vi.fn(),
  isLoadingOlder: false,
  readAt: 1,
});
// By default the reader is an evaluator: no Work stage, so a link to it moves to Assessments.
const evaluatorGarden = () => ({
  canManage: false,
  canReview: true,
  works: [],
  workPages: pages(),
  assessments: [],
  hypercerts: [],
  hypercertPages: pages(),
  allocations: [],
  gardenVaults: [],
  roleMembers: {},
});
const detail = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock("../../../hooks/garden/useGardenDetailData", () => ({
  useGardenDetailData: () => detail.current,
}));
vi.mock("../../../hooks/garden/useAdminGardenWorkspaceSelection", () => ({
  useAdminGardenWorkspaceSelection: () => ({
    selectedGarden: { id: GARDEN },
    gardenOptions: [],
    handleSelectGarden: () => {},
  }),
}));
vi.mock("../../../hooks/garden/useGardenDerivedState", () => ({
  useGardenDerivedState: () => ({ reviewQueue: { waitingOverWeekCount: 0 } }),
}));
vi.mock("../../../hooks/blockchain/useBaseLists", () => ({
  useActions: () => ({ data: [] }),
}));
vi.mock("../../../hooks/work/useReviewBatch", () => ({
  useReviewBatch: () => ({}),
}));
const confirmStage = vi.hoisted(() => ({ toConfirm: {} as Record<string, unknown> }));
vi.mock("../../../hooks/admin-ui/hub/useHubConfirmStage", () => ({
  useHubConfirmStage: () => ({
    chainId: 42161,
    viewer: null,
    toConfirm: confirmStage.toConfirm,
    handleOpenCommitment: () => {},
    handleCloseCommitment: () => {},
  }),
}));
vi.mock("../../../hooks/admin-ui/hub/useHubStageQueues", () => ({
  useHubStageQueues: () => ({
    scopedWorks: [],
    assessmentList: [],
    hypercertList: [],
    selectedWork: undefined,
    selectedCertification: undefined,
  }),
}));

function Probe() {
  const hub = useHubWorkbenchController();
  return (
    <>
      <output data-testid="route-item">{hub.routeItem ?? "none"}</output>
      <output data-testid="reads-work-history">{String(hub.readsWorkHistory)}</output>
    </>
  );
}

/** The top bar's refresh, as the AppBar reads it. */
function RefreshProbe() {
  const action = useRefreshActionValue();
  if (!action) return null;
  return (
    <button
      type="button"
      data-testid="refresh"
      data-busy={String(Boolean(action.isFetching))}
      onClick={action.onRefresh}
    />
  );
}

beforeEach(() => {
  detail.current = evaluatorGarden();
  confirmStage.toConfirm = { isSteward: false, count: 0 };
});

const router: { current?: ReturnType<typeof createMemoryRouter> } = {};

function renderAt(path: string) {
  router.current = createMemoryRouter([{ path: "/hub/:stage", element: <Probe /> }], {
    initialEntries: [path],
  });
  const current = router.current;
  render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <RefreshActionProvider>
        <RouterProvider router={current} />
        <RefreshProbe />
      </RefreshActionProvider>
    </IntlProvider>
  );
  return current;
}

const currentUrl = (router: ReturnType<typeof renderAt>) =>
  `${router.state.location.pathname}${router.state.location.search}`;

describe("useHubWorkbenchController: a create flow's route item (DL-140)", () => {
  it("goes along when the reader's role moves them off a stage", async () => {
    const router = renderAt(`/hub/work?gardenId=${GARDEN}&item=create-assessment`);

    await waitFor(() =>
      expect(currentUrl(router)).toBe(
        `/hub/assess?gardenId=${GARDEN}&sort=newest&item=create-assessment`
      )
    );
    expect(screen.getByTestId("route-item")).toHaveTextContent("create-assessment");
  });

  it("does not carry an item that names no create flow", async () => {
    const router = renderAt(`/hub/work?gardenId=${GARDEN}&item=old-item`);

    await waitFor(() =>
      expect(currentUrl(router)).toBe(`/hub/assess?gardenId=${GARDEN}&sort=newest`)
    );
    expect(screen.getByTestId("route-item")).toHaveTextContent("none");
  });

  it("is not invented for a redirect that has none", async () => {
    const router = renderAt(`/hub/work?gardenId=${GARDEN}`);

    await waitFor(() =>
      expect(currentUrl(router)).toBe(`/hub/assess?gardenId=${GARDEN}&sort=newest`)
    );
    expect(screen.getByTestId("route-item")).toHaveTextContent("none");
  });
});

// Oldest first reads a steward's whole work history before listing it, but a
// failed read never lands its page: reading on would hide the tab's error.
describe("useHubWorkbenchController: reading older work for Oldest first", () => {
  it.each([
    { read: "succeeds", worksError: null, reads: true },
    { read: "fails", worksError: new Error("EAS unavailable"), reads: false },
  ])("reads the history while the work read $read", async ({ worksError, reads }) => {
    const workPages = { ...pages(), hasOlder: true };
    detail.current = { ...evaluatorGarden(), canManage: true, workPages, worksError };

    renderAt(`/hub/work?gardenId=${GARDEN}&sort=oldest`);

    await waitFor(() =>
      expect(screen.getByTestId("reads-work-history")).toHaveTextContent(String(reads))
    );
    expect(workPages.loadOlder).toHaveBeenCalledTimes(reads ? 1 : 0);
  });
});

// PRD-1087: the refresh rereads the list the open tab shows, and its busy state
// follows that read. It used to reread work, and spin with it, on every tab.
describe("useHubWorkbenchController: the top bar's refresh", () => {
  const STAGES = ["work", "assess", "certify", "confirm"] as const;

  function openTab(
    stage: (typeof STAGES)[number],
    running: (read: string) => boolean,
    garden: Record<string, unknown> = {}
  ) {
    const refresh = {
      work: vi.fn(),
      assess: vi.fn(async () => undefined),
      certify: vi.fn(async () => []),
      confirm: vi.fn(async () => undefined),
    };
    detail.current = {
      ...evaluatorGarden(),
      canManage: true,
      refreshWorks: refresh.work,
      worksFetching: running("work"),
      refreshAssessments: refresh.assess,
      assessmentsFetching: running("assess"),
      refreshHypercerts: refresh.certify,
      hypercertsFetching: running("certify"),
      ...garden,
    };
    confirmStage.toConfirm = {
      isSteward: true,
      count: 0,
      refetch: refresh.confirm,
      isFetching: running("confirm"),
    };
    renderAt(`/hub/${stage}?gardenId=${GARDEN}`);
    return refresh;
  }

  it.each(STAGES)("rereads only what the %s tab lists", async (stage) => {
    // Every other tab's read is running, so a busy button would be one of theirs.
    const refresh = openTab(stage, (read) => read !== stage);

    const button = await screen.findByTestId("refresh");
    expect(button).toHaveAttribute("data-busy", "false");
    fireEvent.click(button);
    for (const read of STAGES) {
      expect(refresh[read]).toHaveBeenCalledTimes(read === stage ? 1 : 0);
    }
  });

  it.each(STAGES)("is busy while the %s tab's read runs", async (stage) => {
    openTab(stage, (read) => read === stage);

    expect(await screen.findByTestId("refresh")).toHaveAttribute("data-busy", "true");
  });

  it("follows the tab a steward moves to", async () => {
    const refresh = openTab("work", () => false);
    await screen.findByTestId("refresh");

    await act(() => router.current?.navigate(`/hub/certify?gardenId=${GARDEN}`));
    fireEvent.click(screen.getByTestId("refresh"));
    expect(refresh.certify).toHaveBeenCalledTimes(1);
    expect(refresh.work).not.toHaveBeenCalled();
  });

  // The garden list failing fails every tab, so each tab's refresh rereads it.
  it("rereads a failed garden list with the tab's own list, and is busy with it", async () => {
    const refreshGardens = vi.fn(async () => undefined);
    const refresh = openTab("assess", () => false, {
      error: new Error("indexer unavailable"),
      refreshGardens,
      gardensFetching: true,
    });

    const button = await screen.findByTestId("refresh");
    expect(button).toHaveAttribute("data-busy", "true");
    fireEvent.click(button);
    expect(refresh.assess).toHaveBeenCalledTimes(1);
    expect(refreshGardens).toHaveBeenCalledTimes(1);
  });

  describe("by width", () => {
    const original = vi.mocked(window.matchMedia).getMockImplementation();
    afterEach(() => {
      if (original) vi.mocked(window.matchMedia).mockImplementation(original);
    });

    // The top bar draws the refresh below 1024px; the Hub registered it below 600px only.
    it.each([
      { width: 390, shown: true },
      { width: 768, shown: true },
      { width: 1280, shown: false },
    ])("offers it at $width px: $shown", async ({ width, shown }) => {
      vi.mocked(window.matchMedia).mockImplementation(
        (query: string) =>
          ({
            matches: Number(/min-width:\s*(\d+)px/.exec(query)?.[1] ?? Infinity) <= width,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
          }) as unknown as MediaQueryList
      );
      openTab("certify", () => false);

      await waitFor(() => expect(screen.getByTestId("route-item")).toBeInTheDocument());
      await act(async () => {});
      expect(screen.queryByTestId("refresh") !== null).toBe(shown);
    });
  });
});
