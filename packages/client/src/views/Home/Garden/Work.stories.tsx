import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useWorkDetailController } from "@green-goods/shared/hooks/client-ui/work/useWorkDetailController";
import { useQueuedWorkActions } from "@green-goods/shared/hooks/work/useQueuedWorkActions";
import { useWorkUploads } from "@green-goods/shared/hooks/work/useWorkUploads";
import { Confidence } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { fn, mocked } from "storybook/test";
import { withAppPage, withRouter } from "../../../../../shared/.storybook/decorators";
import {
  JOURNEY_GARDEN,
  JOURNEY_GARDEN_RECORD,
  JOURNEY_NEIGHBOUR,
  JOURNEY_VIEWER,
} from "../../../../../shared/.storybook/clientJourneyFixtures";
import { hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { resetHookMocks } from "../../../../../shared/.storybook/moduleMocks";
import { DOCUMENTATION_SUBMISSION } from "../../../../../shared/.storybook/submitWorkFixtures";
import { GardenWork } from "./Work";

/** Render the real phone review page; all write callbacks are inert story mocks. */
const onReview = (feedbackMode: "approve" | null) => () => {
  const workMetadata = {
    schemaVersion: "work_metadata_v2" as const,
    actionSlug: DOCUMENTATION_SUBMISSION.action.slug,
    timeSpentMinutes: DOCUMENTATION_SUBMISSION.timeSpentMinutes,
    details: DOCUMENTATION_SUBMISSION.values,
  };
  mocked(useUser).mockReturnValue({
    user: { id: JOURNEY_NEIGHBOUR },
  } as unknown as ReturnType<typeof useUser>);
  mocked(useWorkDetailController).mockReturnValue({
    actionTitle: DOCUMENTATION_SUBMISSION.action.title,
    back: fn(),
    canViewAttestation: false,
    chainId: 42161,
    confidence: Confidence.MEDIUM,
    effectiveStatus: "pending",
    feedbackMode,
    garden: JOURNEY_GARDEN_RECORD,
    gardenId: JOURNEY_GARDEN,
    gardensLoading: false,
    handleApprovePress: fn(),
    handleRejectPress: fn(),
    handleCancelFeedback: fn(),
    handleSubmitApproval: fn(),
    inlineFeedback: "The count and note match the evidence checked at the garden.",
    isActionExpired: false,
    isOfflineWork: false,
    isOnline: true,
    isRetrying: false,
    metadataError: null,
    metadataStatus: "success",
    onChainWorkId: null,
    retry: fn(),
    retryMetadata: fn(),
    retryWorkLoad: fn(),
    downloadData: fn(),
    downloadMedia: fn(),
    share: fn(),
    viewAttestation: fn(),
    setInlineFeedback: fn(),
    setConfidence: fn(),
    viewingMode: "steward",
    work: {
      id: "documentation-work",
      title: DOCUMENTATION_SUBMISSION.action.title,
      actionUID: 5,
      gardenAddress: JOURNEY_GARDEN,
      gardenerAddress: JOURNEY_VIEWER,
      feedback: DOCUMENTATION_SUBMISSION.note,
      metadata: JSON.stringify(workMetadata),
      media: [DOCUMENTATION_SUBMISSION.photo],
      createdAt: hoursAgo(5),
      status: "pending",
    },
    workApprovalMutation: { isPending: false },
    workLoading: false,
    workLoadError: false,
    workMetadata,
  } as unknown as ReturnType<typeof useWorkDetailController>);
  mocked(useQueuedWorkActions).mockReturnValue({
    tryAgain: fn(async () => undefined),
    discard: fn(async () => false),
    isTryingAgain: false,
    isDiscarding: false,
  });
  mocked(useWorkUploads).mockReturnValue({
    decisionFor: () => undefined,
    pausedForDataSaver: false,
    isUploading: false,
    waitingDecisionWorkIds: new Set(),
  } as unknown as ReturnType<typeof useWorkUploads>);
  return resetHookMocks(useUser, useWorkDetailController, useQueuedWorkActions, useWorkUploads);
};

const meta: Meta<typeof GardenWork> = {
  title: "Client/Work/ReviewWork",
  component: GardenWork,
  parameters: { layout: "fullscreen" },
  decorators: [withRouter([`/home/${JOURNEY_GARDEN}/work/documentation-work`]), withAppPage],
};
export default meta;
type Story = StoryObj<typeof GardenWork>;

export const EvaluateExample: Story = { beforeEach: onReview(null) };
export const FeedbackExample: Story = { beforeEach: onReview("approve") };
