import type { Meta, StoryObj } from "@storybook/react";
import { SheetDivider } from "./SheetDivider";

const meta: Meta<typeof SheetDivider> = {
  title: "Shared/Canvas/Sheet anatomy/SheetDivider",
  component: SheetDivider,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: [
          "**SheetDivider** — visual rule between `<SheetBody>` sections.",
          "",
          "Anatomy from `design_handoff_admin-revamp/screens/sheet-system.css`:",
          "- 1px tall, `var(--hairline)` background",
          "- `16px 0` vertical margin",
          '- `role="separator"` for screen-reader semantics',
          "",
          "Use between distinct sections inside a SheetBody (e.g. profile identity → fields → gardens).",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [{ id: "aria-roles", enabled: true }],
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SheetDivider>;

const sheetFrame = (children: React.ReactNode) => (
  <div
    className="flex flex-col overflow-hidden border border-stroke-soft bg-bg-white-0"
    style={{ width: 360, padding: "20px 16px", borderRadius: "var(--radius-sheet, 24px)" }}
  >
    {children}
  </div>
);

const sectionTitle = (label: string) => (
  <div className="text-[11px] font-semibold uppercase tracking-wider text-text-soft">{label}</div>
);

const fieldRow = (label: string, value: string) => (
  <div className="flex items-baseline justify-between gap-3 text-sm">
    <span className="text-text-soft">{label}</span>
    <span className="text-text-strong">{value}</span>
  </div>
);

/** Default 1px hairline with `16px 0` margin between sections. */
export const Default: Story = {
  render: () =>
    sheetFrame(
      <>
        {sectionTitle("Identity")}
        <div className="mt-2 space-y-2">
          {fieldRow("Display name", "Alex Moreno")}
          {fieldRow("Email", "alex@wefa.world")}
        </div>
        <SheetDivider />
        {sectionTitle("Organisation")}
        <div className="mt-2 space-y-2">
          {fieldRow("Workspace", "Green Goods Network")}
          {fieldRow("Role", "Deployer")}
        </div>
        <SheetDivider />
        {sectionTitle("Assigned gardens")}
        <div className="mt-2 space-y-1 text-sm text-text-strong">
          <div>Milpa Alta</div>
          <div>Xochimilco</div>
          <div>Tepoztlán</div>
        </div>
      </>
    ),
};

/**
 * Custom margin override — pass `style` to compress the spacing in dense
 * settings panels.
 */
export const CompactMargin: Story = {
  render: () =>
    sheetFrame(
      <>
        <div className="text-sm">Section A</div>
        <SheetDivider style={{ margin: "8px 0" }} />
        <div className="text-sm">Section B</div>
        <SheetDivider style={{ margin: "8px 0" }} />
        <div className="text-sm">Section C</div>
      </>
    ),
};
