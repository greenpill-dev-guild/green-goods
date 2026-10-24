import {
  RiAddLine,
  RiArrowRightLine,
  RiDeleteBinLine,
  RiSave3Line,
  RiSearchLine,
  RiShareLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, waitFor, within } from "storybook/test";
import { GardenChip } from "../../src/components/Canvas/GardenChip";
import { FactList, FactRow } from "../../src/components/Cards/FactRow";
import { Switch } from "../../src/components/Form/ControlPrimitives";
import { AdminButton, AdminIconButton } from "../../../admin/src/components/AdminButton";
import { AdminCheckbox } from "../../../admin/src/components/AdminCheckbox";
import { AdminChoiceGroup } from "../../../admin/src/components/AdminChoiceGroup";
import { AdminDialog } from "../../../admin/src/components/AdminDialog";
import { AdminFilterChip } from "../../../admin/src/components/AdminFilterChip";
import { AdminInlineField } from "../../../admin/src/components/AdminInlineField";
import { AdminSearchToolbar } from "../../../admin/src/components/AdminSearchToolbar";
import { AdminSelectableCard } from "../../../admin/src/components/AdminSelectableCard";
import { AdminSideSheet } from "../../../admin/src/components/AdminSideSheet";
import { AdminSortSelect } from "../../../admin/src/components/AdminSortSelect";
import { AdminTabRail } from "../../../admin/src/components/AdminTabRail";
import {
  AdminSelect,
  AdminTextArea,
  AdminTextField,
} from "../../../admin/src/components/AdminTextField";
import { AppBar } from "../../../admin/src/components/Shell/AppBar";
import { measureElement, Page, Row, Section, Specimen, StoryLink } from "./measure";
import { ADMIN, ADMIN_SIZES, type AdminSize, STORY_LINKS } from "./rules";

const meta = {
  title: "Design System/Admin/Components",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Every admin button, icon button, field, chip, tab, choice, card, checkbox, switch, search, sort, and close control on one page, rendered from the real Admin* primitives with the cockpit's own tokens (Plus Jakarta Sans, the M3 type scale, the admin radius set) and measured live against the DL-011 compact metric and Rule 18. A red chip is a live shortfall against the cockpit rules.",
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

const BUTTON_VARIANTS = ["filled", "tonal", "elevated", "outlined", "text", "danger"] as const;
const ICON_VARIANTS = ["standard", "accent", "tonal", "filled", "danger"] as const;
const SIZE_LABEL: Record<AdminSize, string> = { sm: "sm · 28", md: "md · 32", lg: "lg · 40" };

function ButtonSections() {
  return (
    <>
      <Section
        id="buttons"
        title="AdminButton"
        lede="Pill at every size with one 14px label and a 44px finger box (DL-012, DL-030), no press morph."
      >
        {ADMIN_SIZES.map((size) => (
          <Row key={size}>
            {BUTTON_VARIANTS.map((variant) => (
              <Specimen
                key={variant}
                title={`${variant} · ${SIZE_LABEL[size]}`}
                expect={ADMIN.button(size)}
              >
                <AdminButton
                  variant={variant}
                  size={size}
                  leadingIcon={variant === "filled" ? <RiSave3Line /> : undefined}
                >
                  {variant === "danger" ? "Remove Member" : "Create Garden"}
                </AdminButton>
              </Specimen>
            ))}
          </Row>
        ))}
        <Row>
          <Specimen title="disabled · md" expect={ADMIN.button("md")}>
            <AdminButton disabled>Create Garden</AdminButton>
          </Specimen>
          <Specimen title="loading · md" expect={ADMIN.button("md")}>
            <AdminButton loading>Saving</AdminButton>
          </Specimen>
          <Specimen title="outlined disabled · md" expect={ADMIN.button("md")}>
            <AdminButton variant="outlined" disabled>
              Cancel
            </AdminButton>
          </Specimen>
          <Specimen title="leading icon · sm" expect={ADMIN.button("sm")}>
            <AdminButton size="sm" variant="tonal" leadingIcon={<RiAddLine />}>
              Add Member
            </AdminButton>
          </Specimen>
          <Specimen title="as link · md" expect={ADMIN.button("md")} target="a">
            <AdminButton asChild variant="outlined">
              <a href="#buttons">Open Garden</a>
            </AdminButton>
          </Specimen>
        </Row>
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.adminButton}>Admin/Primitives/AdminButton</StoryLink>
        </div>
      </Section>

      <Section
        id="icon-buttons"
        title="AdminIconButton"
        lede="Glyph-only actions on the same 28 / 32 / 40 tiers with a mandatory accessible name."
      >
        {ADMIN_SIZES.map((size) => (
          <Row key={size}>
            {ICON_VARIANTS.map((variant) => (
              <Specimen
                key={variant}
                title={`${variant} · ${SIZE_LABEL[size]}`}
                expect={ADMIN.iconButton(size)}
              >
                <AdminIconButton variant={variant} size={size} label={`${variant} ${size}`}>
                  {variant === "danger" ? <RiDeleteBinLine /> : <RiShareLine />}
                </AdminIconButton>
              </Specimen>
            ))}
          </Row>
        ))}
        <Row>
          <Specimen title="disabled · md" expect={ADMIN.iconButton("md")}>
            <AdminIconButton label="Disabled" disabled>
              <RiAddLine />
            </AdminIconButton>
          </Specimen>
          <Specimen title="loading · md" expect={ADMIN.iconButton("md")}>
            <AdminIconButton label="Loading" loading>
              <RiAddLine />
            </AdminIconButton>
          </Specimen>
        </Row>
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.adminIconButtons}>Admin/Primitives/AdminButton › IconButtons</StoryLink>
        </div>
      </Section>
    </>
  );
}

/** The label above the outlined box, at the field title's 14px / 500, in every state (F3). */
const FIELD_TARGETS = (
  component: "AdminTextField" | "AdminSelect",
  control: "input" | "select" | "textarea"
) => [
  {
    name: "container",
    selector: `[data-component="${component}"] [data-region="field-container"]`,
    expect: control === "textarea" ? { radius: 8 } : ADMIN.fieldContainer(),
  },
  { name: "label", selector: "label", expect: ADMIN.fieldTitle() },
  { name: control, selector: control, expect: ADMIN.fieldInput() },
];

function Fields() {
  return (
    <Section
      id="fields"
      title="Fields"
      lede="AdminTextField, AdminTextArea, and AdminSelect in the installed app's anatomy (F3): the 14px label above, an outlined box on the responsive tier (DL-030), 44px with 16px text on touch widths and 40px with 14px text from 640px, and a two-line message line. AdminInlineField shares the 32px md-button axis. Use the viewport toolbar to see the touch tier."
    >
      <Row>
        <Specimen title="empty" targets={FIELD_TARGETS("AdminTextField", "input")}>
          <div style={{ width: "100%" }}>
            <AdminTextField label="Garden name" placeholder="e.g., Rio Claro" />
          </div>
        </Specimen>
        <Specimen title="value" targets={FIELD_TARGETS("AdminTextField", "input")}>
          <div style={{ width: "100%" }}>
            <AdminTextField label="Garden name" defaultValue="Rio Claro Community Garden" />
          </div>
        </Specimen>
        <Specimen title="error" targets={FIELD_TARGETS("AdminTextField", "input")}>
          <div style={{ width: "100%" }}>
            <AdminTextField label="Garden name" defaultValue="" error="Enter a garden name" />
          </div>
        </Specimen>
        <Specimen title="disabled" targets={FIELD_TARGETS("AdminTextField", "input")}>
          <div style={{ width: "100%" }}>
            <AdminTextField label="Garden name" defaultValue="Rio Claro" disabled />
          </div>
        </Specimen>
        <Specimen title="required + helper" targets={FIELD_TARGETS("AdminTextField", "input")}>
          <div style={{ width: "100%" }}>
            <AdminTextField label="Location" required helperText="City and country" />
          </div>
        </Specimen>
        <Specimen title="leading icon" targets={FIELD_TARGETS("AdminTextField", "input")}>
          <div style={{ width: "100%" }}>
            <AdminTextField label="Search members" leadingIcon={RiSearchLine} />
          </div>
        </Specimen>
        <Specimen title="select" targets={FIELD_TARGETS("AdminSelect", "select")}>
          <div style={{ width: "100%" }}>
            <AdminSelect label="Domain" defaultValue="agro">
              <option value="">Choose a domain</option>
              <option value="agro">Agroforestry</option>
              <option value="solar">Solar</option>
            </AdminSelect>
          </div>
        </Specimen>
        <Specimen title="textarea · 3 rows" targets={FIELD_TARGETS("AdminTextField", "textarea")}>
          <div style={{ width: "100%" }}>
            <AdminTextArea label="Description" defaultValue="The global community garden." />
          </div>
        </Specimen>
        <Specimen
          title="inline field · 32"
          targets={[
            { name: "input", selector: "input", expect: ADMIN.inlineField() },
            { name: "action", selector: "button", expect: ADMIN.button("md") },
          ]}
          wide
        >
          <div style={{ width: "100%", maxWidth: 420 }}>
            <InlineFieldDemo />
          </div>
        </Specimen>
      </Row>
      <div className="sb-ds-links" style={{ marginTop: 12 }}>
        <StoryLink id={STORY_LINKS.adminTextField}>Admin/Primitives/AdminTextField</StoryLink>
        <StoryLink id={STORY_LINKS.adminInlineField}>Admin/Primitives/AdminInlineField</StoryLink>
      </div>
    </Section>
  );
}

function InlineFieldDemo() {
  const [value, setValue] = useState("");
  return (
    <AdminInlineField
      label="Hypercert token ID"
      value={value}
      onChange={setValue}
      placeholder="e.g. 12"
      action={<AdminButton variant="tonal">Register</AdminButton>}
    />
  );
}

function ChipsTabsChoices() {
  const [tab, setTab] = useState("overview");
  const [choice, setChoice] = useState("light");
  const [card, setCard] = useState<"open" | "invite">("open");
  const [checked, setChecked] = useState(true);
  const [search, setSearch] = useState("compost");
  const [sort, setSort] = useState("recent");
  const [openJoining, setOpenJoining] = useState(true);
  return (
    <>
      <Section
        id="chips-tabs"
        title="Chips and tabs"
        lede="AdminFilterChip is the 32px toolbar filter, a capsule with a 14px label, filled with the workspace tone when selected (DL-101); AdminTabRail is the route-local mode control on the 36px tier."
      >
        <Row>
          <Specimen title="filter chip · unselected" expect={ADMIN.chip()}>
            <AdminFilterChip label="Pending" selected={false} onToggle={() => {}} />
          </Specimen>
          <Specimen title="filter chip · selected" expect={ADMIN.chip()}>
            <AdminFilterChip label="Approved" selected onToggle={() => {}} />
          </Specimen>
          <Specimen title="filter chip · disabled" expect={ADMIN.chip()}>
            <AdminFilterChip label="Archived" selected={false} disabled onToggle={() => {}} />
          </Specimen>
          <Specimen title="tab rail" target='[role="tab"]' expect={ADMIN.tab()} wide>
            <div style={{ width: "100%" }}>
              <AdminTabRail
                ariaLabel="Garden views"
                activeId={tab}
                onChange={setTab}
                tabs={[
                  { id: "overview", label: "Overview" },
                  { id: "members", label: "Members", count: 45 },
                  { id: "impact", label: "Impact" },
                  { id: "settings", label: "Settings", disabled: true },
                ]}
              />
            </div>
          </Specimen>
        </Row>
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.adminFilterChip}>Admin/Primitives/AdminFilterChip</StoryLink>
          <StoryLink id={STORY_LINKS.adminTabRail}>Admin/Primitives/AdminTabRail</StoryLink>
        </div>
      </Section>

      <Section
        id="choices"
        title="Choices, cards, checkbox, switch"
        lede="AdminChoiceGroup for compact single-select preferences, AdminSelectableCard for richer choices, AdminCheckbox with its 40dp target, and the shared Switch in a setting row of the shared FactRow."
      >
        <Row>
          <Specimen title="choice group" target='[role="radio"]' expect={{ family: "Plus Jakarta Sans" }} wide>
            <div style={{ width: "100%", maxWidth: 520 }}>
              <AdminChoiceGroup
                ariaLabel="Theme"
                value={choice}
                onChange={setChoice}
                columns={3}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System", description: "Follows the device" },
                ]}
              />
            </div>
          </Specimen>
          <Specimen title="selectable cards" target='[role="radio"], button' expect={{ radius: 12 }} wide>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, width: "100%" }}>
              <AdminSelectableCard
                title="Open joining"
                description="Anyone can join."
                selected={card === "open"}
                selectionRole="radio"
                onClick={() => setCard("open")}
              />
              <AdminSelectableCard
                title="Invite only"
                description="Stewards approve each request."
                selected={card === "invite"}
                selectionRole="radio"
                onClick={() => setCard("invite")}
              />
            </div>
          </Specimen>
          <Specimen title="checkbox" target="label > span, label" expect={{ hit: 40 }}>
            <AdminCheckbox
              label="Notify stewards"
              description="Sends a weekly digest"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
          </Specimen>
          <Specimen
            title="setting row + switch"
            target='[role="switch"]'
            expect={ADMIN.sharedSwitch()}
            wide
          >
            <div style={{ width: "100%", maxWidth: 480 }}>
              <FactList>
                <FactRow
                  labelId="ds-open-joining"
                  label="Open joining"
                  description="Anyone can join without approval."
                  action={
                    <Switch
                      surface="admin"
                      aria-labelledby="ds-open-joining"
                      checked={openJoining}
                      onCheckedChange={setOpenJoining}
                    />
                  }
                />
              </FactList>
            </div>
          </Specimen>
        </Row>
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.adminChoiceGroup}>AdminChoiceGroup</StoryLink>
          <StoryLink id={STORY_LINKS.adminSelectableCard}>AdminSelectableCard</StoryLink>
          <StoryLink id={STORY_LINKS.adminCheckbox}>AdminCheckbox</StoryLink>
          <StoryLink id={STORY_LINKS.sharedFactRow}>FactRow</StoryLink>
        </div>
      </Section>

      <Section
        id="toolbar"
        title="Search and sort"
        lede="Toolbar pills on the 36px tier; the search pill's 28px clear button carries the 44px finger box."
      >
        <Row>
          <Specimen
            title="search toolbar"
            targets={[
              { name: "pill", selector: 'div[class*="m3-shape-full"]', expect: ADMIN.toolbar() },
              { name: "clear", selector: "button", expect: { hit: 44 } },
            ]}
            wide
          >
            <div style={{ width: "100%", maxWidth: 520 }}>
              <AdminSearchToolbar
                search={search}
                onSearchChange={setSearch}
                placeholder="Search gardens"
              />
            </div>
          </Specimen>
          <Specimen title="sort select" target="label" expect={ADMIN.toolbar()}>
            <AdminSortSelect
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Newest" },
                { value: "name", label: "Name" },
              ]}
            />
          </Specimen>
        </Row>
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.adminSearchToolbar}>AdminSearchToolbar</StoryLink>
          <StoryLink id={STORY_LINKS.adminSortSelect}>AdminSortSelect</StoryLink>
        </div>
      </Section>
    </>
  );
}

const GARDENS = [
  { id: "g1", name: "Rio Claro Community Garden" },
  { id: "g2", name: "Jardim Botafogo" },
];

function Chrome() {
  return (
    <Section
      id="chrome"
      title="AppBar icons and the identity pill"
      lede="The 56px bar carries 40px round icon buttons (each with the 44px finger box, DL-030) and the 36px garden switcher pill. Shell chrome sits outside the DL-011 scale by design."
    >
      <Row>
        <Specimen
          title="AppBar"
          targets={[
            { name: "icon", selector: 'button[data-component="AppBar"]', expect: ADMIN.close() },
            { name: "identity pill", selector: '[data-component="GardenChip"]', expect: ADMIN.identityPill() },
          ]}
          wide
        >
          <div className="storybook-canvas-frame" data-workspace="hub" style={{ width: "100%" }}>
            <AppBar
              gardenChip={
                <GardenChip
                  gardens={GARDENS}
                  selectedGarden={GARDENS[0]}
                  onSelectGarden={() => {}}
                  onCreateGarden={() => {}}
                />
              }
              onOpenSearch={() => {}}
              onOpenSettings={() => {}}
              onOpenNotifications={() => {}}
              onOpenProfile={() => {}}
            />
          </div>
        </Specimen>
      </Row>
      <div className="sb-ds-links" style={{ marginTop: 12 }}>
        <StoryLink id={STORY_LINKS.adminAppBar}>Admin/Shell/AppBar</StoryLink>
        <StoryLink id="design-system-admin-components--dialog-close-button">Dialog close button</StoryLink>
        <StoryLink id="design-system-admin-components--side-sheet-close-button">Side sheet close button</StoryLink>
      </div>
    </Section>
  );
}

/** The whole catalog. Close buttons live in their own stories because a modal covers the page. */
export const Buttons: Story = {
  render: () => (
    <Page
      title="Admin cockpit · Components"
      lede="Every Admin* control with its live geometry, graded against the DL-011 compact metric and Rule 18."
    >
      <ButtonSections />
      <Fields />
      <ChipsTabsChoices />
      <Chrome />
    </Page>
  ),
};

/**
 * AdminDialog's close button: the shared header's 40px circle, with the 44px
 * finger box (DL-030) its `::after` draws from the cockpit's hit token (DL-117).
 */
export const DialogCloseButton: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div style={{ minHeight: 360 }}>
      <AdminDialog
        open
        onOpenChange={() => undefined}
        title="Close button"
        description="The close affordance is the 40px circle on the title's line."
        tone="hub"
        actions={<AdminButton>Done</AdminButton>}
      >
        <Specimen
          title="close"
          targets={[
            {
              name: "close",
              selector: '[data-component="AdminDialog"] [data-slot="close"]',
              inDocument: true,
              expect: ADMIN.close(),
            },
          ]}
        >
          <span style={{ fontSize: 13 }}>Measured from the dialog's own close button.</span>
        </Specimen>
      </AdminDialog>
    </div>
  ),
  play: async () => {
    const dialog = await within(document.body).findByRole("dialog", { name: /close button/i });
    const close = dialog.querySelector<HTMLElement>('[data-slot="close"]');
    await expect(close).not.toBeNull();
    if (!close) return;
    // The dialog enters under a transform; assert once the rect settles.
    await waitFor(async () => {
      await expect(close.getBoundingClientRect().height).toBe(40);
    });
    // A pseudo-element gives the 40px circle a 44px finger box.
    await expect(measureElement(close).hitHeight).toBe(44);
  },
};

/** AdminSideSheet's close button shares the same 40px anatomy. */
export const SideSheetCloseButton: Story = {
  render: () => (
    <div style={{ minHeight: 480 }}>
      <AdminSideSheet open onOpenChange={() => undefined} title="Notifications" tone="hub">
        <Specimen
          title="close"
          targets={[
            {
              name: "close",
              selector: '[data-component="AdminSideSheet"] [data-slot="close"]',
              inDocument: true,
              expect: ADMIN.close(),
            },
          ]}
        >
          <span style={{ fontSize: 13 }}>Measured from the sheet's own close button.</span>
        </Specimen>
      </AdminSideSheet>
    </div>
  ),
};
