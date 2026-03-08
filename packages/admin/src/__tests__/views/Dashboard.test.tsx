/**
 * Dashboard View Tests
 *
 * Tests the admin dashboard rendering for different roles (deployer, operator, user).
 * Verifies stats, garden list, loading, error states, platform stats integration,
 * and enriched activity feed with works/assessments.
 *
 * @vitest-environment jsdom
 */

import { render, screen, within } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseGardens = vi.fn();
const mockUseRole = vi.fn();
const mockUseActions = vi.fn();
const mockUsePlatformStats = vi.fn();

vi.mock("@green-goods/shared", () => ({
  useGardens: () => mockUseGardens(),
  useRole: () => mockUseRole(),
  useActions: () => mockUseActions(),
  usePlatformStats: () => mockUsePlatformStats(),
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
  resolveIPFSUrl: (url: string) => url,
  ImageWithFallback: ({ src, alt, className }: any) =>
    React.createElement("img", { src, alt, className }),
  cn: (...args: any[]) => args.filter(Boolean).join(" "),
  formatRelativeTime: (ts: number) => "just now",
  Domain: { SOLAR: 0, AGRO: 1, EDU: 2, WASTE: 3 },
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890abcdef1234567890abcdef12345678" }),
}));

vi.mock("@remixicon/react", () => {
  const Icon = (props: any) => React.createElement("span", props);
  return new Proxy({}, { get: () => Icon });
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: to, ...props }, children),
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
    bannerImage: "",
    gardeners: ["0xG1", "0xG2"],
    operators: ["0xO1"],
    createdAt: Math.floor(Date.now() / 1000) - 86400,
    chainId: 11155111,
    tokenAddress: "0x0000000000000000000000000000000000000001",
    tokenID: 1n,
    description: "Test garden",
    evaluators: ["0xE1"],
    owners: [],
    funders: [],
    communities: [],
    assessments: [],
    works: [],
  },
  {
    id: "garden-2",
    name: "Urban Farm",
    location: "Brooklyn",
    bannerImage: "",
    gardeners: ["0xG3"],
    operators: ["0xO1", "0xO2"],
    createdAt: Math.floor(Date.now() / 1000) - 172800,
    chainId: 11155111,
    tokenAddress: "0x0000000000000000000000000000000000000002",
    tokenID: 2n,
    description: "Urban garden",
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    assessments: [],
    works: [],
  },
];

const mockActions = [
  { id: "action-1", slug: "plant-trees", title: "Plant Trees", domain: 0, createdAt: 1000 },
  { id: "action-2", slug: "harvest", title: "Harvest Crops", domain: 1, createdAt: 2000 },
  { id: "action-3", slug: "compost", title: "Compost", domain: 2, createdAt: 3000 },
];

const mockPlatformStatsData = {
  totalWorks: 5,
  pendingWorks: 3,
  approvedWorks: 2,
  totalAssessments: 2,
  works: [
    {
      id: "work-1",
      gardenerAddress: "0xG1",
      gardenAddress: "garden-1",
      actionUID: 1,
      title: "Planted 10 trees",
      feedback: "",
      metadata: "",
      media: [],
      createdAt: Math.floor(Date.now() / 1000) - 3600,
    },
  ],
  assessments: [
    {
      id: "assessment-1",
      authorAddress: "0xO1",
      gardenAddress: "garden-1",
      title: "Q1 Assessment",
      description: "",
      assessmentConfigCID: "",
      domain: 0,
      startDate: null,
      endDate: null,
      location: "",
      createdAt: Math.floor(Date.now() / 1000) - 7200,
    },
  ],
};

describe("Dashboard View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActions.mockReturnValue({ data: mockActions });
    mockUsePlatformStats.mockReturnValue({ data: mockPlatformStatsData });
  });

  describe("loading state", () => {
    it("shows loading skeleton while data is fetching", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: [], isLoading: true, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
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

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent(/Welcome back.*Deployer/);
    });

    it("shows total gardens stat", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Total Gardens")).toBeInTheDocument();
      const statValues = screen.getAllByText("2");
      expect(statValues.length).toBeGreaterThan(0);
    });

    it("shows total members and active actions stats", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Total Members")).toBeInTheDocument();
      expect(screen.getByText("Active Actions")).toBeInTheDocument();
    });

    it("shows platform stats (work submissions, pending reviews, assessments)", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Work Submissions")).toBeInTheDocument();
      expect(screen.getByText("Pending Reviews")).toBeInTheDocument();
      expect(screen.getByText("Assessments")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument(); // totalWorks
    });

    it("shows em-dash when platform stats are loading", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });
      mockUsePlatformStats.mockReturnValue({ data: undefined });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Work Submissions")).toBeInTheDocument();
      // Should show "—" placeholders
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBe(3); // work submissions, pending reviews, assessments
    });

    it("shows active actions stat", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Active Actions")).toBeInTheDocument();
      const actionsStatLabel = screen.getByText("Active Actions");
      const statCard = actionsStatLabel.closest("div[class*='rounded-xl']");
      expect(statCard).toBeInTheDocument();
      expect(within(statCard!).getByText("3")).toBeInTheDocument();
    });

    it("renders garden summary list with garden names", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Recent Gardens")).toBeInTheDocument();
      expect(screen.getByText("Community Garden")).toBeInTheDocument();
      expect(screen.getByText("Urban Farm")).toBeInTheDocument();
    });

    it("renders recent activity section with real events", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
      // Should include work and assessment activity items
      expect(screen.getByText(/Planted 10 trees/)).toBeInTheDocument();
      expect(screen.getByText(/Assessment created/)).toBeInTheDocument();
    });

    it("renders view all link pointing to gardens page", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      const viewAllLink = screen.getByText("View All");
      expect(viewAllLink.closest("a")).toHaveAttribute("href", "/gardens");
    });

    it("shows garden locations in summary list", () => {
      mockUseRole.mockReturnValue({ role: "deployer", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText(/Central Park/)).toBeInTheDocument();
      expect(screen.getByText(/Brooklyn/)).toBeInTheDocument();
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

    it("shows only operator gardens in summary list", () => {
      mockUseRole.mockReturnValue({
        role: "operator",
        operatorGardens: [mockGardens[0]],
      });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.getByText("Community Garden")).toBeInTheDocument();
      expect(screen.queryByText("Urban Farm")).not.toBeInTheDocument();
    });
  });

  describe("user role", () => {
    it("hides operator/gardener stats for user role", () => {
      mockUseRole.mockReturnValue({ role: "user", operatorGardens: [] });
      mockUseGardens.mockReturnValue({ data: mockGardens, isLoading: false, error: null });

      renderWithIntl(<Dashboard />);

      expect(screen.queryByText("Total Members")).not.toBeInTheDocument();
      expect(screen.queryByText("Active Actions")).not.toBeInTheDocument();
      expect(screen.queryByText("Work Submissions")).not.toBeInTheDocument();
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
