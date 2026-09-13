import { useOffline } from "@green-goods/shared/hooks/app/useOffline";
import { usePrimaryAddress } from "@green-goods/shared/hooks/auth/usePrimaryAddress";
import { useActions, useGardens } from "@green-goods/shared/hooks/blockchain/useBaseLists";
import { useCommitmentCycleNames } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentCycleNames";
import { useCommitmentJobs } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentJobs";
import {
  useCommitmentCycles,
  useCommitmentPools,
} from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useHasRole } from "@green-goods/shared/hooks/roles/useHasRole";
import {
  commitmentComposerDraftKey,
  useCommitmentComposerDraftStore,
} from "@green-goods/shared/stores/useCommitmentComposerDraftStore";
import type { Address } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { expect, fn, mocked, screen, userEvent, waitFor, within } from "storybook/test";
import { STORYBOOK_NOW_SECONDS } from "../../../../../../shared/.storybook/fixtures";
import { ComposeCommitment } from "./ComposeCommitment";
import { resetHookMocks } from "../../../../../../shared/.storybook/moduleMocks";

const CHAIN_ID = 42161;
const GARDEN = "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address;
const VIEWER = "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address;
const DRAFT_KEY = commitmentComposerDraftKey({
  chainId: CHAIN_ID,
  viewer: VIEWER,
  garden: GARDEN,
  direction: "OFFER",
});

function withSavedDraft(title: string) {
  return () => {
    mocked(useOffline).mockReturnValue({ isOnline: true } as ReturnType<typeof useOffline>);
    mocked(usePrimaryAddress).mockReturnValue(VIEWER);
    mocked(useActions).mockReturnValue({ data: [] } as unknown as ReturnType<typeof useActions>);
    mocked(useGardens).mockReturnValue({
      data: [{ id: GARDEN, name: "Green Goods Community Garden" }],
    } as unknown as ReturnType<typeof useGardens>);
    mocked(useCommitmentPools).mockReturnValue({
      pools: [{ poolId: 1n, state: "OPEN", poolType: "GARDEN" }],
    } as unknown as ReturnType<typeof useCommitmentPools>);
    mocked(useCommitmentCycles).mockReturnValue({ cycles: [] } as unknown as ReturnType<
      typeof useCommitmentCycles
    >);
    mocked(useCommitmentCycleNames).mockReturnValue({ byCycleId: {} } as unknown as ReturnType<
      typeof useCommitmentCycleNames
    >);
    mocked(useCommitmentJobs).mockReturnValue({
      isPending: false,
      enqueue: fn(),
    } as unknown as ReturnType<typeof useCommitmentJobs>);
    mocked(useHasRole).mockReturnValue({ hasRole: true, isLoading: false, error: null });
    useCommitmentComposerDraftStore.setState({
      drafts: {
        [DRAFT_KEY]: {
          values: { title, direction: "OFFER" },
          clientCommitmentId: "story-draft",
          updatedAt: (STORYBOOK_NOW_SECONDS - 45 * 60) * 1000,
        },
      },
    });
    const resetHooks = resetHookMocks(
      useOffline,
      usePrimaryAddress,
      useActions,
      useGardens,
      useCommitmentPools,
      useCommitmentCycles,
      useCommitmentCycleNames,
      useCommitmentJobs,
      useHasRole
    );
    return () => {
      resetHooks();
      useCommitmentComposerDraftStore.setState({ drafts: {} });
    };
  };
}

/**
 * Reopening the offer composer with a draft saved on this device. The prompt names the draft and
 * stacks Resume Draft over Start Fresh in the shared bar (DL-016). The real composer controller runs;
 * its pool, garden, and role reads are mocked, and the saved draft is seeded in the draft store.
 */
const meta: Meta<typeof ComposeCommitment> = {
  title: "Client/Commitments/ComposeCommitment",
  component: ComposeCommitment,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={[`/home/${GARDEN}/commitments/new?direction=offer`]}>
        <Routes>
          <Route path="/home/:id/commitments/new" element={<Story />} />
        </Routes>
      </MemoryRouter>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ComposeCommitment>;

export const ResumeDraft: Story = {
  beforeEach: withSavedDraft("Ride to the market"),
  play: async () => {
    const prompt = within(await screen.findByRole("dialog", { name: "Resume Your Draft?" }));
    await expect(prompt.getByText("Saved on this device 45 minutes ago.")).toBeVisible();
    await expect(prompt.getByText("Ride to the market")).toBeVisible();
    const resume = prompt.getByRole("button", { name: "Resume Draft" });
    await expect(resume.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      prompt.getByRole("button", { name: "Start Fresh" }).getBoundingClientRect().top
    );
  },
};

export const StartFresh: Story = {
  beforeEach: withSavedDraft(
    "Weekly compost pickup for the school garden and the two neighbouring plots"
  ),
  play: async () => {
    const prompt = within(await screen.findByRole("dialog", { name: "Resume Your Draft?" }));
    await userEvent.click(prompt.getByRole("button", { name: "Start Fresh" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Resume Your Draft?" })).not.toBeInTheDocument()
    );
    await expect(useCommitmentComposerDraftStore.getState().drafts[DRAFT_KEY]).toBeUndefined();
  },
};
