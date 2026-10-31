import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { useIntl } from "react-intl";
import { expect, within } from "storybook/test";
import { withAdminIdentity, withDataRouter } from "../../../../../shared/.storybook/decorators";
import {
  buildGardenSettingsSaveRows,
  type GardenSettingsSaveRun,
  gardenSettingsSaveLine,
} from "@/components/Garden/gardenSettingsSave";
import { TxProgressList } from "@/components/TxProgressList";
import { EditGardenDialog, type EditGardenDialogProps } from "./EditGardenDialog";

const GARDEN_ADDRESS = "0x1234567890123456789012345678901234567890" as Address;

const GARDEN = {
  id: GARDEN_ADDRESS,
  tokenAddress: GARDEN_ADDRESS,
  tokenID: "12",
  chainId: 42161,
  name: "Rio Rainforest Lab",
  description: "Community-driven restoration in the Atlantic Forest biome.",
  location: "Rio de Janeiro, Brazil",
  bannerImage: "",
  domainMask: 3,
  openJoining: true,
  maxGardeners: 0,
} as unknown as EditGardenDialogProps["garden"];

const HASH = `0x${"3f".repeat(32)}` as const;
const FIELDS = ["name", "description", "location"] as const;

/**
 * What Edit Garden shows once Save is pressed: the footer line and one row per
 * changed field, built by the same functions the dialog uses.
 */
function SaveProgress({
  run,
  pendingCount,
  oneSignature,
}: {
  run: GardenSettingsSaveRun | null;
  pendingCount: number;
  oneSignature?: boolean;
}) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-3">
      {run ? (
        <TxProgressList
          chainId={42161}
          label={formatMessage({ id: "app.garden.settings.save.listLabel" })}
          rows={buildGardenSettingsSaveRows(run, formatMessage)}
        />
      ) : null}
      <p className="type-meta text-text-sub" data-slot="dirty-state">
        {gardenSettingsSaveLine(run, pendingCount, formatMessage, oneSignature)}
      </p>
    </div>
  );
}

const meta: Meta<typeof EditGardenDialog> = {
  title: "Admin/Workflows/Garden/EditGardenDialog",
  component: EditGardenDialog,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    // The dirty-close guard blocks navigation through `useBlocker`, which only
    // a data router provides.
    withDataRouter("/garden/settings"),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Edit Garden, named for the workspace action that opens it. The form owns the draft and the save; the dialog owns the close guard, the identity preview, and the pinned footer. The footer says how many signatures a save takes before it starts: one per field, or one for all of them where the rail can batch. Once it starts, the rows show each one landing, a stop names what happened, and Try Again sends only what is left (frontend-design Rule 20). A save whose outcome is unknown stays at the top with what the chain holds until it is settled. The save states below compose the same row builder and footer line the dialog uses, since the mutations are inert against the Storybook mock transport.",
      },
    },
  },
  args: {
    open: true,
    onClose: () => undefined,
    garden: GARDEN,
    canManage: true,
    isOwner: true,
  },
};

export default meta;
type Story = StoryObj<typeof EditGardenDialog>;
type SaveStory = StoryObj<typeof SaveProgress>;

export const OwnerEditing: Story = {};

/** A garden whose account caps gardeners opens with Limit gardeners on and the cap filled in. */
export const CappedGarden: Story = {
  args: { garden: { ...GARDEN, maxGardeners: 25 } },
};

/** A steward who is not the owner reads why the name is locked. */
export const StewardNotOwner: Story = {
  args: { isOwner: false },
  play: async () => {
    const dialog = within(document.body);
    await expect(
      await dialog.findByText("Only the garden owner can rename the garden.")
    ).toBeVisible();
  },
};

/** The name landed; the wallet is asking about the description. */
export const Saving: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: {
    pendingCount: 3,
    run: {
      status: "running",
      fields: FIELDS,
      progress: {
        name: { state: "saved", hash: HASH },
        description: { state: "waiting", hash: null },
        location: { state: "queued", hash: null },
      },
    },
  },
};

/** The description was declined: the name stays saved and the rest wait for Try Again. */
export const Stopped: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: {
    pendingCount: 2,
    run: {
      status: "stopped",
      fields: FIELDS,
      progress: {
        name: { state: "saved", hash: HASH },
        description: { state: "failed", hash: null },
        location: { state: "queued", hash: null },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Stopped at Description. 1 of 3 saved. Your other edits are still here.")
    ).toBeVisible();
  },
};

/** A new banner uploads before the wallet is asked. */
export const UploadingBanner: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: {
    pendingCount: 1,
    run: {
      status: "running",
      fields: ["banner"],
      progress: { banner: { state: "uploading", hash: null } },
    },
  },
};

export const SaveDone: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: {
    pendingCount: 0,
    run: {
      status: "complete",
      fields: FIELDS,
      progress: {
        name: { state: "saved", hash: HASH },
        description: { state: "saved", hash: HASH },
        location: { state: "saved", hash: HASH },
      },
    },
  },
};

const TOGETHER = (state: "queued" | "waiting" | "saved" | "failed" | "unconfirmed") => ({
  name: { state, hash: state === "saved" ? HASH : null },
  description: { state, hash: state === "saved" ? HASH : null },
  location: { state, hash: state === "saved" ? HASH : null },
});

/** Before Save: the footer promises one signature for all of them. */
export const OneSignaturePlan: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: { pendingCount: 3, oneSignature: true, run: null },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("3 changes · 1 signature")).toBeVisible();
  },
};

/** One signature covers every field, so the rows share one number and move together. */
export const WaitingForOneSignature: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: {
    pendingCount: 3,
    run: {
      status: "running",
      fields: FIELDS,
      oneSignature: true,
      progress: TOGETHER("waiting"),
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText("Waiting for your signature")).toHaveLength(3);
  },
};

export const SavedWithOneSignature: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: {
    pendingCount: 0,
    run: { status: "complete", fields: FIELDS, oneSignature: true, progress: TOGETHER("saved") },
  },
};

/** A declined or reverted batch saves nothing, and the draft stays for Try Again. */
export const OneSignatureDeclined: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: {
    pendingCount: 3,
    run: { status: "stopped", fields: FIELDS, oneSignature: true, progress: TOGETHER("failed") },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Nothing was saved. Your edits are still here.")).toBeVisible();
  },
};

/** The send may have landed: the rows say so, and it is not sent again. */
export const SaveNotConfirmed: SaveStory = {
  render: (args) => <SaveProgress {...args} />,
  args: {
    pendingCount: 0,
    run: {
      status: "unconfirmed",
      fields: FIELDS,
      oneSignature: true,
      progress: TOGETHER("unconfirmed"),
    },
  },
};
