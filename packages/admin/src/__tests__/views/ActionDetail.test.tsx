import { render, screen } from "@testing-library/react";
import React from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ActionDetail from "@/views/Actions/ActionDetail";
import enMessages from "../../../../shared/src/i18n/en.json";

const mockUseActions = vi.fn();

vi.mock("@green-goods/shared", () => ({
  DEFAULT_CHAIN_ID: 42161,
  formatDateTime: () => "Jan 1",
  useActions: () => mockUseActions(),
  ImageWithFallback: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt, "data-testid": "image-with-fallback" }),
}));

vi.mock("@remixicon/react", () => {
  const Icon = (props: unknown) => React.createElement("span", props as object);
  return new Proxy({}, { get: () => Icon });
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useParams: () => ({ id: "42161-1" }),
    Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) =>
      React.createElement("a", { href: to, ...props }, children),
  };
});

vi.mock("@/components/Layout/PageHeader", () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description: string;
    actions?: React.ReactNode;
  }) =>
    React.createElement(
      "div",
      {},
      React.createElement("h1", {}, title),
      React.createElement("p", {}, description),
      React.createElement("div", {}, actions)
    ),
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(React.createElement(IntlProvider, { locale: "en", messages: enMessages }, ui));
}

describe("ActionDetail View", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders media placeholder when action has no media", () => {
    mockUseActions.mockReturnValue({
      data: [
        {
          id: "42161-1",
          title: "Site Setup",
          description: "Action description",
          slug: "solar.site_setup",
          startTime: 1700000000000,
          endTime: 1800000000000,
          capitals: [],
          media: [],
          inputs: [],
          domain: 0,
          createdAt: 1700000000000,
          details: {
            title: "Details",
            description: "",
            feedbackPlaceholder: "",
            inputs: [],
          },
          review: { title: "Review", description: "" },
          mediaInfo: {
            title: "Capture Media",
            description: "",
            maxImageCount: 5,
            minImageCount: 1,
            required: true,
            needed: [],
            optional: [],
          },
        },
      ],
      isLoading: false,
    });

    renderWithIntl(React.createElement(ActionDetail));

    expect(screen.getByText("Image unavailable")).toBeInTheDocument();
    expect(
      screen.getByText("This action does not currently have a valid image.")
    ).toBeInTheDocument();
  });
});
