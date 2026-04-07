/**
 * Legacy Route Redirect Map Tests
 * @vitest-environment jsdom
 *
 * RED phase — verifies that all legacy routes redirect to their
 * consolidated cockpit equivalents. Simple redirects already work;
 * complex param-mapping redirects (gardens/:id/*, actions/*) are
 * expected to FAIL until the redirect components are wired into
 * the router.
 */

import React from "react";
import { MemoryRouter, Route, Routes, Navigate, useLocation, useParams } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "react-intl";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock shared barrel — LegacyRedirects only needs toastService
vi.mock("@green-goods/shared", () => ({
  toastService: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Component that captures the current location for assertion.
 * Renders location.pathname + location.search as text content.
 */
function LocationDisplay() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderWithRouter(initialPath: string, routes: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={{}} onError={() => {}}>
      <MemoryRouter initialEntries={[initialPath]}>
        {routes}
        <LocationDisplay />
      </MemoryRouter>
    </IntlProvider>
  );
}

// Import the actual redirect components to test them
import {
  DashboardRedirect,
  GardensListRedirect,
  AssessmentsRedirect,
  EndowmentsRedirect,
  ContractsRedirect,
  DeploymentRedirect,
  GardenDetailRedirect,
  GardenWorkDetailRedirect,
  GardenVaultRedirect,
  GardenStrategiesRedirect,
  GardenAssessmentsRedirect,
  GardenHypercertsRedirect,
  GardenSubmitWorkRedirect,
  ActionDetailRedirect,
  ActionCreateRedirect,
  ActionEditRedirect,
} from "@/routes/LegacyRedirects";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Legacy Route Redirect Map", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("simple redirects", () => {
    it.each([
      ["/", "/work"],
      ["/dashboard", "/work"],
      ["/gardens", "/work"],
      ["/assessments", "/work"],
      ["/endowments", "/community"],
      ["/contracts", "/work"],
      ["/deployment", "/work"],
    ] as const)("redirects %s to %s", (from, to) => {
      const routeMap: Record<string, React.ReactElement> = {
        "/": <Navigate to="/work" replace />,
        "/dashboard": <DashboardRedirect />,
        "/gardens": <GardensListRedirect />,
        "/assessments": <AssessmentsRedirect />,
        "/endowments": <EndowmentsRedirect />,
        "/contracts": <ContractsRedirect />,
        "/deployment": <DeploymentRedirect />,
      };

      renderWithRouter(
        from,
        <Routes>
          <Route path={from} element={routeMap[from]} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toContain(to);
    });
  });

  describe("complex param-mapping redirects", () => {
    it("redirects /gardens/:id?tab=work to /work?garden=:id", () => {
      renderWithRouter(
        "/gardens/garden-42?tab=work",
        <Routes>
          <Route path="gardens/:id" element={<GardenDetailRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/work?garden=garden-42");
    });

    it("redirects /gardens/:id?tab=community to /community?garden=:id", () => {
      renderWithRouter(
        "/gardens/garden-42?tab=community",
        <Routes>
          <Route path="gardens/:id" element={<GardenDetailRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/community?garden=garden-42");
    });

    it("redirects /gardens/:id/work/:workId to /work?garden=:id&item=:workId", () => {
      renderWithRouter(
        "/gardens/garden-42/work/work-7",
        <Routes>
          <Route path="gardens/:id/work/:workId" element={<GardenWorkDetailRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/work?garden=garden-42&item=work-7");
    });

    it("redirects /gardens/:id/vault to /community?garden=:id&card=treasury", () => {
      renderWithRouter(
        "/gardens/garden-42/vault",
        <Routes>
          <Route path="gardens/:id/vault" element={<GardenVaultRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/community?garden=garden-42&card=treasury");
    });

    it("redirects /gardens/:id/strategies to /community?garden=:id&card=treasury", () => {
      renderWithRouter(
        "/gardens/garden-42/strategies",
        <Routes>
          <Route path="gardens/:id/strategies" element={<GardenStrategiesRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/community?garden=garden-42&card=treasury");
    });

    it("redirects /gardens/:id/assessments to /work?garden=:id&view=assessments", () => {
      renderWithRouter(
        "/gardens/garden-42/assessments",
        <Routes>
          <Route path="gardens/:id/assessments" element={<GardenAssessmentsRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/work?garden=garden-42&view=assessments");
    });

    it("redirects /gardens/:id/hypercerts to /work?garden=:id&view=hypercerts", () => {
      renderWithRouter(
        "/gardens/garden-42/hypercerts",
        <Routes>
          <Route path="gardens/:id/hypercerts" element={<GardenHypercertsRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/work?garden=garden-42&view=hypercerts");
    });

    it("redirects /gardens/:id/submit-work to /work?garden=:id&action=submit", () => {
      renderWithRouter(
        "/gardens/garden-42/submit-work",
        <Routes>
          <Route path="gardens/:id/submit-work" element={<GardenSubmitWorkRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/work?garden=garden-42&action=submit");
    });

    it("redirects /actions/:id to /actions?item=:id", () => {
      renderWithRouter(
        "/actions/action-99",
        <Routes>
          <Route path="actions/:id" element={<ActionDetailRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/actions?item=action-99");
    });

    it("redirects /actions/create to /actions?action=create", () => {
      renderWithRouter(
        "/actions/create",
        <Routes>
          <Route path="actions/create" element={<ActionCreateRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/actions?action=create");
    });

    it("redirects /actions/:id/edit to /actions?item=:id&action=edit", () => {
      renderWithRouter(
        "/actions/action-99/edit",
        <Routes>
          <Route path="actions/:id/edit" element={<ActionEditRedirect />} />
          <Route path="*" element={null} />
        </Routes>
      );

      const location = screen.getByTestId("location");
      expect(location.textContent).toBe("/actions?item=action-99&action=edit");
    });
  });
});
