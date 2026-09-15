import { RiFileListLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useState } from "react";
import { expect, within } from "storybook/test";
import { AdminButton } from "../../../admin/src/components/AdminButton";
import { AdminSettingRow } from "../../../admin/src/components/AdminSettingRow";
import { AdminSortSelect } from "../../../admin/src/components/AdminSortSelect";
import { AddressDisplay } from "../../src/components/AddressDisplay";
import { Alert } from "../../src/components/Alert";
import { AudioRecorder } from "../../src/components/Audio/AudioRecorder";
import { EmptyStateShell } from "../../src/components/Canvas/EmptyStateShell";
import { DatePicker } from "../../src/components/DatePicker/DatePicker";
import { ImagePreviewDialog } from "../../src/components/Dialog/ImagePreviewDialog";
import { FileUploadField } from "../../src/components/FileUploadField";
import { ConfidenceSelector } from "../../src/components/Form/ConfidenceSelector";
import { Switch } from "../../src/components/Form/ControlPrimitives";
import { EmptyState } from "../../src/components/ListPrimitives";
import { ToastViewport } from "../../src/components/Toast/ToastViewport";
import { toastService } from "../../src/components/Toast/toast.service";
import { AssetSelector } from "../../src/components/Vault/AssetSelector";
import { Confidence } from "../../src/types/domain";
import { STORYBOOK_ADMIN_VAULTS } from "../adminFixtures";
import { FIXTURE_IMAGE_AGROFORESTRY, FIXTURE_IMAGE_SOLAR } from "../fixtures";
import { Page, Row, Section, Specimen, StoryLink } from "./measure";
import { ADMIN } from "./rules";

const meta = {
  title: "Design System/Admin/Shared pieces",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Shared components that render inside the admin cockpit. Every one rides the shared family (Button, IconButton, Chip, and the control classes), and the cockpit sets that family's tokens in its index.css (DL-030): pills, one 14px label, the 28 / 32 / 40 tiers, the 44px finger box, and the responsive field tier. Each specimen is the real component measured live against the cockpit rules.",
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

const ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" as const;

function ToastAction() {
  useEffect(() => {
    const id = toastService.show({
      status: "info",
      title: "Claim your garden name",
      message: "The ENS reminder toast carries a shared tertiary text button as its action.",
      persistent: true,
      action: { label: "Claim Name", onClick: () => undefined, dismissOnClick: false },
    });
    return () => toastService.dismiss(id);
  }, []);
  return <ToastViewport />;
}

/** A shared field's trigger on the cockpit field tier, with its 14px title above. */
const FIELD_TARGETS = (trigger: string) => [
  {
    name: "control",
    selector: trigger,
    expect: { ...ADMIN.fieldContainer(), ...ADMIN.fieldInput() },
  },
  { name: "label", selector: ".gg-field-label", expect: ADMIN.fieldTitle() },
];

function Pieces() {
  const [asset, setAsset] = useState(STORYBOOK_ADMIN_VAULTS[0]?.asset ?? "");
  const [date, setDate] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<Confidence>(Confidence.MEDIUM);
  const [sort, setSort] = useState("recent");
  const [on, setOn] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  return (
    <>
      <Section
        id="actions"
        title="Actions"
        lede="EmptyState takes a ready AdminButton element (Rule 18). Toast actions and the AudioRecorder controls are the shared Button at its sm size, which the cockpit's tokens land on the 32px md pill with a 14px label and a 44px finger box (DL-030)."
      >
        <Row>
          <Specimen title="EmptyState action · AdminButton (Actions workspace)" target="button" expect={ADMIN.button("md")} wide>
            <EmptyStateShell>
              <EmptyState
                icon={<RiFileListLine className="h-6 w-6" />}
                title="No actions yet"
                description="Get started by creating your first action."
                action={<AdminButton onClick={() => undefined}>Create Your First Action</AdminButton>}
              />
            </EmptyStateShell>
          </Specimen>
          <Specimen title="EmptyState action · AdminButton text sm (HubWorkQueue)" target="button" expect={ADMIN.button("sm")} wide>
            <EmptyStateShell>
              <EmptyState
                icon={<RiFileListLine className="h-6 w-6" />}
                title='No submissions matching "compost"'
                action={
                  <AdminButton variant="text" size="sm" onClick={() => undefined}>
                    Clear Search
                  </AdminButton>
                }
              />
            </EmptyStateShell>
          </Specimen>
          <Specimen
            title="toast action · shared tertiary sm"
            targets={[{ name: "action", selector: '.gg-button[data-emphasis="tertiary"]', inDocument: true, expect: ADMIN.sharedButton() }]}
            note="Rendered in the live toast viewport (top of the preview); measured from there."
            wide
          >
            <div style={{ minHeight: 96, position: "relative", width: "100%" }}>
              <ToastAction />
            </div>
          </Specimen>
          <Specimen title="AudioRecorder start · shared secondary sm" target=".gg-button" expect={ADMIN.sharedButton()} wide>
            <AudioRecorder onRecordingComplete={() => undefined} />
          </Specimen>
        </Row>
      </Section>

      <Section
        id="fields"
        title="Fields"
        lede="FileUploadField's upload well and the DatePicker trigger are shared controls on the admin surface: the 8px corner and the responsive field tier (44px with 16px text on touch widths, 40px with 14px text from 640px), with a 14px title above, like a setting-row label (DL-029, DL-030). AdminSortSelect stays the 36px toolbar pill, and the shared Switch takes the M3 track at the cockpit's 32px md height."
      >
        <Row>
          <Specimen title="FileUploadField · upload well" targets={FIELD_TARGETS('[data-component="FileUploadTrigger"]')} wide>
            <div style={{ width: "100%", maxWidth: 420 }}>
              <FileUploadField
                surface="admin"
                label="Attach evidence"
                helpText="PNG, JPG, or WebP."
                accept="image/*"
                onFilesChange={() => undefined}
              />
            </div>
          </Specimen>
          <Specimen title="DatePicker · trigger" targets={FIELD_TARGETS('[data-component="DatePickerTrigger"]')} wide>
            <div style={{ width: "100%", maxWidth: 320 }}>
              <DatePicker
                surface="admin"
                label="Start date"
                placeholder="Choose a date"
                value={date}
                onChange={setDate}
                id="ds-date"
              />
            </div>
          </Specimen>
          <Specimen title="AdminSortSelect · toolbar pill" target='[data-component="AdminSortSelect"]' expect={ADMIN.toolbar()}>
            <AdminSortSelect
              value={sort}
              onChange={setSort}
              options={[
                { value: "recent", label: "Newest" },
                { value: "name", label: "Name" },
              ]}
            />
          </Specimen>
          <Specimen title="Switch in AdminSettingRow · M3 track" target='[role="switch"]' expect={ADMIN.sharedSwitch()} wide>
            <div style={{ width: "100%", maxWidth: 480 }}>
              <AdminSettingRow labelId="ds-shared-open-joining" label="Open joining" description="Anyone can join without approval.">
                <Switch surface="admin" aria-labelledby="ds-shared-open-joining" checked={on} onCheckedChange={setOn} />
              </AdminSettingRow>
            </div>
          </Specimen>
        </Row>
      </Section>

      <Section
        id="chips-and-icons"
        title="Chips and icon buttons"
        lede="AssetSelector and ConfidenceSelector are shared radio chips: 32px capsules with a 44px hit area on every surface. AddressDisplay's copy and Alert's dismiss are the shared compact IconButton, which the cockpit lands on its 28px sm circle."
      >
        <Row>
          <Specimen title="AssetSelector · radio chips" target='[role="radio"]' all expect={ADMIN.sharedChip()} wide>
            <AssetSelector
              vaults={STORYBOOK_ADMIN_VAULTS}
              selectedAsset={asset}
              onSelect={setAsset}
              ariaLabel="Vault asset"
            />
          </Specimen>
          <Specimen title="ConfidenceSelector · radio chips" target='[role="radio"]' all expect={ADMIN.sharedChip()} wide>
            <ConfidenceSelector value={confidence} onChange={setConfidence} />
          </Specimen>
          <Specimen title="AddressDisplay copy · compact icon button" target=".gg-icon-button" expect={ADMIN.iconButton("sm")} wide>
            <AddressDisplay address={ADDRESS} />
          </Specimen>
          <Specimen title="Alert dismiss · compact icon button" target=".gg-icon-button" expect={ADMIN.iconButton("sm")} wide>
            {dismissed ? (
              <button type="button" className="sb-ds-link" onClick={() => setDismissed(false)}>
                Show the alert again
              </button>
            ) : (
              <Alert variant="warning" title="Indexer sync delayed" onDismiss={() => setDismissed(true)}>
                Recent blocks are still processing.
              </Alert>
            )}
          </Specimen>
        </Row>
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id="shared-form-assetselector--default">Shared/Form/AssetSelector</StoryLink>
          <StoryLink id="shared-form-confidenceselector--default">Shared/Form/ConfidenceSelector</StoryLink>
          <StoryLink id="shared-primitives-addressdisplay--default">Shared/Primitives/AddressDisplay</StoryLink>
          <StoryLink id="shared-feedback-alert--info">Shared/Feedback/Alert</StoryLink>
          <StoryLink id="shared-form-fileuploadfield--default">Shared/Form/FileUploadField</StoryLink>
          <StoryLink id="shared-form-datepicker--default">Shared/Form/DatePicker</StoryLink>
          <StoryLink id="shared-display-audiorecorder--default">Shared/Display/AudioRecorder</StoryLink>
          <StoryLink id="design-system-admin-shared-pieces--image-preview-dialog">ImagePreviewDialog</StoryLink>
        </div>
      </Section>
    </>
  );
}

/** Every shared piece the cockpit renders, measured on the cockpit metric. */
export const Pieces_: Story = {
  name: "Pieces",
  tags: ["storybook-ci"],
  render: () => (
    <Page
      title="Admin cockpit · Shared pieces"
      lede="Rule 18 keeps admin views on the Admin* family. Shared components still render inside the cockpit; they ride the shared family, and the cockpit sets that family's tokens, so one primitive update reaches every surface (DL-030)."
    >
      <Pieces />
    </Page>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const px = (value: string) => Number.parseFloat(value);
    const touch = window.innerWidth < 640;

    // Shared sm buttons land on the cockpit's 32px md pill with a 14px / 500 label.
    const start = canvas.getByRole("button", { name: "Start recording audio note" });
    await expect(start.getBoundingClientRect().height).toBe(32);
    await expect(px(getComputedStyle(start).borderTopLeftRadius)).toBeGreaterThanOrEqual(16);
    await expect(getComputedStyle(start).fontSize).toBe("14px");
    await expect(getComputedStyle(start).fontWeight).toBe("500");
    await expect(px(getComputedStyle(start, "::after").height)).toBe(44);

    // Shared field triggers sit on the responsive field tier with the 8px corner.
    const fieldHeight = touch ? 44 : 40;
    for (const selector of ['[data-component="FileUploadTrigger"]', '[data-component="DatePickerTrigger"]']) {
      const trigger = canvasElement.querySelector<HTMLElement>(selector);
      await expect(trigger).not.toBeNull();
      await expect(trigger?.getBoundingClientRect().height).toBe(fieldHeight);
      await expect(px(getComputedStyle(trigger as HTMLElement).borderTopLeftRadius)).toBe(8);
      await expect(getComputedStyle(trigger as HTMLElement).fontSize).toBe(touch ? "16px" : "14px");
    }

    // Radio chips: 32px capsules with the 44px hit area.
    const chips = canvas.getAllByRole("radio");
    await expect(chips.length).toBeGreaterThanOrEqual(4);
    for (const chip of chips) {
      await expect(chip.getBoundingClientRect().height).toBe(32);
      await expect(px(getComputedStyle(chip, "::after").height)).toBe(44);
    }

    // The admin switch takes the M3 track at the 32px md height, with a 44px hit box.
    const toggle = canvas.getByRole("switch", { name: "Open joining" });
    await expect(toggle.getBoundingClientRect().height).toBe(32);
    await expect(toggle.getBoundingClientRect().width).toBe(52);
    await expect(px(getComputedStyle(toggle, "::after").height)).toBe(44);

    // Compact icon buttons land on the cockpit's 28px sm circle.
    const copy = canvas.getByRole("button", { name: "Copy Address" });
    await expect(copy.getBoundingClientRect().height).toBe(28);
    await expect(px(getComputedStyle(copy, "::after").height)).toBe(44);
  },
};

/** ImagePreviewDialog inside admin: its controls are the shared IconButton, on the cockpit's 40px close tier. */
export const ImagePreviewDialog_: Story = {
  name: "ImagePreviewDialog",
  render: () => (
    <div style={{ minHeight: 420 }}>
      <ImagePreviewDialog
        isOpen
        onClose={() => undefined}
        images={[FIXTURE_IMAGE_AGROFORESTRY, FIXTURE_IMAGE_SOLAR]}
        initialIndex={0}
      />
      <Specimen
        title="close button (in the dialog)"
        targets={[
          {
            name: "close",
            selector: '[data-testid="image-preview-close"]',
            inDocument: true,
            expect: ADMIN.close(),
          },
        ]}
      >
        <span style={{ fontSize: 13 }}>The dialog is open above this page; the close is measured from it.</span>
      </Specimen>
    </div>
  ),
};
