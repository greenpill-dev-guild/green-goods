import { DEFAULT_CHAIN_ID, queryKeys } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_STEWARD_ADDRESS,
} from "../../../../shared/.storybook/adminFixtures";
import { withAdminIdentity, withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import { AccountProfileAvatarEditor } from "./AccountProfileAvatarEditor";

const PROFILE_AVATAR_URI = "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzd";
const PROFILE_AVATAR = {
  address: STORYBOOK_STEWARD_ADDRESS,
  avatarUri: PROFILE_AVATAR_URI,
  chainId: DEFAULT_CHAIN_ID,
  updatedAt: "2026-07-29T00:00:00.000Z",
  version: 1,
};

const meta: Meta<typeof AccountProfileAvatarEditor> = {
  title: "Admin/Shell/AccountProfileAvatarEditor",
  component: AccountProfileAvatarEditor,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="m-4 inline-flex rounded-[var(--radius-lg)] border border-stroke-soft bg-[var(--color-material-solid)] p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    fallbackInitials: "GG",
  },
  parameters: {
    docs: {
      description: {
        component:
          "The shared account-avatar interaction used by the desktop Profile inspector and the mobile Account route. The focused editor is a standard medium AdminDialog with native image selection, published-pointer replacement, removal, and offline draft recovery.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AccountProfileAvatarEditor>;

export const PublishedAvatar: Story = {
  tags: ["storybook-ci"],
  decorators: [
    withSeededQueryClient([
      ...STORYBOOK_ADMIN_SHELL_SEEDS,
      [
        queryKeys.profileAvatars.record(DEFAULT_CHAIN_ID, STORYBOOK_STEWARD_ADDRESS),
        PROFILE_AVATAR,
      ],
    ]),
  ],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = await canvas.findByRole("button", { name: "Edit profile photo" });
    await expect(trigger).toBeVisible();
    await userEvent.click(trigger);

    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Edit profile photo" });
    await waitFor(() => expect(dialog).toBeVisible());
    await waitFor(() => expect(body.getByRole("button", { name: "Remove photo" })).toBeVisible());
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(body.queryByRole("dialog", { name: "Edit profile photo" })).not.toBeInTheDocument()
    );
  },
};

export const InitialsFallback: Story = {
  decorators: [withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS)],
  args: {
    fallbackInitials: "AR",
  },
  parameters: {
    docs: {
      description: {
        story:
          "The local initials fallback remains visible when neither app nor ENS provides an avatar.",
      },
    },
  },
};
