import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import {
  campaignCookieJarCreateFormProps,
  campaignCookieJarStoryDecorators,
} from "./CampaignCookieJar.stories.fixtures";
import {
  CampaignCreateFooter,
  CampaignCreateStepBody,
  campaignCreateSteps,
} from "./CampaignCookieJarCreateSteps";

const steps = campaignCreateSteps(campaignCookieJarCreateFormProps.formatMessage);

function StepPreview({ stepIndex }: { stepIndex: number }) {
  const step = steps[stepIndex];
  if (!step) return null;
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <CampaignCreateStepBody step={step} form={campaignCookieJarCreateFormProps} />
      <CampaignCreateFooter
        formatMessage={campaignCookieJarCreateFormProps.formatMessage}
        isFirstStep={stepIndex === 0}
        isLastStep={stepIndex === steps.length - 1}
        pending={false}
        canCreate={campaignCookieJarCreateFormProps.canCreate}
        onCancel={fn()}
        onBack={fn()}
        onNext={fn()}
        onCreate={fn()}
      />
    </div>
  );
}

const meta = {
  title: "Admin/Workflows/Community/Payouts/CampaignCookieJar/CreateSteps",
  component: StepPreview,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Each step of Create Cookie Jar under its header, with the flow's footer: Cancel or Back, then Next or Create Cookie Jar.",
      },
    },
  },
  decorators: campaignCookieJarStoryDecorators,
  args: { stepIndex: 0 },
} satisfies Meta<typeof StepPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Campaign: Story = {};
export const Payout: Story = { args: { stepIndex: 1 } };
export const EligibleGardens: Story = { args: { stepIndex: 2 } };
export const Review: Story = { args: { stepIndex: 3 } };
