/** @vitest-environment happy-dom */

import { act, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, Outlet, RouterProvider, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useDashboardNavigation,
  useDashboardRestoration,
} from "../../../hooks/client-ui/useDashboardNavigation";
import { useUIStore, type DashboardSnapshot } from "../../../stores/useUIStore";

vi.mock("../../../hooks/auth/usePrimaryAddress", () => ({
  usePrimaryAddress: () => "0x1111111111111111111111111111111111111111",
}));

const work: DashboardSnapshot = {
  kind: "work",
  tab: "completed",
  pendingFilter: "needsReview",
  completedFilter: "reviewedByYou",
  timeFilter: "week",
  scrollTop: 288,
};
const commitments: DashboardSnapshot = {
  kind: "commitments",
  tab: "over-time",
  direction: "REQUEST",
  scrollTop: 144,
};

function Shell() {
  useDashboardRestoration();
  const dashboard = useDashboardNavigation();
  return (
    <>
      <section hidden={dashboard.isDashboardCovered}>
        <input aria-label="Retained reader" defaultValue="Initial" />
      </section>
      <Outlet />
    </>
  );
}
function Dashboard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const dashboard = useDashboardNavigation();
  return (
    <>
      <button onClick={() => dashboard.leave(snapshot, "/home/garden-1/detail")}>
        Inspect record
      </button>
    </>
  );
}
function Detail({ linked = false }: { linked?: boolean }) {
  const dashboard = useDashboardNavigation();
  const navigate = useNavigate();
  return (
    <>
      <p>{linked ? "Linked work" : "Record detail"}</p>
      <button onClick={() => dashboard.forward("/home/garden-1/work/work-1")}>
        Open linked work
      </button>
      <button onClick={() => dashboard.back()}>App Back</button>
      <button onClick={() => navigate(-1)}>History Back</button>
    </>
  );
}

// MemoryRouter commits synchronously. The PWA's data router runs the Home loader
// when replacing its entry, so another navigation can cancel the pending save.
function journey(snapshot: DashboardSnapshot) {
  return createMemoryRouter(
    [
      {
        element: <Shell />,
        children: [
          { path: "/home", loader: async () => null, element: <Dashboard snapshot={snapshot} /> },
          { path: "/home/garden-1/detail", element: <Detail /> },
          { path: "/home/garden-1/work/work-1", element: <Detail linked /> },
          { path: "/profile", element: <p>Another page</p> },
        ],
      },
    ],
    { initialEntries: ["/home"] }
  );
}

describe("dashboard returns through the PWA data router", () => {
  beforeEach(() => useUIStore.getState().resetForAccountChange());
  afterEach(() => useUIStore.getState().resetForAccountChange());

  it.each([
    work,
    commitments,
  ])("keeps $kind open through records and reveals the same reader on Back", async (snapshot) => {
    const router = journey(snapshot);
    const view = render(<RouterProvider router={router} />);
    const opened: boolean[] = [];
    let stop = () => {};
    try {
      await screen.findByRole("button", { name: "Inspect record" });
      const input = screen.getByRole("textbox", { name: "Retained reader" });
      fireEvent.change(input, { target: { value: "Keep my reader state" } });
      act(() => {
        if (snapshot.kind === "work") useUIStore.getState().openWorkDashboard();
        else useUIStore.getState().openCommitmentsSheet();
      });
      stop = useUIStore.subscribe((state) =>
        opened.push(
          snapshot.kind === "work" ? state.isWorkDashboardOpen : state.isCommitmentsSheetOpen
        )
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Inspect record" }));
      });
      await screen.findByText("Record detail");
      expect(screen.queryByRole("textbox", { name: "Retained reader" })).not.toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Open linked work" }));
      });
      await screen.findByText("Linked work");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "App Back" }));
      });
      await screen.findByText("Record detail");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "History Back" }));
      });
      expect(screen.getByRole("textbox", { name: "Retained reader" })).toBe(input);
      expect(input).toHaveValue("Keep my reader state");
      expect(opened).not.toContain(false);
    } finally {
      stop();
      view.unmount();
      router.dispose();
    }
  });

  it.each([
    work,
    commitments,
  ])("does not reopen $kind while saving its departing entry", async (snapshot) => {
    const router = journey(snapshot);
    const view = render(<RouterProvider router={router} />);
    const opened: boolean[] = [];
    const stop = useUIStore.subscribe((state) => {
      opened.push(state.isWorkDashboardOpen || state.isCommitmentsSheetOpen);
    });
    try {
      await screen.findByRole("button", { name: "Inspect record" });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Inspect record" }));
      });
      await screen.findByText("Record detail");
      expect(opened).not.toContain(true);
    } finally {
      stop();
      view.unmount();
      router.dispose();
    }
  });

  it.each([
    { snapshot: work, back: "App Back" },
    { snapshot: work, back: "History Back" },
    { snapshot: commitments, back: "App Back" },
    { snapshot: commitments, back: "History Back" },
  ])("restores $snapshot.kind and its reader state through $back", async ({ snapshot, back }) => {
    const router = journey(snapshot);
    const view = render(<RouterProvider router={router} />);
    try {
      await screen.findByRole("button", { name: "Inspect record" });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Inspect record" }));
      });
      expect(await screen.findByText("Record detail")).toBeInTheDocument();
      expect(useUIStore.getState().isWorkDashboardOpen).toBe(false);
      expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(false);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: back }));
      });
      expect(await screen.findByRole("button", { name: "Inspect record" })).toBeInTheDocument();
      if (snapshot.kind === "work") {
        expect(useUIStore.getState()).toMatchObject({
          isWorkDashboardOpen: true,
          workDashboardInitialTab: "completed",
          workDashboardInitialPendingFilter: "needsReview",
          workDashboardReturnState: snapshot,
        });
      } else {
        expect(useUIStore.getState()).toMatchObject({
          isCommitmentsSheetOpen: true,
          commitmentsSheetReturnState: snapshot,
        });
      }
    } finally {
      view.unmount();
      router.dispose();
    }
  });
  it.each([
    "App Back",
    "History Back",
  ])("keeps the commitments origin through linked work and %s", async (back) => {
    const router = journey(commitments);
    const view = render(<RouterProvider router={router} />);
    try {
      await screen.findByRole("button", { name: "Inspect record" });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Inspect record" }));
      });
      await screen.findByText("Record detail");
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Open linked work" }));
      });
      expect(await screen.findByText("Linked work")).toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: back }));
      });
      expect(await screen.findByText("Record detail")).toBeInTheDocument();
      expect(useUIStore.getState().isCommitmentsSheetOpen).toBe(false);
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: back }));
      });
      expect(await screen.findByRole("button", { name: "Inspect record" })).toBeInTheDocument();
      expect(useUIStore.getState()).toMatchObject({
        isCommitmentsSheetOpen: true,
        commitmentsSheetReturnState: commitments,
      });
    } finally {
      view.unmount();
      router.dispose();
    }
  });
});
