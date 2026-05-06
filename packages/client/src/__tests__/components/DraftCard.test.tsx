import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
  formatRelativeTime: () => "2 hours ago",
}));

vi.mock("@remixicon/react", () => ({
  RiDeleteBinLine: (props: any) =>
    createElement("span", { ...props, "data-testid": "icon-delete" }),
  RiDraftLine: (props: any) => createElement("span", { ...props, "data-testid": "icon-draft" }),
  RiImageLine: (props: any) => createElement("span", { ...props, "data-testid": "icon-image" }),
}));

vi.mock("@/components/Display", () => ({
  ImageWithFallback: ({ src, alt }: { src: string; alt: string }) =>
    createElement("img", { src, alt, "data-testid": "thumb" }),
}));

vi.mock("@/styles/pwaStatusStyles", () => ({
  pwaStatusStyles: {
    warning: { surface: "bg-warning", border: "border-warning" },
  },
}));

import { DraftCard } from "../../components/Cards/Work/DraftCard";

const baseDraft = {
  id: "draft-1",
  actionUID: 1,
  gardenAddress: "0xgarden",
  images: [
    { id: "img1", file: new File([], "1.jpg") },
    { id: "img2", file: new File([], "2.jpg") },
  ],
  thumbnailUrl: "https://example.com/thumb.jpg",
  firstIncompleteStep: "media",
  updatedAt: Date.now(),
} as any;

const messages = {
  "app.draft.untitled": "Untitled Draft",
  "app.draft.status": "Draft",
  "app.draft.stepProgress": "Step {step}/4",
  "app.draft.delete": "Delete draft",
};

const wrap = (el: React.ReactElement) =>
  createElement(IntlProvider, { locale: "en", messages, defaultLocale: "en" }, el);

describe("DraftCard", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders action title, garden name, and time ago", () => {
    render(
      wrap(
        createElement(DraftCard, {
          draft: baseDraft,
          actionTitle: "Plant Trees",
          gardenName: "Aiyeloja Family Garden",
          onResume: vi.fn(),
          onDelete: vi.fn(),
        })
      )
    );

    expect(screen.getByText("Plant Trees")).toBeInTheDocument();
    // Garden name + time-ago share a parent with a separator span; match
    // both as substrings of the combined text.
    expect(screen.getByText(/Aiyeloja Family Garden/)).toBeInTheDocument();
    expect(screen.getByText(/2 hours ago/)).toBeInTheDocument();
  });

  it("falls back to 'Untitled Draft' when no action title is provided", () => {
    render(
      wrap(
        createElement(DraftCard, {
          draft: baseDraft,
          onResume: vi.fn(),
          onDelete: vi.fn(),
        })
      )
    );

    expect(screen.getByText("Untitled Draft")).toBeInTheDocument();
  });

  it("renders the thumbnail when thumbnailUrl is provided", () => {
    render(
      wrap(
        createElement(DraftCard, {
          draft: baseDraft,
          onResume: vi.fn(),
          onDelete: vi.fn(),
        })
      )
    );

    expect(screen.getByTestId("thumb")).toBeInTheDocument();
  });

  it("falls back to draft icon when no thumbnail", () => {
    render(
      wrap(
        createElement(DraftCard, {
          draft: { ...baseDraft, thumbnailUrl: null },
          onResume: vi.fn(),
          onDelete: vi.fn(),
        })
      )
    );

    expect(screen.queryByTestId("thumb")).not.toBeInTheDocument();
    expect(screen.getByTestId("icon-draft")).toBeInTheDocument();
  });

  it("shows image count badge when there are images", () => {
    render(
      wrap(
        createElement(DraftCard, {
          draft: baseDraft,
          onResume: vi.fn(),
          onDelete: vi.fn(),
        })
      )
    );

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByTestId("icon-image")).toBeInTheDocument();
  });

  it("hides image count badge when there are no images", () => {
    render(
      wrap(
        createElement(DraftCard, {
          draft: { ...baseDraft, images: [] },
          onResume: vi.fn(),
          onDelete: vi.fn(),
        })
      )
    );

    expect(screen.queryByTestId("icon-image")).not.toBeInTheDocument();
  });

  it("renders step progress badge based on firstIncompleteStep", () => {
    render(
      wrap(
        createElement(DraftCard, {
          draft: { ...baseDraft, firstIncompleteStep: "review" },
          onResume: vi.fn(),
          onDelete: vi.fn(),
        })
      )
    );

    expect(screen.getByText("Step 4/4")).toBeInTheDocument();
  });

  it("calls onResume when the resume button is clicked", async () => {
    const onResume = vi.fn();
    const user = userEvent.setup();
    render(
      wrap(
        createElement(DraftCard, {
          draft: baseDraft,
          actionTitle: "Plant Trees",
          onResume,
          onDelete: vi.fn(),
        })
      )
    );

    // The full card body acts as the resume button
    await user.click(screen.getByText("Plant Trees"));
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when the delete icon is clicked, and stops resume propagation", async () => {
    const onResume = vi.fn();
    const onDelete = vi.fn();
    const user = userEvent.setup();
    render(
      wrap(
        createElement(DraftCard, {
          draft: baseDraft,
          onResume,
          onDelete,
        })
      )
    );

    await user.click(screen.getByLabelText("Delete draft"));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
  });

  it("delete button uses a 44x44 tap target (h-11 w-11)", () => {
    render(
      wrap(
        createElement(DraftCard, {
          draft: baseDraft,
          onResume: vi.fn(),
          onDelete: vi.fn(),
        })
      )
    );

    const deleteBtn = screen.getByLabelText("Delete draft");
    // Class assertion proxies for the actual tap target dimension.
    expect(deleteBtn.className).toContain("h-11");
    expect(deleteBtn.className).toContain("w-11");
  });
});
