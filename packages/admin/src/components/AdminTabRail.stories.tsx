import { RiCheckboxCircleLine, RiLeafLine, RiListCheck2, RiTimeLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
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
          "**AdminTabRail** — the installed app's equal-width tabs at the cockpit's 36px height (F8).",
          "",
          "Anatomy:",
          "- Row: equal cells on a hairline rule in the warm stone border step. Below 640px the row fills the width; from 640px each cell stops at 180px and the row keeps to the left",
          "- Cell: an equal share of the row, never narrower than its icon, label and count on one line, so a label never clips; a row that cannot hold its cells scrolls (D18)",
          "- Label: 12px with 4px gaps and 6px sides on a phone, 14px with 8px gaps and 12px sides from 640px, weight 500 in both states",
          "- Active: a 10% tint of the workspace accent fills the cell, and the label and a 2px underline take the accent itself (the tone's active-tab use); inactive sub ink, hover darkens text only",
          "- Count badge: the shared `CountBadge`, 16px with 11px/600 numerals on the workspace tone's accent, only where something waits on the steward (DL-134); a total goes in the panel's own header line and a flag shows nothing",
          "- Hovers never shift hue or background — text darken only",
          "",
          "**Accessibility**:",
          '- `role="tablist"` + `role="tab"` + `aria-selected` per WAI-ARIA Tabs pattern',
          "- Roving tabindex (active tab is the only one tabbable)",
          "- Keyboard nav: ArrowLeft/ArrowRight cycle, Home/End jump (skip disabled tabs)",
          "- Tone color is supplemental — `aria-selected` is the primary state announcement",
          "- Focus ring uses `var(--tone-focus-ring, var(--m3-primary))` (action color in light, bright accent in dark)",
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

const SM_BREAKPOINT_PX = 640;
const DESKTOP_CELL_MAX_PX = 180;
const ADMIN_MOBILE_390_VIEWPORT = {
  adminMobile390x844: {
    name: "Admin mobile 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
} as const;

function cellRects(rail: HTMLElement): DOMRect[] {
  return Array.from(rail.querySelectorAll<HTMLElement>('[role="tab"]')).map((tab) =>
    tab.getBoundingClientRect()
  );
}

/** A selected cell carries the accent tint; an unselected one paints nothing. */
function isTinted(tab: HTMLElement): boolean {
  // The computed fill's channels; a fourth is its alpha, absent when opaque.
  const channels = getComputedStyle(tab).backgroundColor.match(/[\d.]+/g) ?? [];
  return channels.length >= 3 && Number(channels[3] ?? 1) > 0;
}

/** The label's own text, laid out whole inside its cell. */
function labelFits(tab: HTMLElement, label: string): boolean {
  const span = Array.from(tab.querySelectorAll("span")).find((node) => node.textContent === label);
  if (!span) return false;
  const text = span.getBoundingClientRect();
  const cell = tab.getBoundingClientRect();
  return text.left >= cell.left && text.right <= cell.right && span.scrollWidth <= span.clientWidth;
}

function StagesDemo({
  ariaLabel = "Sections",
  initial = "work",
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
        { id: "work", label: "Work", icon: RiTimeLine, count: 12 },
        { id: "confirm", label: "Confirm", icon: RiCheckboxCircleLine, count: 3 },
        { id: "assess", label: "Assessments", icon: RiListCheck2 },
        { id: "certify", label: "Hypercerts", icon: RiLeafLine },
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

export const TranslatedDescenders: Story = {
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("payouts");
      return (
        <AdminTabRail
          ariaLabel="Secciones de la comunidad"
          activeId={active}
          onChange={setActive}
          tabs={[
            { id: "members", label: "Miembros" },
            { id: "coordination", label: "Coordinación" },
            { id: "endowment", label: "Provisión" },
            { id: "payouts", label: "Pagos" },
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

    const workTab = await canvas.findByRole("tab", { name: /Work/ });
    const confirmTab = await canvas.findByRole("tab", { name: /Confirm/ });
    const assessTab = await canvas.findByRole("tab", { name: /Assessments/ });
    const certifyTab = await canvas.findByRole("tab", { name: /Hypercerts/ });

    // Initial: work is active and tabbable; others are not in the tab order.
    await expect(workTab).toHaveAttribute("aria-selected", "true");
    await expect(workTab).toHaveAttribute("tabindex", "0");
    await expect(confirmTab).toHaveAttribute("tabindex", "-1");

    // ArrowRight from work → confirm.
    workTab.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(confirmTab).toHaveAttribute("aria-selected", "true");
    await expect(confirmTab).toHaveAttribute("tabindex", "0");

    // End jumps to Hypercerts.
    await userEvent.keyboard("{End}");
    await expect(certifyTab).toHaveAttribute("aria-selected", "true");

    // Home jumps back to Work. The handler moves focus via rAF, so
    // explicitly refocus the just-selected tab before the next keypress
    // to avoid races in headless test runners.
    await userEvent.keyboard("{Home}");
    await expect(workTab).toHaveAttribute("aria-selected", "true");
    workTab.focus();

    // ArrowLeft from Work wraps to Hypercerts.
    await userEvent.keyboard("{ArrowLeft}");
    await expect(certifyTab).toHaveAttribute("aria-selected", "true");

    // Click still works alongside the keyboard handler.
    await userEvent.click(assessTab);
    await expect(assessTab).toHaveAttribute("aria-selected", "true");
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
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "upcoming", label: "Upcoming" },
              { id: "completed", label: "Completed" },
            ]}
          />
        </div>
      );
    };
    return <Demo />;
  },
};

/**
 * The Hub's four cells, each with an icon, a label and a count, need more than
 * a phone's rail even at 12px, so the row scrolls instead of clipping a label.
 * The clipped edge fades so the rail reads as scrollable, and tabs snap as it
 * scrolls (D18).
 */
export const OverflowOnAPhone: Story = {
  tags: ["storybook-ci"],
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("work");
      return (
        <div style={{ width: 283 }}>
          <AdminTabRail
            ariaLabel="Hub stages"
            activeId={active}
            onChange={setActive}
            tabs={[
              { id: "work", label: "Work", icon: RiTimeLine, count: 6 },
              { id: "confirm", label: "Confirm", icon: RiCheckboxCircleLine, count: 2 },
              { id: "assess", label: "Assessments", icon: RiListCheck2 },
              { id: "certify", label: "Hypercerts", icon: RiLeafLine },
            ]}
          />
        </div>
      );
    };
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    const rail = await within(canvasElement).findByRole("tablist", { name: "Hub stages" });
    const fades = () => {
      const style = getComputedStyle(rail);
      return (style.maskImage || style.getPropertyValue("-webkit-mask-image")) !== "none";
    };
    await expect(rail).toHaveAttribute("data-overflow", "end");
    await expect(fades()).toBe(true);
    await expect(getComputedStyle(rail).scrollSnapType).toContain("x");

    rail.scrollLeft = rail.scrollWidth;
    await waitFor(() => expect(rail).toHaveAttribute("data-overflow", "start"));
    await expect(fades()).toBe(true);
  },
};

/**
 * From 640px each cell takes an equal share of the row up to 180px and the row
 * keeps to the left. The Portuguese Community row carries the cockpit's longest
 * route label, "Coordenação"; its four cells make a 720px row. The tint and the
 * underline follow the selected tab.
 */
export const EqualCellsOnDesktop: Story = {
  tags: ["storybook-ci"],
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("members");
      return (
        <div style={{ width: "100%" }}>
          <AdminTabRail
            ariaLabel="Visualizações da comunidade"
            activeId={active}
            onChange={setActive}
            tabs={[
              { id: "members", label: "Membros", count: 3 },
              { id: "coordination", label: "Coordenação" },
              { id: "endowment", label: "Provisão" },
              { id: "payouts", label: "Pagamentos" },
            ]}
          />
        </div>
      );
    };
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    // The cap applies from the `sm` breakpoint; fail loud if the runner's
    // viewport drops below it, or leaves less room than four full cells.
    await expect(window.innerWidth).toBeGreaterThanOrEqual(SM_BREAKPOINT_PX);
    const canvas = within(canvasElement);
    const rail = await canvas.findByRole("tablist", { name: "Visualizações da comunidade" });
    const room = rail.parentElement?.getBoundingClientRect();
    await expect(room?.width ?? 0).toBeGreaterThan(4 * DESKTOP_CELL_MAX_PX);

    // The row, rule included, ends with its fourth 180px cell at the left.
    const railBox = rail.getBoundingClientRect();
    await expect(Math.abs(railBox.width - 4 * DESKTOP_CELL_MAX_PX)).toBeLessThan(0.5);
    await expect(Math.abs(railBox.left - (room?.left ?? 0))).toBeLessThan(0.5);
    for (const cell of cellRects(rail)) {
      await expect(Math.abs(cell.width - DESKTOP_CELL_MAX_PX)).toBeLessThan(0.5);
    }
    // The flag follows the rail's resize observer, which reports a frame after
    // the layout read above, so a first render at another width can leave it
    // stale for that frame.
    await waitFor(() => expect(rail).toHaveAttribute("data-overflow", "none"));
    await expect(labelFits(canvas.getByRole("tab", { name: "Coordenação" }), "Coordenação")).toBe(
      true
    );

    const members = canvas.getByRole("tab", { name: /Membros/ });
    const payouts = canvas.getByRole("tab", { name: /Pagamentos/ });
    await expect(members).toHaveAttribute("aria-selected", "true");
    await expect(isTinted(members)).toBe(true);
    await expect(isTinted(payouts)).toBe(false);

    await userEvent.click(payouts);
    await expect(payouts).toHaveAttribute("aria-selected", "true");
    // The fill eases between the two cells; wait for it to settle.
    await waitFor(() => expect(isTinted(members)).toBe(false));
    await expect(isTinted(payouts)).toBe(true);
  },
};

/**
 * Below 640px the row fills the phone's width. The Portuguese Garden row at a
 * 320px phone's 296px rail: every label sits whole in its cell at 12px, so the
 * row needs no scroll. A cell whose label needs more than an equal share takes
 * only that much more.
 */
export const FullWidthOnAPhone: Story = {
  tags: ["storybook-ci"],
  parameters: { viewport: { options: ADMIN_MOBILE_390_VIEWPORT } },
  globals: { viewport: { value: "adminMobile390x844" } },
  render: () => {
    const Demo = () => {
      const [active, setActive] = useState("health");
      return (
        <div style={{ width: 296 }}>
          <AdminTabRail
            ariaLabel="Visualizações do jardim"
            activeId={active}
            onChange={setActive}
            tabs={[
              { id: "health", label: "Saúde", count: 2 },
              { id: "impact", label: "Impacto" },
              { id: "activity", label: "Atividade" },
              { id: "pool", label: "Promessas" },
            ]}
          />
        </div>
      );
    };
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    await expect(window.innerWidth).toBeLessThan(SM_BREAKPOINT_PX);
    const canvas = within(canvasElement);
    const rail = await canvas.findByRole("tablist", { name: "Visualizações do jardim" });
    const railBox = rail.getBoundingClientRect();
    const cells = cellRects(rail);

    // The cells span the rail edge to edge, and nothing scrolls.
    await expect(Math.abs(cells[0].left - railBox.left)).toBeLessThan(0.5);
    await expect(Math.abs(cells[cells.length - 1].right - railBox.right)).toBeLessThan(0.5);
    // The flag follows the rail's resize observer, a frame behind the layout.
    await waitFor(() => expect(rail).toHaveAttribute("data-overflow", "none"));

    for (const label of ["Saúde", "Impacto", "Atividade", "Promessas"]) {
      const tab = canvas.getByRole("tab", { name: new RegExp(label) });
      await expect(labelFits(tab, label)).toBe(true);
      await expect(getComputedStyle(tab).fontSize).toBe("12px");
    }
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
            { id: "history", label: "History" },
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
  tags: ["storybook-ci"],
  /**
   * The badge count reaches assistive tech through translated, visually hidden
   * text — not an `aria-label` on a role-less span, which is not reliably
   * exposed and announces a bare number without units. The visible badge also
   * collapses past 99, so the accessible name must carry the true count.
   */
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByRole("tab", { name: "Single 1 waiting" })).toBeVisible();
    await expect(canvas.getByRole("tab", { name: "Many 99 waiting" })).toBeVisible();
    // Visible badge reads "99+"; the accessible name keeps the real number.
    await expect(canvas.getByRole("tab", { name: "Overflow 1,234 waiting" })).toBeVisible();
    // A zero count renders no badge at all.
    await expect(canvas.getByRole("tab", { name: "None" })).toBeVisible();
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
      <div className="mb-2 type-meta-sm font-semibold uppercase tracking-[0.06em] text-text-soft">
        [data-tone=&quot;{tone}&quot;]
      </div>
      {children}
    </div>
  );
}

/**
 * Hub tone — `[data-tone="hub"]`, blue accent on the active cell's tint, label
 * and underline, and on every count badge. Visual weight stays neutral; tone
 * reads as "context", not "content" per `DESIGN_NOTES § Tone system`.
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
/** The Actions workspace is purple, off the error red (DL-045): purple-700 in light. */
export const ActionsTone: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <ToneFrame tone="actions">
      <StagesDemo ariaLabel="Actions tabs" />
    </ToneFrame>
  ),
  play: async ({ canvasElement }) => {
    const active = await within(canvasElement).findByRole("tab", { selected: true });
    await expect(getComputedStyle(active).color).toBe("rgb(91, 44, 201)");
  },
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
