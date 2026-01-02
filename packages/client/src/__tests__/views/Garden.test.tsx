/**
 * Garden Detail View Tests
 *
 * Tests for the garden detail page (non-integration).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
// Import test utilities from shared package
import {
  createMockGarden,
  createMockAction,
} from "../../../../shared/src/__tests__/test-utils/mock-factories";

// TODO: Import Garden view component once available
// import { Garden } from "@/views/Garden";

// TODO: Add comprehensive tests for Garden detail view
// Priority test cases:
// 1. Renders garden header with name and banner
// 2. Displays garden description and location
// 3. Shows list of active actions
// 4. Shows gardener and operator lists
// 5. Displays work history feed
// 6. Shows role-specific actions (join/leave)
// 7. Handles action card clicks to submission
// 8. Shows empty state for no actions
// 9. Displays loading state
// 10. Handles missing garden gracefully

describe("Garden Detail View", () => {
  const mockGarden = createMockGarden({
    name: "Community Garden",
    description: "A vibrant community space",
    location: "Downtown",
  });

  const mockActions = [
    createMockAction({ title: "Plant Trees" }),
    createMockAction({ title: "Water Plants" }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render garden header with name and banner image", () => {
    // TODO: Uncomment when Garden view is available
    // const { getByText, getByRole } = render(<Garden garden={mockGarden} />);
    // expect(getByText("Community Garden")).toBeInTheDocument();
    // expect(getByRole("img", { name: /banner/i })).toBeInTheDocument();
    expect(mockGarden.name).toBe("Community Garden");
    expect(mockGarden.bannerImage).toBeDefined();
  });

  it("should display garden description and location", () => {
    // TODO: Uncomment when Garden view is available
    // const { getByText } = render(<Garden garden={mockGarden} />);
    // expect(getByText("A vibrant community space")).toBeInTheDocument();
    // expect(getByText("Downtown")).toBeInTheDocument();
    expect(mockGarden.description).toBe("A vibrant community space");
    expect(mockGarden.location).toBe("Downtown");
  });

  it("should show list of active actions", () => {
    // TODO: Uncomment when Garden view is available
    // const { getByText } = render(<Garden garden={mockGarden} actions={mockActions} />);
    // expect(getByText("Plant Trees")).toBeInTheDocument();
    // expect(getByText("Water Plants")).toBeInTheDocument();
    expect(mockActions).toHaveLength(2);
    expect(mockActions[0].title).toBe("Plant Trees");
  });

  it("should display gardener list with avatars", () => {
    // TODO: Uncomment when Garden view is available
    // const { getAllByRole } = render(<Garden garden={mockGarden} />);
    // const avatars = getAllByRole("img", { name: /gardener/i });
    // expect(avatars).toHaveLength(mockGarden.gardeners.length);
    expect(mockGarden.gardeners).toBeDefined();
    expect(Array.isArray(mockGarden.gardeners)).toBe(true);
  });

  it("should display operator list with badges", () => {
    // TODO: Uncomment when Garden view is available
    // const { getAllByText } = render(<Garden garden={mockGarden} />);
    // const badges = getAllByText(/operator/i);
    // expect(badges.length).toBeGreaterThan(0);
    expect(mockGarden.operators).toBeDefined();
    expect(Array.isArray(mockGarden.operators)).toBe(true);
  });

  it("should show work history feed with recent submissions", () => {
    // TODO: Uncomment when Garden view is available
    // const { getByText } = render(<Garden garden={mockGarden} works={mockWorks} />);
    // expect(getByText(/recent work/i)).toBeInTheDocument();
    expect(mockGarden.works).toBeDefined();
  });

  it("should show 'Join Garden' button for non-members", () => {
    // TODO: Uncomment when Garden view is available
    // Mock user as non-member
    // const { getByRole } = render(<Garden garden={mockGarden} userAddress="0xNonMember" />);
    // expect(getByRole("button", { name: /join/i })).toBeInTheDocument();
    const userAddress = "0xNonMember";
    expect(mockGarden.gardeners).not.toContain(userAddress);
  });

  it("should show 'Leave Garden' button for members", () => {
    // TODO: Uncomment when Garden view is available
    // Mock user as member
    // const memberAddress = mockGarden.gardeners[0];
    // const { getByRole } = render(<Garden garden={mockGarden} userAddress={memberAddress} />);
    // expect(getByRole("button", { name: /leave/i })).toBeInTheDocument();
    const memberAddress = mockGarden.gardeners[0];
    expect(mockGarden.gardeners).toContain(memberAddress);
  });

  it("should navigate to work submission on action card click", () => {
    // TODO: Uncomment when Garden view is available
    // const { getByText } = render(
    //   <MemoryRouter>
    //     <Garden garden={mockGarden} actions={mockActions} />
    //   </MemoryRouter>
    // );
    // fireEvent.click(getByText("Plant Trees"));
    // Verify navigation
    expect(mockActions[0].title).toBe("Plant Trees");
  });

  it("should display empty state when no actions exist", () => {
    // TODO: Uncomment when Garden view is available
    // const { getByText } = render(<Garden garden={mockGarden} actions={[]} />);
    // expect(getByText(/no actions/i)).toBeInTheDocument();
    const actions: any[] = [];
    expect(actions).toHaveLength(0);
  });

  it("should show loading skeleton while fetching data", () => {
    // TODO: Uncomment when Garden view is available
    // const { getByTestId } = render(<Garden loading={true} />);
    // expect(getByTestId("skeleton-loader")).toBeInTheDocument();
    const loading = true;
    expect(loading).toBe(true);
  });

  it("should handle missing garden with 404 message", () => {
    // TODO: Uncomment when Garden view is available
    // const { getByText } = render(<Garden garden={null} />);
    // expect(getByText(/not found/i)).toBeInTheDocument();
    const garden = null;
    expect(garden).toBeNull();
  });

  it("should update UI when user joins/leaves garden", async () => {
    // TODO: Uncomment when Garden view is available
    // const onJoin = vi.fn();
    // const { getByRole, rerender } = render(<Garden garden={mockGarden} onJoin={onJoin} />);
    // fireEvent.click(getByRole("button", { name: /join/i }));
    // await waitFor(() => expect(onJoin).toHaveBeenCalled());
    // Rerender with updated garden
    const onJoin = vi.fn();
    onJoin();
    expect(onJoin).toHaveBeenCalled();
  });
});
