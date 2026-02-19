/**
 * WorkView Component Tests
 *
 * Tests the reusable work display component used in Review and approval views.
 * Verifies rendering of garden info, media gallery, detail cards, and action buttons.
 */

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react-intl", () => ({
  useIntl: () => ({
    formatMessage: ({ defaultMessage }: { defaultMessage?: string }) => defaultMessage ?? "",
  }),
}));

vi.mock("@/components/Actions", () => ({
  Button: ({
    label,
    onClick,
    disabled,
  }: {
    label: string;
    onClick?: () => void;
    disabled?: boolean;
  }) => createElement("button", { onClick, disabled, type: "button" }, label),
}));

vi.mock("@/components/Cards", () => ({
  FormCard: ({ label, value }: { label: string; value: string }) =>
    createElement("div", { "data-testid": `form-card-${label}` }, `${label}: ${value}`),
  FormInfo: ({ title, info }: { title: string; info: string }) =>
    createElement("div", { "data-testid": "form-info" }, `${title} - ${info}`),
  GardenCard: ({ garden }: { garden: { name: string } }) =>
    createElement("div", { "data-testid": "garden-card" }, garden.name),
  GardenCardSkeleton: () => createElement("div", { "data-testid": "garden-card-skeleton" }),
}));

vi.mock("@/components/Display", () => ({
  Carousel: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "carousel" }, children),
  CarouselContent: ({ children }: { children: React.ReactNode }) =>
    createElement("div", null, children),
  CarouselItem: ({ children }: { children: React.ReactNode }) =>
    createElement("div", { "data-testid": "carousel-item" }, children),
  ImageWithFallback: ({ alt }: { alt: string }) =>
    createElement("img", { alt, "data-testid": "media-image" }),
}));

import { WorkView } from "../../components/Features/Work/WorkView";

const mockGarden = {
  id: "garden-1",
  name: "Test Garden",
  location: "Test Location",
  bannerImage: "",
  gardeners: [],
  operators: [],
  createdAt: Date.now(),
};

describe("WorkView", () => {
  const defaultProps = {
    title: "Review Work",
    info: "Check if the information is correct",
    garden: mockGarden as any,
    actionTitle: "Planting Trees",
    media: [] as string[],
    details: [] as Array<{ label: string; value: string; icon?: any }>,
    primaryActions: [] as any[],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("header and info", () => {
    it("renders title and info via FormInfo", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.getByTestId("form-info")).toHaveTextContent(
        "Review Work - Check if the information is correct"
      );
    });

    it("renders garden card", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.getByTestId("garden-card")).toHaveTextContent("Test Garden");
    });

    it("renders action title in details", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.getByTestId("form-card-Action")).toHaveTextContent("Action: Planting Trees");
    });
  });

  describe("media gallery", () => {
    it("does not show media section when no media provided", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.queryByText("Media")).not.toBeInTheDocument();
    });

    it("shows media section when media URLs provided", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          media: ["blob:http://localhost/img1", "blob:http://localhost/img2"],
          showMedia: true,
        })
      );

      expect(screen.getByText("Media")).toBeInTheDocument();
      expect(screen.getAllByTestId("media-image")).toHaveLength(2);
    });

    it("hides media when showMedia is false", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          media: ["blob:http://localhost/img1"],
          showMedia: false,
        })
      );

      expect(screen.queryByText("Media")).not.toBeInTheDocument();
    });
  });

  describe("details", () => {
    it("renders detail cards for non-empty values", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          details: [
            { label: "Time Spent", value: "2h 30m" },
            { label: "Description", value: "Planted 50 trees" },
          ],
        })
      );

      expect(screen.getByTestId("form-card-Time Spent")).toHaveTextContent("Time Spent: 2h 30m");
      expect(screen.getByTestId("form-card-Description")).toHaveTextContent(
        "Description: Planted 50 trees"
      );
    });

    it("filters out empty detail values", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          details: [
            { label: "Time Spent", value: "2h" },
            { label: "Empty", value: "" },
            { label: "Whitespace", value: "   " },
          ],
        })
      );

      expect(screen.getByTestId("form-card-Time Spent")).toBeInTheDocument();
      expect(screen.queryByTestId("form-card-Empty")).not.toBeInTheDocument();
      expect(screen.queryByTestId("form-card-Whitespace")).not.toBeInTheDocument();
    });
  });

  describe("primary actions", () => {
    it("does not render actions section when no actions provided", () => {
      render(createElement(WorkView, defaultProps));

      expect(screen.queryByText("Actions")).not.toBeInTheDocument();
    });

    it("renders visible actions", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          primaryActions: [
            { id: "approve", label: "Approve", onClick: vi.fn(), visible: true },
            { id: "reject", label: "Reject", onClick: vi.fn(), visible: true },
          ],
        })
      );

      expect(screen.getByText("Actions")).toBeInTheDocument();
      expect(screen.getByText("Approve")).toBeInTheDocument();
      expect(screen.getByText("Reject")).toBeInTheDocument();
    });

    it("hides actions with visible=false", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          primaryActions: [
            { id: "approve", label: "Approve", onClick: vi.fn(), visible: true },
            { id: "hidden", label: "Hidden Action", onClick: vi.fn(), visible: false },
          ],
        })
      );

      expect(screen.getByText("Approve")).toBeInTheDocument();
      expect(screen.queryByText("Hidden Action")).not.toBeInTheDocument();
    });

    it("calls onClick when action button is clicked", async () => {
      const onApprove = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(WorkView, {
          ...defaultProps,
          primaryActions: [{ id: "approve", label: "Approve", onClick: onApprove, visible: true }],
        })
      );

      await user.click(screen.getByText("Approve"));
      expect(onApprove).toHaveBeenCalledTimes(1);
    });

    it("disables action buttons when disabled prop is true", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          primaryActions: [{ id: "approve", label: "Approve", onClick: vi.fn(), disabled: true }],
        })
      );

      expect(screen.getByText("Approve")).toBeDisabled();
    });
  });

  describe("footer", () => {
    it("renders custom footer content", () => {
      render(
        createElement(WorkView, {
          ...defaultProps,
          footer: createElement("div", { "data-testid": "custom-footer" }, "Footer"),
        })
      );

      expect(screen.getByTestId("custom-footer")).toBeInTheDocument();
    });

    it("renders footer spacer when reserveFooterSpace is true", () => {
      const { container } = render(
        createElement(WorkView, {
          ...defaultProps,
          reserveFooterSpace: true,
        })
      );

      const spacer = container.querySelector("[aria-hidden='true']");
      expect(spacer).toBeInTheDocument();
    });
  });
});
