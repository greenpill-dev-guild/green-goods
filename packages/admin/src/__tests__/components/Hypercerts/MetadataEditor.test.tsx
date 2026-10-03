/**
 * MetadataEditor Component Tests
 *
 * Tests for the hypercert metadata editing step component.
 * Covers form inputs, validation, suggested values, and accessibility.
 */

import enMessages from "@green-goods/shared/i18n/en.json";
import { useHypercertWizardStore } from "@green-goods/shared/stores/useHypercertWizardStore";
import type { HypercertDraft } from "@green-goods/shared/types/hypercerts";
import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createElement, useState } from "react";
import { IntlProvider } from "react-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders as render } from "../../test-utils";

// Mock dependencies
vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@green-goods/shared/components/DatePicker/DatePicker", () => {
  // The stand-in keeps the contract of the real picker: it shows the local
  // calendar day of the value it is given, and hands back local midnight of the
  // day picked.
  const localDay = (seconds: number | null | undefined) => {
    if (!seconds) return "";
    const date = new Date(seconds * 1000);
    const pad = (part: number) => String(part).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  return {
    DatePicker: ({
      id,
      label,
      value,
      onChange,
      error,
      required,
      minDate,
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
          value: localDay(value),
          min: localDay(minDate) || undefined,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
            const [year, month, day] = e.target.value.split("-").map(Number);
            onChange(
              e.target.value ? Math.floor(new Date(year, month - 1, day).getTime() / 1000) : null
            );
          },
          "aria-required": required,
        }),
        error && createElement("span", { key: "error", className: "error" }, error),
      ]),
  };
});

vi.mock("@green-goods/shared/components/Form/FormInput", () => ({
  FormInput: ({
    id,
    label,
    value,
    onChange,
    onFocus,
    onBlur,
    placeholder,
    "aria-required": ariaRequired,
  }: {
    id: string;
    label: React.ReactNode;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onFocus?: React.FocusEventHandler<HTMLInputElement>;
    onBlur?: React.FocusEventHandler<HTMLInputElement>;
    placeholder?: string;
    "aria-required"?: string;
  }) =>
    createElement("div", null, [
      createElement("label", { key: "label", htmlFor: id }, label),
      createElement("input", {
        key: "input",
        id,
        type: "text",
        value,
        onChange,
        onFocus,
        onBlur,
        placeholder,
        "aria-required": ariaRequired,
      }),
    ]),
}));

vi.mock("@green-goods/shared/components/Form/FormTextarea", () => ({
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
}));

vi.mock("@green-goods/shared/utils/styles/cn", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

import { MetadataEditor } from "../../../components/Hypercerts/Steps/MetadataEditor";

// ============================================
// Test Fixtures
// ============================================

function createMockDraft(overrides: Partial<HypercertDraft> = {}): HypercertDraft {
  return {
    id: "draft-1",
    gardenId: "0xGarden123",
    stewardAddress: "0xSteward123",
    stepNumber: 2,
    attestationIds: [],
    title: "",
    description: "",
    workScopes: [],
    impactScopes: [],
    workTimeframeStart: 0,
    workTimeframeEnd: 0,
    impactTimeframeStart: 0,
    impactTimeframeEnd: null,
    sdgs: [],
    capitals: [],
    outcomes: { predefined: {}, custom: {} },
    allowlist: [],
    externalUrl: "",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function MetadataEditorHarness({
  initialDraft = createMockDraft(),
  onUpdate,
}: {
  initialDraft?: HypercertDraft;
  onUpdate: (updates: Partial<HypercertDraft>) => void;
}) {
  const [draft, setDraft] = useState(initialDraft);

  return createElement(MetadataEditor, {
    draft,
    onUpdate: (updates) => {
      onUpdate(updates);
      setDraft((current) => ({ ...current, ...updates }));
    },
    suggestedWorkScopes: [],
    suggestedStart: null,
    suggestedEnd: null,
  });
}

/** The step as the wizard runs it: its periods read from, and written to, the wizard's own store. */
function StoreBackedEditor({
  suggestedStart,
  suggestedEnd,
}: {
  suggestedStart: number;
  suggestedEnd: number;
}) {
  const workTimeframeStart = useHypercertWizardStore((state) => state.workTimeframeStart);
  const workTimeframeEnd = useHypercertWizardStore((state) => state.workTimeframeEnd);
  const updateMetadata = useHypercertWizardStore((state) => state.updateMetadata);

  return createElement(MetadataEditor, {
    draft: createMockDraft({ workTimeframeStart, workTimeframeEnd }),
    onUpdate: updateMetadata,
    suggestedWorkScopes: [],
    suggestedStart,
    suggestedEnd,
  });
}

describe("components/Hypercerts/MetadataEditor", () => {
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
      const workScopeCalls = onUpdate.mock.calls.filter((call) => call[0].workScopes !== undefined);
      expect(workScopeCalls.length).toBeGreaterThan(0);
    });

    it("preserves commas while editing work scopes", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(createElement(MetadataEditorHarness, { onUpdate }));

      const workScopeInput = screen.getByLabelText(/work scope/i);
      await user.type(workScopeInput, "planting,");

      expect(workScopeInput).toHaveValue("planting,");

      await user.type(workScopeInput, " restoration");

      expect(workScopeInput).toHaveValue("planting, restoration");
      expect(onUpdate).toHaveBeenLastCalledWith({
        workScopes: ["planting", "restoration"],
      });
    });

    it("allows an existing impact scope to be replaced", async () => {
      const onUpdate = vi.fn();
      const user = userEvent.setup();

      render(
        createElement(MetadataEditorHarness, {
          initialDraft: createMockDraft({ impactScopes: ["environment"] }),
          onUpdate,
        })
      );

      const impactScopeInput = screen.getByLabelText(/impact scope/i);
      await user.clear(impactScopeInput);
      await user.type(impactScopeInput, "community, cleaner air");

      expect(impactScopeInput).toHaveValue("community, cleaner air");
      expect(onUpdate).toHaveBeenLastCalledWith({
        impactScopes: ["community", "cleaner air"],
      });
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

      // The scope should be in the input value, not as a suggestion button
      const scopeInput = screen.getByLabelText(/work scope/i) as HTMLInputElement;
      expect(scopeInput.value).toContain("tree planting");

      // The suggestion button for "tree planting" should not exist (since it's already added)
      // Suggestions appear as clickable text/buttons - look for all buttons containing the scope name
      const allButtons = screen.getAllByRole("button");
      const treePlantingButtons = allButtons.filter((btn) =>
        btn.textContent?.toLowerCase().includes("tree planting")
      );
      // No suggestion buttons should contain "tree planting" (it's already in the input)
      expect(treePlantingButtons.length).toBe(0);
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
      const livingCapitalButton = capitalButtons.find((btn) =>
        btn.getAttribute("aria-label")?.toLowerCase().includes("living")
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

      // Error should be shown - look for the specific date range error message
      expect(screen.getByText(/start date must be before/i)).toBeInTheDocument();
    });
  });

  // A time frame end is a calendar day, kept as UTC midnight: an assessment
  // prefills it that way, and the minted metadata names its UTC day. The step
  // has to show and store that same day whatever zone the steward is in.
  describe("time frames as UTC days", () => {
    const march1 = Date.UTC(2026, 2, 1) / 1000;
    const august26 = Date.UTC(2026, 7, 26) / 1000;
    const dayIn = (id: string) => (document.getElementById(id) as HTMLInputElement).value;

    it("names the stored days to a steward west of UTC", () => {
      render(
        createElement(
          IntlProvider,
          { locale: "en", timeZone: "America/Sao_Paulo", messages: enMessages },
          createElement(MetadataEditor, {
            ...defaultProps,
            draft: createMockDraft({ workTimeframeStart: march1, workTimeframeEnd: august26 }),
            suggestedStart: march1,
            suggestedEnd: august26,
          })
        )
      );

      // Once as the suggestion and once as the current selection.
      expect(screen.getAllByText("Mar 1, 2026 → Aug 26, 2026")).toHaveLength(2);
    });

    // An assessment can prefill an end no calendar holds: the attestation keeps
    // each end as a uint256. The formatter fails on one, so the step shows no day.
    it("shows no day for a time frame end beyond any calendar", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({ workTimeframeStart: march1, workTimeframeEnd: 1.158e77 }),
        })
      );

      expect(screen.getByText("Mar 1, 2026 → —")).toBeInTheDocument();
      expect(dayIn("hypercert-work-end")).toBe("");
    });

    it("shows each stored day in its picker and holds the end to the start day", () => {
      render(
        createElement(MetadataEditor, {
          ...defaultProps,
          draft: createMockDraft({
            workTimeframeStart: march1,
            workTimeframeEnd: august26,
            impactTimeframeStart: march1,
            impactTimeframeEnd: august26,
          }),
        })
      );

      expect(dayIn("hypercert-work-start")).toBe("2026-03-01");
      expect(dayIn("hypercert-work-end")).toBe("2026-08-26");
      expect(dayIn("hypercert-impact-start")).toBe("2026-03-01");
      expect(dayIn("hypercert-impact-end")).toBe("2026-08-26");
      expect(document.getElementById("hypercert-work-end")).toHaveAttribute("min", "2026-03-01");
      expect(document.getElementById("hypercert-impact-end")).toHaveAttribute("min", "2026-03-01");
    });

    // "Use suggested dates" hands over the moments the work was created and
    // approved. Kept as moments, 22:15 on 25 March is later than the midnight
    // stored for an end picked on 25 March, and the step called that end too early.
    it("accepts an end on the suggested start's own day", async () => {
      const user = userEvent.setup();
      useHypercertWizardStore.getState().reset();

      render(
        createElement(StoreBackedEditor, {
          suggestedStart: Date.UTC(2026, 2, 25, 22, 15, 8) / 1000,
          suggestedEnd: Date.UTC(2026, 7, 26, 9, 37, 49) / 1000,
        })
      );
      await user.click(screen.getByText(/use suggested/i));
      fireEvent.change(document.getElementById("hypercert-work-end") as HTMLInputElement, {
        target: { value: "2026-03-25" },
      });

      expect(dayIn("hypercert-work-start")).toBe("2026-03-25");
      expect(dayIn("hypercert-work-end")).toBe("2026-03-25");
      expect(screen.queryByText(/start date must be before/i)).not.toBeInTheDocument();
    });

    it.each([
      ["hypercert-work-start", "workTimeframeStart"],
      ["hypercert-work-end", "workTimeframeEnd"],
      ["hypercert-impact-start", "impactTimeframeStart"],
      ["hypercert-impact-end", "impactTimeframeEnd"],
    ])("stores UTC midnight of the day picked in %s", (id, field) => {
      const onUpdate = vi.fn();
      render(createElement(MetadataEditor, { ...defaultProps, onUpdate }));

      fireEvent.change(document.getElementById(id) as HTMLInputElement, {
        target: { value: "2026-09-30" },
      });

      expect(onUpdate).toHaveBeenLastCalledWith({ [field]: Date.UTC(2026, 8, 30) / 1000 });
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
