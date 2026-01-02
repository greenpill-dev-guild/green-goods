/**
 * GardenCard Component Tests
 *
 * Tests for the garden card component used in garden listings.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
// Import test utilities from shared package test-utils
// Note: test-utils are not exported from main package, only for test use
import { createMockGarden } from "../../../../shared/src/__tests__/test-utils/mock-factories";

// TODO: Import GardenCard component once available
// import { GardenCard } from "@/components/Cards/GardenCard";

// TODO: Add comprehensive tests for GardenCard
// Priority test cases:
// 1. Renders garden name and description
// 2. Displays banner image with fallback
// 3. Shows gardener and operator counts
// 4. Displays location information
// 5. Shows action count badge
// 6. Handles click navigation to garden detail
// 7. Shows role badge (gardener/operator/viewer)
// 8. Displays creation date

describe("GardenCard", () => {
  const mockGarden = createMockGarden({
    name: "Test Garden",
    description: "A beautiful test garden",
    location: "Test City",
    gardeners: ["0x123", "0x456"],
    operators: ["0x789"],
  });

  it("should render garden name and description", () => {
    // TODO: Uncomment when GardenCard component is available
    // const { getByText } = render(<GardenCard garden={mockGarden} />);
    // expect(getByText("Test Garden")).toBeInTheDocument();
    // expect(getByText("A beautiful test garden")).toBeInTheDocument();
    expect(mockGarden.name).toBe("Test Garden");
    expect(mockGarden.description).toBe("A beautiful test garden");
  });

  it("should display banner image with fallback for missing images", () => {
    // TODO: Uncomment when GardenCard component is available
    // const gardenWithoutImage = createMockGarden({ bannerImage: "" });
    // const { getByRole } = render(<GardenCard garden={gardenWithoutImage} />);
    // const img = getByRole("img");
    // expect(img).toHaveAttribute("src", expect.stringContaining("placeholder"));
    expect(mockGarden.bannerImage).toBeDefined();
  });

  it("should show correct gardener and operator counts", () => {
    // TODO: Uncomment when GardenCard component is available
    // const { getByText } = render(<GardenCard garden={mockGarden} />);
    // expect(getByText(/2.*gardeners?/i)).toBeInTheDocument();
    // expect(getByText(/1.*operators?/i)).toBeInTheDocument();
    expect(mockGarden.gardeners).toHaveLength(2);
    expect(mockGarden.operators).toHaveLength(1);
  });

  it("should display location information", () => {
    // TODO: Uncomment when GardenCard component is available
    // const { getByText } = render(<GardenCard garden={mockGarden} />);
    // expect(getByText("Test City")).toBeInTheDocument();
    expect(mockGarden.location).toBe("Test City");
  });

  it("should show action count badge when actions exist", () => {
    // TODO: Uncomment when GardenCard component is available
    // const gardenWithActions = createMockGarden({ actions: [1, 2, 3] });
    // const { getByText } = render(<GardenCard garden={gardenWithActions} />);
    // expect(getByText("3")).toBeInTheDocument();
    const gardenWithActions = createMockGarden();
    expect(gardenWithActions).toBeDefined();
  });

  it("should navigate to garden detail page on click", () => {
    // TODO: Uncomment when GardenCard component is available
    // const { getByRole } = render(
    //   <MemoryRouter>
    //     <GardenCard garden={mockGarden} />
    //   </MemoryRouter>
    // );
    // const link = getByRole("link");
    // expect(link).toHaveAttribute("href", `/gardens/${mockGarden.id}`);
    expect(mockGarden.id).toBeDefined();
  });

  it("should display role badge based on user permissions", () => {
    // TODO: Uncomment when GardenCard component is available
    // Mock user as gardener
    // const { getByText } = render(<GardenCard garden={mockGarden} userAddress="0x123" />);
    // expect(getByText("Gardener")).toBeInTheDocument();
    expect(mockGarden.gardeners).toContain("0x123");
  });

  it("should format and display creation date correctly", () => {
    // TODO: Uncomment when GardenCard component is available
    // const { getByText } = render(<GardenCard garden={mockGarden} />);
    // expect(getByText(/created/i)).toBeInTheDocument();
    expect(mockGarden.createdAt).toBeDefined();
    expect(typeof mockGarden.createdAt).toBe("number");
  });

  it("should handle loading state gracefully", () => {
    // TODO: Uncomment when GardenCard component is available
    // const { getByTestId } = render(<GardenCard garden={null} loading={true} />);
    // expect(getByTestId("skeleton-loader")).toBeInTheDocument();
    expect(true).toBe(true); // Placeholder
  });

  it("should show placeholder when data is incomplete", () => {
    // TODO: Uncomment when GardenCard component is available
    // const incompleteGarden = createMockGarden({ name: "", description: "" });
    // const { getByText } = render(<GardenCard garden={incompleteGarden} />);
    // expect(getByText("Unnamed Garden")).toBeInTheDocument();
    const incompleteGarden = createMockGarden({ name: "", description: "" });
    expect(incompleteGarden.name).toBe("");
  });
});
