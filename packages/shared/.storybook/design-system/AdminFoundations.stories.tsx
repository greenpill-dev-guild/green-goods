import { RiAddLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { AdminButton, AdminIconButton } from "../../../admin/src/components/AdminButton";
import { AdminCard } from "../../../admin/src/components/AdminCard";
import { AdminFilterChip } from "../../../admin/src/components/AdminFilterChip";
import { AdminSortSelect } from "../../../admin/src/components/AdminSortSelect";
import { AdminTabRail } from "../../../admin/src/components/AdminTabRail";
import { AdminTextField } from "../../../admin/src/components/AdminTextField";
import { Page, Section, Specimen, StoryLink, TokenTable } from "./measure";
import { ADMIN, STORY_LINKS } from "./rules";

const meta = {
  title: "Design System/Admin/Foundations",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The cockpit's own tokens, read live on the admin surface: the M3 shape set (4 / 8 / 12 / 16 / 9999), the compressed type scale (14px body and labels, 12px meta, 11px in chips), the DL-011 compact heights (28 / 32 / 36 / 40 / 44), the five workspace tones, and the single elevation ladder. It replaced the Tier 1a token story, whose aliases (--ink, --stone, --g-action, --r-*) had no consumer in admin source.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="admin-m3" data-tone="hub" data-workspace="hub">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const TONES = ["hub", "garden", "community", "actions", "home"] as const;

function CornerSwatch({ radiusVar, label }: { radiusVar: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
      <div className="sb-corner-swatch" style={{ borderRadius: `var(${radiusVar})` }} aria-label={label} />
      <code style={{ font: "500 11px/1.3 ui-monospace, monospace" }}>{radiusVar}</code>
    </div>
  );
}

export const Tokens: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <Page
      title="Admin cockpit · Foundations"
      lede="Strict M3 backbone, Warm Earth material. Everything below is read from the admin surface as the runtime resolves it."
    >
      <Section id="shape" title="Shape set" lede="4 / 8 / 12 / 16 / 9999px. The shared rounded-xl and rounded-2xl utilities land on the 16px page-container step through the unlayered remap in index.css (DL-029).">
        <div className="sb-ds-row" style={{ marginBottom: 14 }}>
          <CornerSwatch radiusVar="--m3-shape-xs" label="4px" />
          <CornerSwatch radiusVar="--m3-shape-sm" label="8px" />
          <CornerSwatch radiusVar="--m3-shape-md" label="12px" />
          <CornerSwatch radiusVar="--m3-shape-lg" label="16px" />
          <CornerSwatch radiusVar="--m3-shape-full" label="pill" />
          <CornerSwatch radiusVar="--radius-xl" label="rounded-xl" />
          <CornerSwatch radiusVar="--radius-2xl" label="rounded-2xl" />
        </div>
        <TokenTable
          tokens={[
            { name: "--m3-shape-xs", expected: "4px", note: "checkbox, tooltip" },
            { name: "--m3-shape-sm", expected: "8px", note: "chips, filled field top corners, outlined fields" },
            { name: "--m3-shape-md", expected: "12px", note: "cards, choice rows, selectable cards" },
            { name: "--m3-shape-lg", expected: "16px", note: "dialogs, page containers" },
            { name: "--m3-shape-full", expected: "9999px", note: "buttons, toolbar pills, FAB" },
            { name: "--radius-xs", expected: "4px", note: "remapped in index.css" },
            { name: "--radius-sm", expected: "8px", note: "remapped in index.css" },
            { name: "--radius-xl", expected: "16px", note: "rounded-xl, remapped in index.css" },
            { name: "--radius-2xl", expected: "16px", note: "rounded-2xl, remapped in index.css" },
          ]}
        />
      </Section>

      <Section id="type" title="Type scale" lede="Plus Jakarta Sans. 14px body and labels (every button size), 12px meta and floating field labels, 11px inside chips only; 16px only for field text on touch widths; title-large 22px for dialog and app-bar titles, title-medium 16px for route headers.">
        <TokenTable
          tokens={[
            { name: "--text-title-lg", expected: "22px", note: "dialog and flow titles, the app bar" },
            { name: "--text-title-md", expected: "16px", note: "route header title" },
            { name: "--text-title-sm", expected: "14px" },
            { name: "--text-body-lg", expected: "16px" },
            { name: "--text-body-md", expected: "14px", note: "field text, body" },
            { name: "--text-body-sm", expected: "12px", note: "floating labels, supporting text" },
            { name: "--text-label-lg", expected: "14px", note: "buttons, chips, tabs" },
            { name: "--text-label-md", expected: "12px", note: "meta, count chips" },
            { name: "--text-label-sm", expected: "11px", note: "chips only" },
            { name: "--font-heading", note: "Plus Jakarta Sans" },
          ]}
        />
        <div className="sb-ds-row" style={{ marginTop: 14 }}>
          <Specimen title="button label · 14px / 500" expect={{ labelSize: 14, weight: 500, family: "Plus Jakarta Sans" }}>
            <AdminButton>Create Garden</AdminButton>
          </Specimen>
          <Specimen title="field text · 14px (16px on touch widths)" target="input" expect={ADMIN.fieldInput()}>
            <div style={{ width: 240 }}>
              <AdminTextField label="Garden name" defaultValue="Rio Claro" />
            </div>
          </Specimen>
          <Specimen title="dialog title · 22px" target="h2" expect={{ labelSize: 22, weight: 600 }}>
            <h2 className="text-title-lg font-semibold text-[rgb(var(--m3-on-surface))]">Start a Season</h2>
          </Specimen>
        </div>
      </Section>

      <Section id="heights" title="Compact metric (DL-011)" lede="28 / 32 / 36 / 40 / 44: buttons 28 / 32 / 40, toolbar pills and tabs 36, chips 32, identity pill 36, fields 40 from 640px and 44 on touch widths (DL-029). Shell chrome (56px app bar, 48 / 56px FAB, the nav dock) sits outside the scale by design.">
        <div className="sb-ds-row">
          <Specimen title="28 · sm button" expect={{ height: 28, hit: 44 }}>
            <AdminButton size="sm" variant="outlined">
              Manage Members
            </AdminButton>
          </Specimen>
          <Specimen title="32 · md button, chip" target="button" all expect={{ height: 32 }}>
            <AdminButton>Create Garden</AdminButton>
            <AdminFilterChip label="Pending" selected={false} onToggle={() => {}} />
          </Specimen>
          <Specimen title="36 · toolbar pill" target="label" expect={{ height: 36, radius: "pill" }}>
            <AdminSortSelect value="recent" onChange={() => {}} options={[{ value: "recent", label: "Newest" }]} />
          </Specimen>
          <Specimen title="36 · tab" target='[role="tab"]' expect={ADMIN.tab()} wide>
            <div style={{ width: "100%" }}>
              <AdminTabRail
                ariaLabel="Views"
                activeId="work"
                onChange={() => {}}
                tabs={[
                  { id: "work", label: "Work", count: 6 },
                  { id: "assess", label: "Assess" },
                ]}
              />
            </div>
          </Specimen>
          <Specimen title="40 · lg button, icon button" target="button" all expect={{ height: 40, hit: 44 }}>
            <AdminButton size="lg">Submit Work</AdminButton>
            <AdminIconButton size="lg" label="Add">
              <RiAddLine />
            </AdminIconButton>
          </Specimen>
          <Specimen title="field · 40 (44 on touch widths)" target='[data-component="AdminTextField"] > div:first-child' expect={ADMIN.fieldContainer()}>
            <div style={{ width: 240 }}>
              <AdminTextField label="Location" />
            </div>
          </Specimen>
        </div>
      </Section>

      <Section id="tones" title="Workspace tones" lede="The tone appears in exactly four places: the active tab, the active nav pill, one filled header action, and the FAB fill, plus the faint canvas wash. Each card below sets data-tone and shows its filled action and active tab.">
        <div className="sb-ds-row">
          {TONES.map((tone) => (
            <div key={tone} data-tone={tone} className="sb-specimen" style={{ flexBasis: 220 }}>
              <div className="sb-specimen-title">
                <span>{tone}</span>
              </div>
              <div
                className="storybook-canvas-frame"
                data-workspace={tone}
                style={{
                  padding: 12,
                  borderRadius: "var(--m3-shape-md)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <AdminButton size="sm">Primary Act</AdminButton>
                <AdminTabRail
                  ariaLabel={`${tone} tabs`}
                  activeId="a"
                  onChange={() => {}}
                  tabs={[
                    { id: "a", label: "Active", count: 3 },
                    { id: "b", label: "Other" },
                  ]}
                />
              </div>
              <div className="sb-specimen-readout">
                <code>--tone-action</code> · <code>--tone-on-surface-accent</code> · <code>--tone-primary-container</code>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section id="elevation" title="Elevation and state" lede="One ladder: elevation 0 / 1 / 2, plus the warm chrome shadow reserved for the floating nav dock and FAB. Hover is an elevation step or the 8% ink state layer, never a lift or hue shift (Rule 18).">
        <div className="sb-ds-row">
          {(["0", "1", "2"] as const).map((level) => (
            <Specimen key={level} title={`elevation ${level}`} target='[data-component="AdminCard"]'>
              <AdminCard style={{ boxShadow: `var(--m3-elevation-${level})`, width: 200 }}>
                <div style={{ padding: 12, fontSize: 13 }}>Card at level {level}</div>
              </AdminCard>
            </Specimen>
          ))}
          <Specimen title="chrome shadow (nav dock, FAB)">
            <div
              style={{
                width: 200,
                height: 56,
                borderRadius: "var(--m3-shape-full)",
                background: "var(--admin-chrome-bg)",
                boxShadow: "var(--admin-chrome-shadow)",
              }}
            />
          </Specimen>
        </div>
        <TokenTable
          tokens={[
            { name: "--m3-elevation-0", expected: "none" },
            { name: "--m3-elevation-1", note: "cards and filled buttons at rest" },
            { name: "--m3-elevation-2", note: "hover step, dialogs over their scrim" },
            { name: "--admin-chrome-shadow", note: "floating nav dock and FAB only" },
            { name: "--m3-state-hover", expected: "0.08" },
            { name: "--m3-state-pressed", expected: "0.12" },
          ]}
        />
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id="design-system-admin-components--buttons">Admin · Components</StoryLink>
        </div>
      </Section>
    </Page>
  ),
  play: async ({ canvasElement }) => {
    const root = getComputedStyle(document.documentElement);
    const token = (name: string) => root.getPropertyValue(name).trim();
    // Production today: the cockpit type scale and Plus Jakarta Sans.
    await expect(token("--text-label-lg")).toBe("14px");
    await expect(token("--text-label-sm")).toBe("11px");
    await expect(token("--text-body-md")).toBe("14px");
    await expect(token("--radius-sm")).toBe("8px");
    // DL-029: the xl / 2xl radii land on the 16px page-container step.
    await expect(token("--radius-xl")).toBe("16px");
    await expect(token("--radius-2xl")).toBe("16px");
    const button = within(canvasElement).getAllByRole("button", { name: "Create Garden" })[0];
    await expect(getComputedStyle(button).fontFamily.split(",")[0].replace(/["']/g, "").trim()).toBe(
      "Plus Jakarta Sans"
    );
  },
};
