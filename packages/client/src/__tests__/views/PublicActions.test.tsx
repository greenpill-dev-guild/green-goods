/**
 * Public Actions Gallery View Tests
 *
 * @vitest-environment happy-dom
 */

import es from "@green-goods/shared/i18n/es.json";
import pt from "@green-goods/shared/i18n/pt.json";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---

// The first template stores a reviewed translation for both languages; the second stores none.
const treePlanting = {
  es: {
    title: "Siembra de árboles",
    description: "Siembra árboles nativos para restaurar ecosistemas",
  },
  pt: {
    title: "Plantio de mudas",
    description: "Plante mudas nativas para restaurar ecossistemas",
  },
};

const mockActions = [
  {
    id: "action-1",
    slug: "tree-planting",
    title: "Tree Planting",
    description: "Plant native trees to restore ecosystems",
    domain: 1, // AGRO
    capitals: [3], // LIVING
    media: ["https://example.com/tree.jpg"],
    inputs: [],
    startTime: 1700000000,
    endTime: 1800000000,
    createdAt: 1700000000,
    translations: {
      es: { status: "reviewed", data: treePlanting.es },
      pt: { status: "reviewed", data: treePlanting.pt },
    },
  },
  {
    id: "action-2",
    slug: "solar-install",
    title: "Solar Panel Installation",
    description: "Install solar panels for clean energy",
    domain: 0, // SOLAR
    capitals: [1, 2], // MATERIAL, FINANCIAL
    media: [],
    inputs: [],
    startTime: 1700000000,
    endTime: 1800000000,
    createdAt: 1700000000,
  },
];

const mockUseActions = vi.fn();

vi.mock("@green-goods/shared/hooks/blockchain/useBaseLists", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    useActions: (...args: unknown[]) => mockUseActions(...args),
  };
});

import ActionsGallery from "../../views/Public/Actions";

const messages: Record<string, string> = {
  "app.domain.tab.agro": "Agro",
  "app.domain.tab.education": "Education",
  "app.domain.tab.solar": "Solar",
  "app.domain.tab.waste": "Waste",
  "public.actions.heroTitle":
    "<line>A field guide for</line> <line><accent>regenerative</accent></line> <line><accent>work</accent></line>",
  "public.actions.heroLede":
    "Actions are the templates Gardens use to document Work across solar, agroforestry, education, and waste.",
  "public.actions.gridTitle": "Templates Gardens use to plan and document Work.",
  "public.actions.kicker": "Field guide",
  "public.actions.domain.unknown": "Unknown",
  "public.actions.empty": "Action templates will appear here as they are published.",
};

const catalogues = { en: messages, es, pt };

function view(locale: keyof typeof catalogues = "en") {
  return createElement(
    MemoryRouter,
    null,
    createElement(
      IntlProvider,
      { locale, messages: catalogues[locale] },
      createElement(ActionsGallery)
    )
  );
}

function renderView(locale?: keyof typeof catalogues) {
  return render(view(locale));
}

describe("ActionsGallery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseActions.mockReturnValue({ data: mockActions, isLoading: false });
  });

  it("reads the hero title as one sentence across its authored lines", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /^A field guide for regenerative work$/
    );
  });

  it("renders the editorial hero lede", () => {
    renderView();
    expect(
      screen.getByText(
        /actions are the templates gardens use to document work across solar, agroforestry/i
      )
    ).toBeInTheDocument();
  });

  it("renders action cards with titles", () => {
    renderView();
    expect(screen.getByText("Tree Planting")).toBeInTheDocument();
    expect(screen.getByText("Solar Panel Installation")).toBeInTheDocument();
  });

  it("renders action descriptions", () => {
    renderView();
    expect(screen.getByText("Plant native trees to restore ecosystems")).toBeInTheDocument();
    expect(screen.getByText("Install solar panels for clean energy")).toBeInTheDocument();
  });

  it("renders action media when available", () => {
    renderView();
    expect(screen.getByRole("img", { name: "Tree Planting" })).toBeInTheDocument();
  });

  it.each(["{Enter}", " "])("opens an action with the keyboard (%s)", async (key) => {
    const user = userEvent.setup();
    renderView();
    const card = screen.getByRole("button", { name: /Tree Planting/ });
    expect(card).toHaveClass("cursor-pointer");
    // Tab through the domain filters to the first action, without pointer input.
    for (let step = 0; step < 20 && document.activeElement !== card; step++) await user.tab();
    expect(card).toHaveFocus();
    await user.keyboard(key);
    expect(screen.getByRole("dialog", { name: "Tree Planting" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reserves square-cornered dialog media before load and after load or failure", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Tree Planting/ }));
    const dialog = screen.getByRole("dialog", { name: "Tree Planting" });
    const image = within(dialog).getByRole("img", { name: "Tree Planting" });
    // happy-dom does not lay out images; rendered geometry is verified in the browser.
    expect(image).toHaveClass("aspect-[4/3]", "w-full", "object-cover");
    expect(image).not.toHaveClass("rounded-2xl");
    for (const event of ["load", "error"]) {
      fireEvent(image, new Event(event));
      expect(image).toHaveClass("aspect-[4/3]", "w-full");
      expect(within(dialog).getByText(mockActions[0].description)).toBeInTheDocument();
    }
  });

  it("opens actions without media without an empty image slot", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Solar Panel Installation/ }));
    const dialog = screen.getByRole("dialog", { name: "Solar Panel Installation" });
    expect(within(dialog).queryByRole("link", { name: "Install App" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Install the Green Goods app/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
    expect(within(dialog).getByText(mockActions[1].description)).toBeInTheDocument();
  });

  it("uses a full-width mobile sheet and caps its width only on desktop", () => {
    renderView();
    fireEvent.click(screen.getByRole("button", { name: /Tree Planting/ }));
    const panel = screen.getByRole("heading", { name: "Tree Planting", level: 2 }).parentElement
      ?.parentElement?.parentElement;
    expect(panel).toHaveClass("w-full", "max-w-none", "sm:max-w-2xl");
  });

  it.each(["es", "pt"] as const)("shows a stored %s translation on card and dialog", (locale) => {
    const { title, description } = treePlanting[locale];
    renderView(locale);
    const card = screen.getByRole("button", { name: new RegExp(title) });
    expect(within(card).getByRole("img", { name: title })).toBeInTheDocument();
    expect(within(card).getByText(description)).toBeInTheDocument();
    expect(screen.queryByText("Tree Planting")).not.toBeInTheDocument();

    fireEvent.click(card);
    const dialog = screen.getByRole("dialog", { name: title });
    expect(within(dialog).getByRole("img", { name: title })).toBeInTheDocument();
    expect(within(dialog).getByText(description)).toBeInTheDocument();
  });

  it("keeps a template with no stored translation in English", () => {
    renderView("pt");
    const card = screen.getByRole("button", { name: /Solar Panel Installation/ });
    expect(within(card).getByText(mockActions[1].description)).toBeInTheDocument();
    fireEvent.click(card);
    expect(screen.getByRole("dialog", { name: "Solar Panel Installation" })).toBeInTheDocument();
  });

  it("follows a language switch on a card and in an open dialog", () => {
    const { rerender } = renderView();
    fireEvent.click(screen.getByRole("button", { name: /Tree Planting/ }));
    expect(screen.getByRole("dialog", { name: "Tree Planting" })).toBeInTheDocument();

    rerender(view("pt"));
    const { title } = treePlanting.pt;
    expect(screen.getByRole("button", { name: new RegExp(title) })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: title })).toBeInTheDocument();
    expect(screen.queryByText("Tree Planting")).not.toBeInTheDocument();
  });

  it("shows loading skeletons", () => {
    mockUseActions.mockReturnValue({ data: [], isLoading: true });
    const { container } = renderView();
    expect(container.querySelectorAll("[data-editorial-skeleton]").length).toBeGreaterThanOrEqual(
      3
    );
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("is read-only with no create/edit buttons", () => {
    renderView();
    expect(screen.queryByRole("button", { name: /create/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("shows an empty state when no actions are available", () => {
    mockUseActions.mockReturnValue({ data: [], isLoading: false });
    renderView();
    expect(
      screen.getByText("Action templates will appear here as they are published.")
    ).toBeInTheDocument();
  });
});
