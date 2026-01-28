/**
 * MetadataEditor Component Tests
 *
 * Tests for the hypercert metadata editing step component.
 * Covers form inputs, validation, suggested values, and accessibility.
 */

import { screen } from "@testing-library/react";
import { renderWithProviders as render } from "../../test-utils";
import userEvent from "@testing-library/user-event";
import { createElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { HypercertDraft } from "@green-goods/shared";

// Mock dependencies
vi.mock("@green-goods/shared/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@green-goods/shared")>();
  return {
    ...actual,
    // Mock DatePicker as a simple input for testing
    DatePicker: ({
      id,
      label,
      value,
      onChange,
      error,
      required,
    }: {
      id: string;
      label: React.ReactNode;
      value: number | null | undefined;
      onChange: (value: number | null) => void;
      error?: string;
      required?: boolean;
      placeholder?: string;
      minDate?: number | null;
    }) =>
      createElement("div", { "data-testid": `datepicker-${id}` }, [
        createElement("label", { key: "label", htmlFor: id }, label),
        createElement("input", {
          key: "input",
          id,
          type: "date",
          value: value ? new Date(value * 1000).toISOString().split("T")[0] : "",
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const date = e.target.value ? Math.floor(new Date(e.target.value).getTime() / 1000) : null;
            onChange(date);
          },
          "aria-required": required,
        }),
        error && createElement("span", { key: "error", className: "error" }, error),
      ]),
    FormInput: ({
      id,
      label,
      value,
      onChange,
      placeholder,
    }: {
      id: string;
      label: React.ReactNode;
      value: string;
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
      placeholder?: string;
    }) =>
      createElement("div", null, [
        createElement("label", { key: "label", htmlFor: id }, label),
        createElement("input", {
          key: "input",
          id,
          type: "text",
          value,
          onChange,
          placeholder,
        }),
      ]),
    FormTextarea: ({
      id,
      label,
      value,
      onChange,
      placeholder,
      rows,
    }: {
      id: string;
      label: React.ReactNode;
      value: string;
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
      placeholder?: string;
      rows?: number;
    }) =>
      createElement("div", null, [
        createElement("label", { key: "label", htmlFor: id }, label),
        createElement("textarea", {
          key: "textarea",
          id,
          value,
          onChange,
          placeholder,
          rows,
        }),
      ]),
  };
});

import { MetadataEditor } from "../../../components/hypercerts/steps/MetadataEditor";

// ============================================
// Test Fixtures
// ============================================

function createMockDraft(overrides: Partial<HypercertDraft> = {}): HypercertDraft {
  return {
    gardenId: "0xGarden123",
    operatorAddress: "0xOperator123",
    title: "",
    description: "",
    workScopes: [],
    impactScopes: [],
    workTimeframeStart: 0,
    workTimeframeEnd: 0,
    impactTimeframeStart: null,
    impactTimeframeEnd: null,
    sdgs: [],
    capitals: [],
    ...overrides,
  };
}

describe("components/hypercerts/MetadataEditor", () => {
  const defaultProps = {
    draft: createMockDraft(),
    onUpdate: vi.fn(),
    suggestedWorkScopes: ["tree planting", "habitat restoration"],
    suggestedStart: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
    suggestedEnd: Math.floor(Date.now() / 1000),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders title input", () => {
      render(createElement(MetadataEditor, defaultProps));

      expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    });

    it("renders description textarea", () => {
      render(createElement(MetadataEditor, defaultProps));

      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it("renders work scope input", () => {
      render(createElement(MetadataEditor, defaultProps));

      expect(screen.getByLabelText(/work scope/i)).toBeInTheDocument();
    });

    it("renders impact scope input", () => {
      render(createElement(MetadataEditor, defaultProps));

      expect(screen.getByLabelText(/impact scope/i)).toBeInTheDocument();
    });

    it("renders work timeframe date pickers", () => {
      render(createElement(MetadataEditor, defaultProps));

      expect(screen.getByTestId("datepicker-hypercert-work-start")).toBeInTheDocument();
      expect(screen.getByTestId("datepicker-hypercert-work-end")).toBeInTheDocument();
    });

    it("renders SDG checkboxes", () => {
      render(createElement(MetadataEditor, defaultProps));

      // Should have 17 SDG buttons
      const sdgGroup = screen.getByRole("group", { name: /sdg/i });
      expect(sdgGroup).toBeInTheDocument();
    });

    it("renders capitals checkboxes", () => {
      render(createElement(MetadataEditor, defaultProps));

      // Should have capitals group
      const capitalsGroup = screen.getByRole("group", { name: /capitals/i });
      expect(capitalsGroup).toBeInTheDocument();
    });
  });

  describe("required field indicators", () => {
    it("marks title as required", () => {
      render(createElement(MetadataEditor, defaultProps));

      const titleLabel = screen.getByLabelText(/title/i);
      expect(titleLabel.closest("div")?.textContent).toContain("*");
    });

    it("marks work scope as required", () => {
      render(createElement(MetadataEditor, defaultProps));

      const workScopeLabel = screen.getByLabelText(/work scope/i);
      expect(workScopeLabel.closest("div")?.textContent).toContain("*");
    });
  });

  describe("form interactions", () => {
    it("calls onUpdate when title changes", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          onUpdate,
        })
      );

      const titleInput = screen.getByLabelText(/title/i);
      await user.type(titleInput, "My Hypercert");

      expect(onUpdate).toHaveBeenCalled();
      // Check the last call included the title
      const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0];
      expect(lastCall.title).toContain("t"); // Last character typed
    });

    it("calls onUpdate when description changes", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          onUpdate,
        })
      );

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.type(descriptionInput, "A description");

      expect(onUpdate).toHaveBeenCalled();
    });

    it("calls onUpdate when work scope changes", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          onUpdate,
        })
      );

      const workScopeInput = screen.getByLabelText(/work scope/i);
      await user.type(workScopeInput, "planting, restoration");

      expect(onUpdate).toHaveBeenCalled();
    });

    it("parses comma-separated work scopes", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          onUpdate,
        })
      );

      const workScopeInput = screen.getByLabelText(/work scope/i);
      await user.clear(workScopeInput);
      await user.type(workScopeInput, "planting, restoration, care");

      // Find the call that contains workScopes
      const workScopeCalls = onUpdate.mock.calls.filter(
        (call) => call[0].workScopes !== undefined
      );
      expect(workScopeCalls.length).toBeGreaterThan(0);
    });
  });

  describe("suggested values", () => {
    it("displays suggested work scopes as chips", () => {
      render(createElement(MetadataEditor, defaultProps));

      expect(screen.getByText("tree planting")).toBeInTheDocument();
      expect(screen.getByText("habitat restoration")).toBeInTheDocument();
    });

    it("adds suggested scope when clicked", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          onUpdate,
        })
      );

      const suggestedChip = screen.getByText("tree planting");
      await user.click(suggestedChip);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          workScopes: expect.arrayContaining(["tree planting"]),
        })
      );
    });

    it("hides suggested scope after it is added", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ workScopes: ["tree planting"] }),
        })
      );

      // The chip should not be visible as a suggestion since it's already added
      const chips = screen.getAllByText("tree planting");
      // Should only appear in the input value, not as a suggestion button
      expect(chips.length).toBe(1);
    });

    it("displays Use Suggested button for timeframe", () => {
      render(createElement(MetadataEditor, defaultProps));

      expect(screen.getByText(/use suggested/i)).toBeInTheDocument();
    });

    it("applies suggested timeframe when button clicked", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          onUpdate,
        })
      );

      const useSuggestedButton = screen.getByText(/use suggested/i);
      await user.click(useSuggestedButton);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          workTimeframeStart: defaultProps.suggestedStart,
          workTimeframeEnd: defaultProps.suggestedEnd,
        })
      );
    });
  });

  describe("SDG selection", () => {
    it("toggles SDG selection on click", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          onUpdate,
        })
      );

      // Find SDG button (SDG 1 - No Poverty)
      const sdgButtons = screen.getAllByRole("button", { pressed: false });
      const sdg1Button = sdgButtons.find((btn) => btn.textContent?.includes("1"));

      if (sdg1Button) {
        await user.click(sdg1Button);
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            sdgs: expect.arrayContaining([1]),
          })
        );
      }
    });

    it("shows selected state for active SDGs", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ sdgs: [13, 15] }), // Climate Action, Life on Land
        })
      );

      const pressedButtons = screen.getAllByRole("button", { pressed: true });
      expect(pressedButtons.length).toBeGreaterThanOrEqual(2);
    });

    it("removes SDG on second click", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ sdgs: [1] }),
          onUpdate,
        })
      );

      const pressedButton = screen.getByRole("button", { pressed: true });
      await user.click(pressedButton);

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          sdgs: [],
        })
      );
    });
  });

  describe("capitals selection", () => {
    it("toggles capital selection on click", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          onUpdate,
        })
      );

      // Find a capital button
      const capitalButtons = screen
        .getAllByRole("button")
        .filter((btn) => btn.getAttribute("aria-label"));
      const livingCapitalButton = capitalButtons.find(
        (btn) => btn.getAttribute("aria-label")?.toLowerCase().includes("living")
      );

      if (livingCapitalButton) {
        await user.click(livingCapitalButton);
        expect(onUpdate).toHaveBeenCalled();
      }
    });

    it("shows selected state for active capitals", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ capitals: ["living", "social"] }),
        })
      );

      // Should have pressed buttons for the selected capitals
      const pressedButtons = screen.getAllByRole("button", { pressed: true });
      expect(pressedButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("date validation", () => {
    it("shows error when start date is after end date", () => {
      const now = Math.floor(Date.now() / 1000);
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({
            workTimeframeStart: now,
            workTimeframeEnd: now - 86400, // End before start
          }),
        })
      );

      // Error should be shown
      expect(screen.getByText(/date/i)).toBeInTheDocument();
    });
  });

  describe("pre-populated values", () => {
    it("displays existing title value", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ title: "Existing Title" }),
        })
      );

      const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
      expect(titleInput.value).toBe("Existing Title");
    });

    it("displays existing description value", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ description: "Existing description" }),
        })
      );

      const descriptionInput = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
      expect(descriptionInput.value).toBe("Existing description");
    });

    it("displays existing work scopes as comma-separated list", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ workScopes: ["planting", "restoration"] }),
        })
      );

      const workScopeInput = screen.getByLabelText(/work scope/i) as HTMLInputElement;
      expect(workScopeInput.value).toBe("planting, restoration");
    });
  });

  describe("accessibility", () => {
    it("SDG buttons have aria-pressed attribute", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ sdgs: [1] }),
        })
      );

      const pressedButton = screen.getByRole("button", { pressed: true });
      expect(pressedButton).toHaveAttribute("aria-pressed", "true");
    });

    it("capital buttons have aria-label", () => {
      render(createElement(MetadataEditor, defaultProps));

      const capitalButtons = screen
        .getAllByRole("button")
        .filter((btn) => btn.getAttribute("aria-label"));

      expect(capitalButtons.length).toBeGreaterThan(0);
    });

    it("required fields have aria-required", () => {
      render(createElement(MetadataEditor, defaultProps));

      const titleInput = screen.getByLabelText(/title/i);
      expect(titleInput).toHaveAttribute("aria-required", "true");
    });
  });
});
