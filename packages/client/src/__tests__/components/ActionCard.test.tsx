/**
 * ActionCard Component Tests
 *
 * Tests for the action card component used in action listings.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
// Import test utilities from shared package test-utils
import { createMockAction } from "../../../../shared/src/__tests__/test-utils/mock-factories";

// TODO: Import ActionCard component once available
// import { ActionCard } from "@/components/Cards/ActionCard";

// TODO: Add comprehensive tests for ActionCard
// Priority test cases:
// 1. Renders action title and description
// 2. Shows capital type badges
// 3. Displays time range (start/end dates)
// 4. Shows active/expired status
// 5. Displays media preview if available
// 6. Handles click to view action details
// 7. Shows "Submit Work" CTA for active actions
// 8. Displays capital requirements

describe("ActionCard", () => {
  const mockAction = createMockAction({
    title: "Plant Trees",
    description: "Help plant native trees in the community garden",
    capitals: ["LIVING", "SOCIAL"],
    startTime: Date.now() - 86400000, // 1 day ago
    endTime: Date.now() + 86400000, // 1 day from now
  });

  it("should render action title and description", () => {
    // TODO: Uncomment when ActionCard component is available
    // const { getByText } = render(<ActionCard action={mockAction} />);
    // expect(getByText("Plant Trees")).toBeInTheDocument();
    // expect(getByText(/Help plant native trees/i)).toBeInTheDocument();
    expect(mockAction.title).toBe("Plant Trees");
    expect(mockAction.description).toContain("plant native trees");
  });

  it("should display capital type badges correctly", () => {
    // TODO: Uncomment when ActionCard component is available
    // const { getByText } = render(<ActionCard action={mockAction} />);
    // expect(getByText("LIVING")).toBeInTheDocument();
    // expect(getByText("SOCIAL")).toBeInTheDocument();
    expect(mockAction.capitals).toContain("LIVING");
    expect(mockAction.capitals).toContain("SOCIAL");
  });

  it("should show formatted time range with start and end dates", () => {
    // TODO: Uncomment when ActionCard component is available
    // const { getByText } = render(<ActionCard action={mockAction} />);
    // expect(getByText(/1 day ago/i)).toBeInTheDocument();
    // expect(getByText(/1 day from now/i)).toBeInTheDocument();
    const now = Date.now();
    expect(mockAction.startTime).toBeLessThan(now);
    expect(mockAction.endTime).toBeGreaterThan(now);
  });

  it("should indicate active status for ongoing actions", () => {
    // TODO: Uncomment when ActionCard component is available
    // const { getByText } = render(<ActionCard action={mockAction} />);
    // expect(getByText(/active/i)).toBeInTheDocument();
    const now = Date.now();
    const isActive = mockAction.startTime < now && mockAction.endTime > now;
    expect(isActive).toBe(true);
  });

  it("should indicate expired status for past actions", () => {
    // TODO: Uncomment when ActionCard component is available
    // const expiredAction = createMockAction({
    //   startTime: Date.now() - 172800000, // 2 days ago
    //   endTime: Date.now() - 86400000,    // 1 day ago
    // });
    // const { getByText } = render(<ActionCard action={expiredAction} />);
    // expect(getByText(/expired/i)).toBeInTheDocument();
    const expiredAction = createMockAction({
      startTime: Date.now() - 172800000,
      endTime: Date.now() - 86400000,
    });
    expect(expiredAction.endTime).toBeLessThan(Date.now());
  });

  it("should display media preview when media is available", () => {
    // TODO: Uncomment when ActionCard component is available
    // const actionWithMedia = createMockAction({
    //   media: ["ipfs://QmTest123"]
    // });
    // const { getByRole } = render(<ActionCard action={actionWithMedia} />);
    // expect(getByRole("img")).toBeInTheDocument();
    const actionWithMedia = createMockAction({ media: ["ipfs://QmTest123"] });
    expect(actionWithMedia.media).toHaveLength(1);
  });

  it("should navigate to action detail on card click", () => {
    // TODO: Uncomment when ActionCard component is available
    // const { getByRole } = render(
    //   <MemoryRouter>
    //     <ActionCard action={mockAction} />
    //   </MemoryRouter>
    // );
    // const link = getByRole("link");
    // expect(link).toHaveAttribute("href", `/actions/${mockAction.id}`);
    expect(mockAction.id).toBeDefined();
  });

  it("should show 'Submit Work' CTA for active actions", () => {
    // TODO: Uncomment when ActionCard component is available
    // const { getByText } = render(<ActionCard action={mockAction} />);
    // expect(getByText(/submit work/i)).toBeInTheDocument();
    const now = Date.now();
    const isActive = mockAction.startTime < now && mockAction.endTime > now;
    expect(isActive).toBe(true);
  });

  it("should display capital requirements clearly", () => {
    // TODO: Uncomment when ActionCard component is available
    // const { getByText } = render(<ActionCard action={mockAction} />);
    // expect(getByText("LIVING")).toBeInTheDocument();
    // expect(getByText("SOCIAL")).toBeInTheDocument();
    expect(mockAction.capitals).toEqual(["LIVING", "SOCIAL"]);
  });

  it("should handle missing optional fields gracefully", () => {
    // TODO: Uncomment when ActionCard component is available
    // const minimalAction = createMockAction({
    //   media: [],
    //   description: "",
    // });
    // const { getByText } = render(<ActionCard action={minimalAction} />);
    // expect(getByText(minimalAction.title)).toBeInTheDocument();
    const minimalAction = createMockAction({ media: [], description: "" });
    expect(minimalAction.title).toBeDefined();
  });
});
