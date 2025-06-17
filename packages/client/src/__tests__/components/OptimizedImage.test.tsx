import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { OptimizedImage } from "@/components/UI/Image/OptimizedImage";

// Mock the useOptimizedImage hook
vi.mock("@/hooks/useOptimizedImage", () => ({
  useOptimizedImage: vi.fn(),
}));

import { useOptimizedImage } from "@/hooks/useOptimizedImage";

const mockUseOptimizedImage = useOptimizedImage as any;

describe("OptimizedImage", () => {
  const defaultProps = {
    src: "test-image.jpg",
    alt: "Test image",
  };

  const mockImgRef = { current: null };
  const mockRetry = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOptimizedImage.mockReturnValue({
      src: "",
      isLoading: true,
      hasError: false,
      imgRef: mockImgRef,
      retry: mockRetry,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render with loading state", () => {
    render(<OptimizedImage {...defaultProps} />);

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveClass("opacity-0");

    // Should show loading placeholder
    const loadingElement = screen.getByRole("img").parentElement?.querySelector("div");
    expect(loadingElement).toHaveClass("animate-pulse");
  });

  it("should render with loaded state", () => {
    mockUseOptimizedImage.mockReturnValue({
      src: "optimized-image.jpg",
      isLoading: false,
      hasError: false,
      imgRef: mockImgRef,
      retry: mockRetry,
    });

    render(<OptimizedImage {...defaultProps} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "optimized-image.jpg");
    expect(img).toHaveClass("opacity-100");
    expect(img).not.toHaveClass("opacity-0");
  });

  it("should render error state with retry button", () => {
    mockUseOptimizedImage.mockReturnValue({
      src: "",
      isLoading: false,
      hasError: true,
      imgRef: mockImgRef,
      retry: mockRetry,
    });

    render(<OptimizedImage {...defaultProps} />);

    expect(screen.getByText("Failed to load image")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("should call retry when retry button is clicked", () => {
    mockUseOptimizedImage.mockReturnValue({
      src: "",
      isLoading: false,
      hasError: true,
      imgRef: mockImgRef,
      retry: mockRetry,
    });

    render(<OptimizedImage {...defaultProps} />);

    const retryButton = screen.getByText("Retry");
    fireEvent.click(retryButton);

    expect(mockRetry).toHaveBeenCalled();
  });

  it("should render fallback component when provided and error occurs", () => {
    mockUseOptimizedImage.mockReturnValue({
      src: "",
      isLoading: false,
      hasError: true,
      imgRef: mockImgRef,
      retry: mockRetry,
    });

    const fallback = <div data-testid="fallback">Custom fallback</div>;

    render(<OptimizedImage {...defaultProps} fallbackComponent={fallback} />);

    expect(screen.getByTestId("fallback")).toBeInTheDocument();
    expect(screen.queryByText("Failed to load image")).not.toBeInTheDocument();
  });

  it("should call onLoadingStateChange when loading state changes", () => {
    const onLoadingStateChange = vi.fn();

    mockUseOptimizedImage.mockReturnValue({
      src: "",
      isLoading: true,
      hasError: false,
      imgRef: mockImgRef,
      retry: mockRetry,
    });

    render(<OptimizedImage {...defaultProps} onLoadingStateChange={onLoadingStateChange} />);

    expect(onLoadingStateChange).toHaveBeenCalledWith(true);
  });

  it("should pass correct options to useOptimizedImage hook", () => {
    const customProps = {
      ...defaultProps,
      lazy: false,
      webpFallback: false,
      quality: 90,
      sizes: "400px",
    };

    render(<OptimizedImage {...customProps} />);

    expect(mockUseOptimizedImage).toHaveBeenCalledWith({
      src: "test-image.jpg",
      placeholder: undefined,
      lazy: false,
      webpFallback: false,
      quality: 90,
      sizes: "400px",
    });
  });

  it("should apply custom CSS classes", () => {
    const customProps = {
      ...defaultProps,
      className: "custom-image",
      containerClassName: "custom-container",
      loadingClassName: "custom-loading",
      errorClassName: "custom-error",
    };

    render(<OptimizedImage {...customProps} />);

    const container = screen.getByRole("img").parentElement;
    expect(container).toHaveClass("custom-container");

    const img = screen.getByRole("img");
    expect(img).toHaveClass("custom-image");
  });

  it("should set loading attribute correctly", () => {
    // Test lazy loading
    render(<OptimizedImage {...defaultProps} lazy={true} />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "lazy");

    // Test eager loading
    render(<OptimizedImage {...defaultProps} lazy={false} />);
    expect(screen.getByRole("img")).toHaveAttribute("loading", "eager");
  });

  it("should set decoding attribute", () => {
    render(<OptimizedImage {...defaultProps} />);
    expect(screen.getByRole("img")).toHaveAttribute("decoding", "async");
  });

  it("should handle placeholder prop", () => {
    const placeholder = "data:image/svg+xml;base64,placeholder";

    render(<OptimizedImage {...defaultProps} placeholder={placeholder} />);

    expect(mockUseOptimizedImage).toHaveBeenCalledWith(
      expect.objectContaining({
        placeholder,
      })
    );
  });

  it("should pass through additional img props", () => {
    const additionalProps = {
      "data-testid": "optimized-image",
      title: "Test title",
      crossOrigin: "anonymous" as const,
    };

    render(<OptimizedImage {...defaultProps} {...additionalProps} />);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("data-testid", "optimized-image");
    expect(img).toHaveAttribute("title", "Test title");
    expect(img).toHaveAttribute("crossOrigin", "anonymous");
  });

  it("should handle error state with custom error className", () => {
    mockUseOptimizedImage.mockReturnValue({
      src: "",
      isLoading: false,
      hasError: true,
      imgRef: mockImgRef,
      retry: mockRetry,
    });

    render(<OptimizedImage {...defaultProps} errorClassName="custom-error-class" />);

    const img = screen.getByRole("img");
    expect(img).toHaveClass("custom-error-class");
  });

  it("should handle loading state with custom loading className", () => {
    mockUseOptimizedImage.mockReturnValue({
      src: "",
      isLoading: true,
      hasError: false,
      imgRef: mockImgRef,
      retry: mockRetry,
    });

    render(<OptimizedImage {...defaultProps} loadingClassName="custom-loading-class" />);

    const loadingElement = screen.getByRole("img").parentElement?.querySelector("div");
    expect(loadingElement).toHaveClass("custom-loading-class");
  });
});
