import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonList,
  SkeletonButton,
} from "@/components/UI/Skeleton/Skeleton";

describe("Skeleton", () => {
  it("should render with default props", () => {
    render(<Skeleton data-testid="skeleton" />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass("bg-gray-200", "rounded-none", "animate-pulse");
  });

  it("should apply variant classes correctly", () => {
    const { rerender } = render(<Skeleton data-testid="skeleton" variant="circular" />);
    expect(screen.getByTestId("skeleton")).toHaveClass("rounded-full");

    rerender(<Skeleton data-testid="skeleton" variant="rounded" />);
    expect(screen.getByTestId("skeleton")).toHaveClass("rounded-lg");

    rerender(<Skeleton data-testid="skeleton" variant="text" />);
    expect(screen.getByTestId("skeleton")).toHaveClass("rounded-sm");

    rerender(<Skeleton data-testid="skeleton" variant="rectangular" />);
    expect(screen.getByTestId("skeleton")).toHaveClass("rounded-none");
  });

  it("should apply custom dimensions", () => {
    render(<Skeleton data-testid="skeleton" width={200} height={100} />);

    const skeleton = screen.getByTestId("skeleton");
    expect(skeleton).toHaveStyle({
      width: "200px",
      height: "100px",
    });
  });

  it("should apply custom className", () => {
    render(<Skeleton data-testid="skeleton" className="custom-class" />);

    expect(screen.getByTestId("skeleton")).toHaveClass("custom-class");
  });
});

describe("SkeletonText", () => {
  it("should render single line by default", () => {
    render(<SkeletonText data-testid="skeleton-text" />);

    const container = screen.getByTestId("skeleton-text");
    const skeletons = container.querySelectorAll('div[class*="bg-gray-200"]');
    expect(skeletons).toHaveLength(1);
  });

  it("should render multiple lines", () => {
    render(<SkeletonText data-testid="skeleton-text" lines={3} />);

    const container = screen.getByTestId("skeleton-text");
    const skeletons = container.querySelectorAll('div[class*="bg-gray-200"]');
    expect(skeletons).toHaveLength(3);
  });
});

describe("SkeletonCard", () => {
  it("should render card structure", () => {
    render(<SkeletonCard data-testid="skeleton-card" />);

    const card = screen.getByTestId("skeleton-card");
    expect(card).toBeInTheDocument();

    // Should have avatar, title, subtitle, image, and text lines
    const skeletons = card.querySelectorAll('div[class*="bg-gray-200"]');
    expect(skeletons.length).toBeGreaterThan(5);
  });
});

describe("SkeletonList", () => {
  it("should render default number of items", () => {
    render(<SkeletonList data-testid="skeleton-list" />);

    const list = screen.getByTestId("skeleton-list");
    const listItems = list.children;
    expect(listItems).toHaveLength(5); // Default items count
  });

  it("should render custom number of items", () => {
    render(<SkeletonList data-testid="skeleton-list" items={3} />);

    const list = screen.getByTestId("skeleton-list");
    const listItems = list.children;
    expect(listItems).toHaveLength(3);
  });
});

describe("SkeletonButton", () => {
  it("should render with medium size by default", () => {
    render(<SkeletonButton data-testid="skeleton-button" />);

    const button = screen.getByTestId("skeleton-button");
    expect(button).toHaveStyle({
      height: "40px",
      width: "120px",
    });
  });

  it("should apply size variants correctly", () => {
    const { rerender } = render(<SkeletonButton data-testid="skeleton-button" size="small" />);
    expect(screen.getByTestId("skeleton-button")).toHaveStyle({
      height: "32px",
      width: "80px",
    });

    rerender(<SkeletonButton data-testid="skeleton-button" size="large" />);
    expect(screen.getByTestId("skeleton-button")).toHaveStyle({
      height: "48px",
      width: "160px",
    });
  });
});
