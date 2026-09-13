import type { CommitmentRequirementRecord } from "@green-goods/shared/commitment-pooling";
import type { Action, Address, Work } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, screen, userEvent, within } from "storybook/test";
import { LinkWorkSheet } from "./LinkWorkSheet";

const CHAIN_ID = 42161;
const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const GARDENER = "0x1111111111111111111111111111111111111111" as Address;

function action(uid: number, title: string): Action {
  return {
    id: `${CHAIN_ID}-${uid}`,
    slug: title.toLowerCase().replace(/\s+/g, "-"),
    startTime: 1_767_225_600,
    endTime: 1_798_761_600,
    title,
    capitals: [],
    media: [],
    domain: null,
    createdAt: 1_767_225_600,
    description: "",
    inputs: [],
  };
}

function work(id: string, actionUID: number, status: Work["status"], createdAt: number): Work {
  return {
    id,
    title: "Work",
    actionUID,
    gardenerAddress: GARDENER,
    gardenAddress: GARDEN,
    feedback: "",
    metadata: "",
    media: [],
    createdAt,
    status,
  };
}

function row(
  requirementIndex: number,
  actionUID: number,
  approvedCount: number
): CommitmentRequirementRecord {
  return {
    id: `r${requirementIndex}`,
    chainId: CHAIN_ID,
    commitmentId: 7n,
    requirementIndex,
    creationSeen: true,
    domain: null,
    actionUID: BigInt(actionUID),
    requiredCount: 2,
    approvedCount,
    createdAt: 0,
    updatedAt: 0,
  };
}

const ACTIONS = [action(44, "Planting Event"), action(45, "Survival Check")];
const WORKS = [
  work("0xwork-planting", 44, "approved", 1_768_089_600_000),
  work("0xwork-survival", 45, "pending", 1_768_348_800_000),
];

/**
 * Linking the reader's own work in this garden to a commitment row. Link This Work stays disabled
 * until a work and its row are chosen; with no eligible work, each row offers to start a submission.
 * Actions sit in the shared bar at the Tall tier (DL-016).
 */
const meta: Meta<typeof LinkWorkSheet> = {
  title: "Client/Commitments/LinkWorkSheet",
  component: LinkWorkSheet,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: {
    open: true,
    onOpenChange: fn(),
    works: WORKS,
    requirements: [row(0, 44, 1), row(1, 45, 0)],
    actions: ACTIONS,
    chainId: CHAIN_ID,
    preselected: null,
    isPending: false,
    onSubmitRequirement: fn(),
    onConfirm: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof LinkWorkSheet>;

export const ChooseWork: Story = {
  play: async ({ args }) => {
    const link = await screen.findByRole("button", { name: "Link This Work" });
    await expect(link).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: /Planting Event/ }));
    await expect(screen.getByText("It counts toward Planting Event.")).toBeVisible();
    await userEvent.click(link);
    await expect(args.onConfirm).toHaveBeenCalledWith("0xwork-planting", 0, expect.any(String));
  },
};

export const ChooseRow: Story = {
  args: { requirements: [row(0, 44, 1), row(1, 44, 2)] },
  play: async () => {
    await userEvent.click(await screen.findByRole("radio", { name: /Planting Event/ }));
    const rowSelect = screen.getByRole("combobox", { name: "Which row it fulfils" });
    await expect(screen.getByRole("button", { name: "Link This Work" })).toBeDisabled();
    await userEvent.selectOptions(rowSelect, "1");
    await expect(screen.getByRole("button", { name: "Link This Work" })).toBeEnabled();
  },
};

export const NoWorkYet: Story = {
  args: { works: [] },
  play: async ({ args }) => {
    await expect(
      await screen.findByText(
        "You have no work in this garden to link yet. Submit work from the Garden tab first."
      )
    ).toBeVisible();
    const rows = within(screen.getByRole("list", { name: "Commitment requirements" }));
    await userEvent.click(rows.getByRole("button", { name: "Submit work for requirement 2" }));
    await expect(args.onSubmitRequirement).toHaveBeenCalledOnce();
    await expect(screen.getByRole("button", { name: "Link This Work" })).toBeDisabled();
  },
};

export const Linking: Story = {
  args: { preselected: { workUID: "0xwork-planting", requirementIndex: 0 }, isPending: true },
  play: async () => {
    await expect(await screen.findByRole("button", { name: "Link This Work" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
    await expect(screen.getByRole("button", { name: "Not Now" })).toBeDisabled();
  },
};
