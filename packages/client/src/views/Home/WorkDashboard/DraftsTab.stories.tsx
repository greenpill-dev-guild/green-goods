import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import {
  type DraftWithImages,
  useDraftThumbnail,
  useDrafts,
} from "@green-goods/shared/hooks/work/useDrafts";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { expect, fn, mocked, screen, userEvent, within } from "storybook/test";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  STORYBOOK_NOW_SECONDS,
} from "../../../../../shared/.storybook/fixtures";
import { DraftsTab } from "./Drafts";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";

const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const ACCOUNT = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;

function draft(id: string, overrides: Partial<DraftWithImages> = {}): DraftWithImages {
  const updatedAt = (STORYBOOK_NOW_SECONDS - 2 * 3600) * 1000;
  return {
    id,
    userAddress: ACCOUNT,
    chainId: DEFAULT_CHAIN_ID,
    gardenAddress: GARDEN,
    actionUID: 44,
    feedback: "Planted twelve seedlings along the swale.",
    currentStep: "details",
    firstIncompleteStep: "details",
    createdAt: updatedAt,
    updatedAt,
    images: [],
    thumbnailUrl: FIXTURE_IMAGE_AGROFORESTRY,
    ...overrides,
  };
}

type Drafts = ReturnType<typeof useDrafts>;

function withDrafts({ isDeleting = false } = {}) {
  return () => {
    mocked(useDrafts).mockReturnValue({
      drafts: [draft("draft-1"), draft("draft-2", { actionUID: 45, currentStep: "media" })],
      isLoading: false,
      deleteDraft: fn(async () => undefined),
      isDeleting,
      refetchDrafts: fn(),
    } as unknown as Drafts);
    mocked(useDraftThumbnail).mockReturnValue({
      ref: fn(),
      url: FIXTURE_IMAGE_AGROFORESTRY,
    } as unknown as ReturnType<typeof useDraftThumbnail>);
    mocked(useActions).mockReturnValue({
      data: [
        { id: `${DEFAULT_CHAIN_ID}-44`, title: "Planting Event" },
        { id: `${DEFAULT_CHAIN_ID}-45`, title: "Survival Check" },
      ],
    } as unknown as ReturnType<typeof useActions>);
    mocked(useGardens).mockReturnValue({
      data: [{ id: GARDEN, name: "Green Goods Community Garden" }],
    } as unknown as ReturnType<typeof useGardens>);
    return resetHookMocks(useDrafts, useDraftThumbnail, useActions, useGardens);
  };
}

/**
 * Saved work drafts in Your work. Deleting one asks first: a red Delete stacks over an outlined
 * Cancel in the shared bar (DL-016). Draft storage and the action and garden lists are mocked.
 */
const meta: Meta<typeof DraftsTab> = {
  title: "Client/Work/DraftsTab",
  component: DraftsTab,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="min-h-[720px] bg-bg-white-0">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof DraftsTab>;

export const DraftList: Story = {
  beforeEach: withDrafts(),
  play: async () => {
    await expect(await screen.findByText("2 draft(s)")).toBeVisible();
    await expect(screen.getAllByRole("button", { name: "Delete Draft" })).toHaveLength(2);
  },
};

export const DeleteConfirm: Story = {
  beforeEach: withDrafts(),
  play: async () => {
    await userEvent.click((await screen.findAllByRole("button", { name: "Delete Draft" }))[0]);
    const confirm = within(await screen.findByRole("alertdialog", { name: "Delete Draft?" }));
    const remove = confirm.getByRole("button", { name: "Delete" });
    await expect(remove).toHaveAttribute("data-tone", "danger");
    await expect(remove.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      confirm.getByRole("button", { name: "Cancel" }).getBoundingClientRect().top
    );
  },
};

export const Deleting: Story = {
  beforeEach: withDrafts({ isDeleting: true }),
  play: async () => {
    await userEvent.click((await screen.findAllByRole("button", { name: "Delete Draft" }))[0]);
    const confirm = within(await screen.findByRole("alertdialog", { name: "Delete Draft?" }));
    await expect(confirm.getByRole("button", { name: "Delete" })).toHaveAttribute(
      "aria-busy",
      "true"
    );
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeDisabled();
  },
};
