/**
 * Dashboard View Tests
 *
 * Tests the admin dashboard rendering for different roles (deployer, operator, user).
 * Verifies stats, garden list, loading, and error states.
 */

import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();
const mockUseRole = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useGardens: () => mockUseGardens(),
  useRole: () => mockUseRole(),
  useWindowEvent: vi.fn(),
  useProtocolMemberStatus: () => ({ data: false }),
  useSlugForm: () => ({
    register: () => ({}),
    watch: () => "",
    trigger: vi.fn(),
    getValues: vi.fn(),
    reset: vi.fn(),
    formState: { errors: {} },
  }),
  useSlugAvailability: () => ({ data: undefined, isFetching: false }),
  useENSClaim: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useENSRegistrationStatus: () => ({ data: undefined }),
  ENSProgressTimeline: () => null,
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890abcdef1234567890abcdef12345678" }),
}));

vi.mock("@remixicon/react", () => {
  const Icon = (props: any) => React.createElement("span", props);
  return {
    RiCheckLine: Icon,
    RiGlobalLine: Icon,
    RiLoader4Line: Icon,
    RiPlantLine: Icon,
    RiUserLine: Icon,
    RiWifiOffLine: Icon,
  };
});

import Dashboard from "@/views/Dashboard";

function renderWithIntl(ui: React.ReactElement) {
  return render(React.createElement(IntlProvider, { locale: "en", messages: {} }, ui));
}

const mockGardens = [
  {
    id: "garden-1",
    name: "Community Garden",
    location: "Central Park",
    gardeners: ["0xG1", "0xG2"],
    operators: ["0xO1"],
  },
  {
    id: "garden-2",
    name: "Urban Farm",
    location: "Brooklyn",
    gardeners: ["0xG3"],
    operators: ["0xO1", "0xO2"],
  },
];

describe("Dashboard View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows loading skeleton while data is fetching", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: [], isLoading: true, error: null });

      renderWithIntl(<Dashboard />);

      expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("shows error message when indexer connection fails", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error("Connection refused"),
      });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Indexer Connection Issue")).toBeInTheDocument();
      expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
    });

    it("shows quick actions in error fallback", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error("timeout"),
      });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      expect(screen.getByText("View Gardens")).toBeInTheDocument();
    });

    it("shows contract management for deployer role in error state", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({
        data: [],
        isLoading: false,
        error: new Error("error"),
      });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Contract Management")).toBeInTheDocument();
    });
  });

  describe("deployer role", () => {
    it("renders welcome message for deployer", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      // "Welcome back," and "Deployer" are in the same h1 element
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent(/Welcome back.*Deployer/);
    });

    it("shows total gardens stat", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Total Gardens")).toBeInTheDocument();
      // "2" appears in the garden count stat
      const statValues = screen.getAllByText("2");
      expect(statValues.length).toBeGreaterThan(0);
    });

    it("shows operator and gardener counts", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Total Operators")).toBeInTheDocument();
      expect(screen.getByText("Total Gardeners")).toBeInTheDocument();
    });

    it("lists recent gardens", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Recent Gardens")).toBeInTheDocument();
      expect(screen.getByText("Community Garden")).toBeInTheDocument();
      expect(screen.getByText("Urban Farm")).toBeInTheDocument();
    });
  });

  describe("operator role", () => {
    it("renders welcome message for operator", () => {
      mockUseRole.mockReturnValue({
        role: "operator",
        operatorGardens: [mockGardens[0]],
      });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent(/Welcome back.*Operator/);
      expect(screen.getByText(/Manage your 1 garden$/)).toBeInTheDocument();
    });

    it("shows 'Your Gardens' stat instead of 'Total Gardens'", () => {
      mockUseRole.mockReturnValue({
        role: "operator",
        operatorGardens: [mockGardens[0]],
      });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Your Gardens")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("lists operator gardens in recent section", () => {
      mockUseRole.mockReturnValue({
        role: "operator",
        operatorGardens: [mockGardens[0]],
      });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Community Garden")).toBeInTheDocument();
      expect(screen.getByText("Operator Garden")).toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows no gardens message when data is empty", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: [], isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("No gardens found")).toBeInTheDocument();
    });
  });
});
