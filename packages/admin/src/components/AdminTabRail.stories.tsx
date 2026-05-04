import { RiCheckboxCircleLine, RiLeafLine, RiListCheck2, RiTimeLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminTabRail } from "./AdminTabRail";

const meta: Meta<typeof AdminTabRail> = {
  title: "Admin/Primitives/AdminTabRail",
  component: AdminTabRail,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component: [
          "**AdminTabRail** — segmented-card tabs per `design_handoff_admin-revamp/screens/review.css` (`.rv-tabs` / `.rv-tab` / `.rv-tab-count`).",
          "",
          "Anatomy:",
          "- Grid container: `gap: 6px`, `padding: 6px`, `border-radius: 14px`, `var(--surface-quiet)` background",
          "- Tab button: `40px` × `10px` radius, font 600/14/-0.005em",
          "- Active tab: raised bg + `var(--e1)` shadow + a barely-perceptible 6% tone wash via `linear-gradient`",
          "- Count chip: 22×20 pill, `var(--surface-raised)` inactive → `var(--g-action)` active",
          "- No sliding underline — the rewrite drops the M3 indicator in favor of bg-fill",
          "",
          "**Accessibility**:",
          '- `role="tablist"` + `role="tab"` + `aria-selected` per WAI-ARIA Tabs pattern',
          "- Roving tabindex (active tab is the only one tabbable)",
          "- Keyboard nav: ArrowLeft/ArrowRight cycle, Home/End jump (skip disabled tabs)",
          "- Tone color is supplemental — `aria-selected` is the primary state announcement",
          "- Focus ring uses `var(--tone-action, var(--m3-primary))`",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          { id: "aria-selected", enabled: true },
          { id: "tabindex", enabled: true },
          { id: "button-name", enabled: true },
        ],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminTabRail>;

// --- helpers ----------------------------------------------------------------

function StagesDemo({
  ariaLabel = "Sections",
  initial = "review",
}: {
  ariaLabel?: string;
  initial?: string;
}) {
  const [active, setActive] = useState(initial);
  return (
    <AdminTabRail
      ariaLabel={ariaLabel}
      activeId={active}
      onChange={setActive}
      tabs={[
        { id: "review", label: "Review", icon: RiTimeLine, count: 12 },
        { id: "assess", label: "Assess", icon: RiCheckboxCircleLine, count: 5 },
        { id: "certify", label: "Certify", icon: RiLeafLine, count: 3 },
        { id: "history", label: "History", icon: RiListCheck2 },
      ]}
    />
  );
}

// --- core variants ---------------------------------------------------------

export const LabelsOnly: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("overview");
      return (
        <AdminTabRail
          ariaLabel="Garden sections"
          activeId={active}
          onChange={setActive}
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "impact", label: "Impact" },
            { id: "work", label: "Work" },
            { id: "community", label: "Community" },
          ]}
        />
      );
    };
    return <Demo />;
  },
};

export const WithIconsAndCounts: Story = {
  tags: ["storybook-ci"],
  render: () => <StagesDemo />,
  /**
   * WAI-ARIA Tabs keyboard pattern: ArrowRight cycles forward, ArrowLeft
   * cycles back, Home/End jump to ends. Activation follows focus and
   * `aria-selected` updates on the active tab; only the active tab carries
   * `tabindex=0`.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tablist = await canvas.findByRole("tablist", { name: /sections/i });
    await expect(tablist).toBeVisible();

    const reviewTab = await canvas.findByRole("tab", { name: /Review/ });
    const assessTab = await canvas.findByRole("tab", { name: /Assess/ });
    const certifyTab = await canvas.findByRole("tab", { name: /Certify/ });
    const historyTab = await canvas.findByRole("tab", { name: /History/ });

    // Initial: review is active and tabbable; others are not in the tab order.
    await expect(reviewTab).toHaveAttribute("aria-selected", "true");
    await expect(reviewTab).toHaveAttribute("tabindex", "0");
    await expect(assessTab).toHaveAttribute("tabindex", "-1");

    // ArrowRight from review → assess.
    reviewTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(assessTab).toHaveAttribute("aria-selected", "true");
    await expect(assessTab).toHaveAttribute("tabindex", "0");

    // End jumps to History.
    await userEvent.keyboard("{End}");
    await expect(historyTab).toHaveAttribute("aria-selected", "true");

    // Home jumps back to Review.
    await userEvent.keyboard("{Home}");
    await expect(reviewTab).toHaveAttribute("aria-selected", "true");

    // ArrowLeft from Review wraps to History.
    await userEvent.keyboard("{ArrowLeft}");
    await expect(historyTab).toHaveAttribute("aria-selected", "true");

    // Click still works alongside the keyboard handler.
    await userEvent.click(certifyTab);
    await expect(certifyTab).toHaveAttribute("aria-selected", "true");
  },
};

export const NarrowActionsLifecycle: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("active");
      return (
        <div className="w-[428px] max-w-full overflow-hidden">
          <AdminTabRail
            ariaLabel="Filter actions by lifecycle"
            activeId={active}
            onChange={setActive}
            tabs={[
              { id: "all", label: "All", count: 22 },
              { id: "active", label: "Active", count: 8 },
              { id: "upcoming", label: "Upcoming", count: 10 },
              { id: "completed", label: "Completed", count: 4 },
            ]}
          />
        </div>
      );
    };
    return <Demo />;
  },
};

export const StateCatalog: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("overview");
      return (
        <AdminTabRail
          ariaLabel="Sections"
          activeId={active}
          onChange={setActive}
          tabs={[
            { id: "overview", label: "Overview", count: 2 },
            { id: "impact", label: "Impact", icon: RiLeafLine },
            { id: "treasury", label: "Treasury", disabled: true },
            { id: "history", label: "History", count: 128 },
          ]}
        />
      );
    };
    return <Demo />;
  },
};

// --- count-state coverage --------------------------------------------------

/** Zero-count badges suppressed; >99 collapse to "99+". */
export const CountStates: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("none");
      return (
        <AdminTabRail
          ariaLabel="Count states"
          activeId={active}
          onChange={setActive}
          tabs={[
            { id: "none", label: "None", count: 0 },
            { id: "single", label: "Single", count: 1 },
            { id: "many", label: "Many", count: 99 },
            { id: "overflow", label: "Overflow", count: 1234 },
          ]}
        />
      );
    };
    return <Demo />;
  },
};

// --- tone matrix -----------------------------------------------------------

function ToneFrame({
  tone,
  children,
}: {
  tone: "hub" | "garden" | "community" | "actions";
  children: React.ReactNode;
}) {
  return (
    <div data-tone={tone} className="rounded-2xl bg-bg-white-0 p-4">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
        [data-tone="{tone}"]
      </div>
      {children}
    </div>
  );
}

/**
 * Hub tone — `[data-tone="hub"]`, blue accent on active tab raised bg + count
 * chip. Visual weight stays neutral; tone reads as "context", not "content"
 * per `DESIGN_NOTES § Tone system`.
 */
export const HubTone: Story = {
  render: () => (
    <ToneFrame tone="hub">
      <StagesDemo ariaLabel="Hub stages" />
    </ToneFrame>
  ),
};

/** Garden tone — green accent. */
export const GardenTone: Story = {
  render: () => (
    <ToneFrame tone="garden">
      <StagesDemo ariaLabel="Garden tabs" />
    </ToneFrame>
  ),
};

/** Community tone — warm-amber accent. */
export const CommunityTone: Story = {
  render: () => (
    <ToneFrame tone="community">
      <StagesDemo ariaLabel="Community tabs" />
    </ToneFrame>
  ),
};

/** Actions tone — clay accent. */
export const ActionsTone: Story = {
  render: () => (
    <ToneFrame tone="actions">
      <StagesDemo ariaLabel="Actions tabs" />
    </ToneFrame>
  ),
};

// --- reduced motion ---------------------------------------------------------

/**
 * Reduced motion — the tone wash transition + bg color transition still
 * apply on active-tab change, but `prefers-reduced-motion: reduce` should
 * shorten or disable them. This story renders inside a wrapper that
 * declares the reduced-motion media query so reviewers can verify the
 * component degrades gracefully.
 */
export const ReducedMotion: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Toggle DevTools → Rendering → Emulate CSS media `prefers-reduced-motion: reduce` to verify the tone-wash transition disables. The component itself doesn't gate transitions on reduced motion (the underlying spring config does); this story is a manual harness.",
      },
    },
  },
  render: () => <StagesDemo />,
};
