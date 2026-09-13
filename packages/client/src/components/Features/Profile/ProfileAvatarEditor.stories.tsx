import { useOnlineStatus } from "@green-goods/shared/hooks/app/useOnlineStatus";
import {
  useProfileAvatarEditor,
  useResolvedProfileAvatar,
} from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, mocked, screen, userEvent, within } from "storybook/test";
import {
  FIXTURE_IMAGE_BANNER,
  FIXTURE_IMAGE_PROFILE,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import { ProfileAvatarEditor } from "./ProfileAvatarEditor";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";

const ACCOUNT = "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e" as Address;
const FALLBACK_AVATAR = FIXTURE_IMAGE_BANNER;

type Editor = ReturnType<typeof useProfileAvatarEditor>;
type Resolved = ReturnType<typeof useResolvedProfileAvatar>;

const DRAFT_FILE = new File(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="160" height="160" fill="#4fb07a"/><circle cx="80" cy="70" r="34" fill="#e4f2e9"/></svg>',
  ],
  "garden-portrait.svg",
  { type: "image/svg+xml" }
);

function editor(overrides: Partial<Editor> = {}): Editor {
  return {
    address: ACCOUNT,
    record: null,
    draft: null,
    stage: "idle" as Editor["stage"],
    error: null,
    isSaving: false,
    save: fn(async () => undefined) as unknown as Editor["save"],
    clear: fn(async () => undefined) as unknown as Editor["clear"],
    continueAfterReconnect: fn(
      async () => undefined
    ) as unknown as Editor["continueAfterReconnect"],
    discardDraft: fn(async () => undefined) as unknown as Editor["discardDraft"],
    refetch: fn(async () => undefined) as unknown as Editor["refetch"],
    ...overrides,
  };
}

function resolved(source: "app" | "fallback"): Resolved {
  return {
    avatarUri: source === "app" ? FIXTURE_IMAGE_PROFILE : FALLBACK_AVATAR,
    source,
    record: null,
    isLoading: false,
    error: null,
  } as Resolved;
}

const savedDraft = {
  chainId: 42161,
  address: ACCOUNT,
  fileData: null,
  action: "set" as const,
  updatedAt: STORYBOOK_NOW_SECONDS * 1000,
  file: DRAFT_FILE,
};

function withAvatar({
  source = "fallback",
  online = true,
  ...overrides
}: Partial<Editor> & { source?: "app" | "fallback"; online?: boolean } = {}) {
  return () => {
    mocked(useProfileAvatarEditor).mockReturnValue(editor(overrides));
    mocked(useResolvedProfileAvatar).mockReturnValue(resolved(source));
    mocked(useOnlineStatus).mockReturnValue(online);
    return resetHookMocks(useProfileAvatarEditor, useResolvedProfileAvatar, useOnlineStatus);
  };
}

async function openSheet(name = "Profile Photo") {
  await userEvent.click(await screen.findByRole("button", { name: "Edit Profile Photo" }));
  return within(await screen.findByRole("dialog", { name }));
}

/**
 * The profile photo sheet. Its bar follows the photo's state (DL-016): Choose Photo when none is
 * set; Replace Photo over an outlined red Remove Photo once one is; a red Remove Photo over Keep Photo
 * to confirm removal; and, when a chosen photo failed to publish, Try Again over Choose a Different
 * Photo with Discard Draft as a red text action. The editor hooks are mocked per story.
 */
const meta: Meta<typeof ProfileAvatarEditor> = {
  title: "Client/Sheets/ProfileAvatarEditor",
  component: ProfileAvatarEditor,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  args: { fallbackAvatar: FALLBACK_AVATAR },
  decorators: [
    (Story) => (
      <div className="flex min-h-[640px] justify-center p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ProfileAvatarEditor>;

export const ChoosePhoto: Story = {
  beforeEach: withAvatar(),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByRole("button", { name: "Choose Photo" })).toBeVisible();
    await expect(sheet.queryByRole("button", { name: "Remove Photo" })).not.toBeInTheDocument();
  },
};

export const PhotoSet: Story = {
  beforeEach: withAvatar({ source: "app" }),
  play: async () => {
    const sheet = await openSheet();
    const replace = sheet.getByRole("button", { name: "Replace Photo" });
    const remove = sheet.getByRole("button", { name: "Remove Photo" });
    await expect(remove).toHaveAttribute("data-emphasis", "secondary");
    await expect(remove).toHaveAttribute("data-tone", "danger");
    await expect(replace.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      remove.getBoundingClientRect().top
    );
  },
};

export const RemoveConfirm: Story = {
  beforeEach: withAvatar({ source: "app" }),
  play: async () => {
    const sheet = await openSheet();
    await userEvent.click(sheet.getByRole("button", { name: "Remove Photo" }));
    const confirm = within(await screen.findByRole("dialog", { name: "Remove profile photo?" }));
    const confirmRemove = confirm.getByRole("button", { name: "Remove Photo" });
    await expect(confirmRemove).toHaveAttribute("data-emphasis", "primary");
    await expect(confirmRemove).toHaveAttribute("data-tone", "danger");
    await expect(confirm.getByRole("button", { name: "Keep Photo" })).toBeVisible();
  },
};

export const Uploading: Story = {
  beforeEach: withAvatar({ isSaving: true, stage: "uploading" as Editor["stage"] }),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByRole("button", { name: "Uploading photo…" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
  },
};

export const DraftToRetry: Story = {
  beforeEach: withAvatar({ draft: savedDraft as Editor["draft"] }),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByText("This draft photo has not been published.")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Try Again" })).toBeEnabled();
    await expect(sheet.getByRole("button", { name: "Choose a Different Photo" })).toBeVisible();
    const discard = sheet.getByRole("button", { name: "Discard Draft" });
    await expect(discard).toHaveAttribute("data-emphasis", "tertiary");
    await expect(discard).toHaveAttribute("data-tone", "danger");
  },
};

export const DraftWhileOffline: Story = {
  beforeEach: withAvatar({ draft: savedDraft as Editor["draft"], online: false }),
  play: async () => {
    const sheet = await openSheet();
    await expect(sheet.getByRole("button", { name: "Reconnect to publish" })).toBeDisabled();
  },
};
