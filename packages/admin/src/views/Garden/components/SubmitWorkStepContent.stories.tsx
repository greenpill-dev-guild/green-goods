import { Capital, Domain, type Action, type SubmitWorkController } from "@green-goods/shared";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withAdminPrimitiveFrame, withI18n } from "../../../../../shared/.storybook/decorators";
import { SubmitWorkStepContent } from "./SubmitWorkStepContent";

const ACTION: Action = {
  id: "42161-1",
  slug: "agro.canopy-baseline",
  title: "Canopy baseline",
  startTime: 0,
  endTime: 0,
  instructions: "Document the current canopy condition.",
  capitals: [Capital.LIVING],
  media: [],
  domain: Domain.AGRO,
  createdAt: 0,
  description: "Record canopy health before field work begins.",
  inputs: [],
  mediaInfo: { title: "Field photos", required: true, minImageCount: 1, maxImageCount: 3 },
};

const ACTION_STEP_CONTROLLER = {
  activeStepId: "action",
  availableActions: [ACTION],
  busy: false,
  chooserDomains: [Domain.AGRO],
  effectiveDomain: Domain.AGRO,
  form: {
    control: undefined,
    formState: { errors: {} },
    getValues: () => ({}),
    register: fn(),
  },
  goToStep: fn(),
  handleFilesChange: fn(),
  handleSelectAction: fn(),
  images: [],
  mediaFeedback: null,
  removeImage: fn(),
  selectDomain: fn(),
  selectedAction: null,
  selectedActionId: "",
  visibleActions: [ACTION],
} as unknown as SubmitWorkController;

const meta = {
  title: "Admin/Workflows/Garden/SubmitWorkStepContent",
  component: SubmitWorkStepContent,
  tags: ["autodocs"],
  decorators: [withI18n, withAdminPrimitiveFrame],
  args: {
    controller: ACTION_STEP_CONTROLLER,
    photoRequirementText: "1 photo required",
  },
} satisfies Meta<typeof SubmitWorkStepContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ChooseAction: Story = {};
