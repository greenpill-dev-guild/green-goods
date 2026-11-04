// TEST-QUALITY: allow-small-test-file - the stage redirect's route item and the older-work reading are wiring only this controller owns.
import { render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "react-intl";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
vi.mock("../../../hooks/admin-ui/hub/useHubConfirmStage", () => ({
  useHubConfirmStage: () => ({
    chainId: 42161,
    viewer: null,
    toConfirm: { isSteward: false, count: 0 },
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

beforeEach(() => {
  detail.current = evaluatorGarden();
});

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/hub/:stage", element: <Probe /> }], {
    initialEntries: [path],
  });
  render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <RouterProvider router={router} />
    </IntlProvider>
  );
  return router;
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
