import type { SubmitWorkController } from "@green-goods/shared/hooks/admin-ui/garden/useSubmitWorkController";
import { type Action, Capital, Domain } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withAdminPrimitiveFrame, withI18n } from "../../../../../shared/.storybook/decorators";
import { stagedWorkPhotos } from "../../../../../shared/.storybook/workPhotoFixtures";
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

const TWO_PHOTO_ACTION: Action = {
  ...ACTION,
  mediaInfo: { title: "Field photos", required: true, minImageCount: 2, maxImageCount: 6 },
};

/**
 * The media step over a staged list the story owns, so adding and removing
 * photos moves the count as it does in the flow.
 */
function MediaStep({ staged }: { staged: File[] }) {
  const [images, setImages] = useState(staged);
  const controller = {
    ...ACTION_STEP_CONTROLLER,
    activeStepId: "media",
    selectedAction: TWO_PHOTO_ACTION,
    selectedActionId: TWO_PHOTO_ACTION.id,
    images,
    handleFilesChange: (files: File[]) => setImages((current) => [...current, ...files]),
    removeImage: (index: number) =>
      setImages((current) => current.filter((_, item) => item !== index)),
  } as unknown as SubmitWorkController;

  return <SubmitWorkStepContent controller={controller} photoRequirementText="2 photos required" />;
}

/** Two photos required, none staged: the count sits under the upload well in amber. */
export const MediaNoPhotos: Story = {
  render: () => <MediaStep staged={[]} />,
};

/** One of two: the photo is a tile, and the count says one more is needed. */
export const MediaBelowRequirement: Story = {
  render: () => <MediaStep staged={stagedWorkPhotos(1)} />,
};

/** Three against two: the count turns green and the tiles fill the row. */
export const MediaRequirementMet: Story = {
  render: () => <MediaStep staged={stagedWorkPhotos(3)} />,
};

/** A tile opened in the shared image preview, on the photo that was pressed. */
export const MediaPreviewOpen: Story = {
  render: () => <MediaStep staged={stagedWorkPhotos(3)} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole("button", { name: "Preview east-bed-after.jpg" })
    );
    const dialog = await within(canvasElement.ownerDocument.body).findByRole("dialog", {
      name: "Image preview",
    });
    await expect(within(dialog).getByText("2 / 3")).toBeVisible();
  },
};
