/**
 * WorkDetails Component Tests
 *
 * Tests the details step of the work submission flow: dynamic form inputs,
 * location toggle with geolocation API, multi-select state, and time spent input.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { IntlProvider } from "react-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@green-goods/shared", async () => {
  const actual = await vi.importActual<typeof import("@green-goods/shared")>("@green-goods/shared");
  return { ...actual };
});

// Mock form input components to expose label and key props
vi.mock("@/components/Cards", () => ({
  FormInfo: ({ title }: { title: string }) =>
    createElement("div", { "data-testid": "form-info" }, title),
}));

vi.mock("@/components/Inputs", () => ({
  FormInput: ({ label, type, name, ...rest }: any) =>
    createElement("div", { "data-testid": `form-input-${name || label}` }, [
      createElement("label", { key: "label" }, label),
      createElement("input", {
        key: "input",
        type: type || "text",
        name,
        "data-testid": `input-${name || label}`,
        ...rest,
      }),
    ]),
  FormSelect: ({ label, name, options }: any) =>
    createElement("div", { "data-testid": `form-select-${name}` }, [
      createElement("label", { key: "label" }, label),
      createElement(
        "select",
        { key: "select", name, "data-testid": `select-${name}` },
        (options || []).map((opt: any) =>
          createElement("option", { key: opt.value, value: opt.value }, opt.label)
        )
      ),
    ]),
  FormText: ({ label, name, ...rest }: any) =>
    createElement("div", { "data-testid": `form-text-${name || label}` }, [
      createElement("label", { key: "label" }, label),
      createElement("textarea", {
        key: "textarea",
        name,
        "data-testid": `textarea-${name || label}`,
        ...rest,
      }),
    ]),
}));

// Import after mocks
import type { WorkInput } from "@green-goods/shared";
import { WorkDetails } from "../../views/Garden/Details";

const messages: Record<string, string> = {
  "app.garden.details.title": "Enter Details",
  "app.garden.submit.tab.details.instruction": "Provide detailed information and feedback",
  "app.garden.details.feedbackPlaceholder": "Provide feedback or any observations",
  "app.garden.details.timeSpent": "Time Spent (hours)",
  "app.garden.details.timeSpentPlaceholder": "e.g., 1.5 for 1h 30m",
  "app.garden.details.timeSpentHint": "Enter hours spent on this work (decimals OK)",
  "app.garden.details.shareLocation": "Share location",
  "app.garden.details.locationHint": "Coarse GPS for verification",
  "app.garden.details.locationCaptured": "Location captured",
  "app.garden.details.locationDenied": "Location access denied",
  "app.garden.details.feedback": "Feedback",
  "app.garden.details.selectRange": "Select a range",
};

const mockRegister = vi.fn((name: string) => ({ name, ref: vi.fn() }));
const mockControl = {} as any;

function renderDetails(props: Partial<React.ComponentProps<typeof WorkDetails>> = {}) {
  const defaultProps: React.ComponentProps<typeof WorkDetails> = {
    inputs: [],
    register: mockRegister as any,
    control: mockControl,
    ...props,
  };

  return render(
    createElement(
      IntlProvider,
      { locale: "en", messages },
      createElement(WorkDetails, defaultProps)
    )
  );
}

describe("WorkDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders time spent input and feedback textarea by default", () => {
    renderDetails();

    // Time Spent is always present
    expect(screen.getByText("Time Spent (hours)")).toBeInTheDocument();
    // Feedback textarea is always present
    expect(screen.getByText("Feedback")).toBeInTheDocument();
  });

  it("renders dynamic number inputs from action config", () => {
    const inputs: WorkInput[] = [
      {
        key: "seedCount",
        title: "Seed Count",
        placeholder: "Enter count",
        type: "number",
        required: true,
        options: [],
        unit: "seeds",
      },
    ];

    renderDetails({ inputs });

    expect(screen.getByText("Seed Count (seeds)")).toBeInTheDocument();
  });

  it("renders dynamic select inputs from action config", () => {
    const inputs: WorkInput[] = [
      {
        key: "soilType",
        title: "Soil Type",
        placeholder: "Select soil",
        type: "select",
        required: false,
        options: ["Clay", "Sandy", "Loam"],
      },
    ];

    renderDetails({ inputs });

    expect(screen.getByText("Soil Type")).toBeInTheDocument();
    const select = screen.getByTestId("select-soilType");
    expect(select).toBeInTheDocument();
  });

  it("renders multi-select chip buttons from action config", () => {
    const inputs: WorkInput[] = [
      {
        key: "plants",
        title: "Plants Used",
        placeholder: "",
        type: "multi-select",
        required: false,
        options: ["Tomato", "Basil", "Mint"],
      },
    ];

    renderDetails({ inputs });

    expect(screen.getByText("Plants Used")).toBeInTheDocument();
    expect(screen.getByText("Tomato")).toBeInTheDocument();
    expect(screen.getByText("Basil")).toBeInTheDocument();
    expect(screen.getByText("Mint")).toBeInTheDocument();
  });

  it("toggles multi-select options on click and syncs to form", () => {
    const setValue = vi.fn();
    const inputs: WorkInput[] = [
      {
        key: "plants",
        title: "Plants Used",
        placeholder: "",
        type: "multi-select",
        required: false,
        options: ["Tomato", "Basil"],
      },
    ];

    renderDetails({ inputs, setValue });

    // Click "Tomato" to select it
    fireEvent.click(screen.getByText("Tomato"));
    expect(setValue).toHaveBeenCalledWith("plants", ["Tomato"]);

    // Click "Basil" to add it
    fireEvent.click(screen.getByText("Basil"));
    expect(setValue).toHaveBeenCalledWith("plants", ["Tomato", "Basil"]);
  });

  it("renders location toggle switch in idle state", () => {
    renderDetails();

    expect(screen.getByText("Share location")).toBeInTheDocument();
    const toggle = screen.getByRole("switch");
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("sets location status to denied when geolocation is unavailable", () => {
    // Remove geolocation API
    const original = navigator.geolocation;
    Object.defineProperty(navigator, "geolocation", {
      value: undefined,
      writable: true,
      configurable: true,
    });

    renderDetails();

    fireEvent.click(screen.getByRole("switch"));

    // Should show "Location access denied"
    expect(screen.getByText("Location access denied")).toBeInTheDocument();

    // Restore
    Object.defineProperty(navigator, "geolocation", {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});
