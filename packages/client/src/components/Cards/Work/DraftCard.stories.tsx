import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import type { Address, DraftWithImages } from "@green-goods/shared";
import { DraftCard } from "./DraftCard";

const now = Date.now();

function makeDraft(overrides: Partial<DraftWithImages> = {}): DraftWithImages {
  return {
    id: "draft-1",
    userAddress: "0xabcdef1234567890abcdef1234567890abcdef12" as Address,
    chainId: 11155111,
    gardenAddress: "0x1234567890abcdef1234567890abcdef12345678" as Address,
    actionUID: 1,
    feedback: "Looking good so far",
    timeSpentMinutes: 45,
    currentStep: "media",
    firstIncompleteStep: "media",
    createdAt: now - 86400000,
    updatedAt: now - 3600000,
    images: [],
    thumbnailUrl: null,
    ...overrides,
  };
}

const draftNoImages = makeDraft();

const draftWithImages = makeDraft({
  id: "draft-2",
  firstIncompleteStep: "details",
  currentStep: "details",
  images: [
    { id: "img-1", file: new File([""], "photo1.jpg"), url: "/placeholder-tree.jpg" },
    { id: "img-2", file: new File([""], "photo2.jpg"), url: "/placeholder-tree.jpg" },
    { id: "img-3", file: new File([""], "photo3.jpg"), url: "/placeholder-tree.jpg" },
  ],
  thumbnailUrl: "/placeholder-tree.jpg",
});

const draftReviewStep = makeDraft({
  id: "draft-3",
  firstIncompleteStep: "review",
  currentStep: "review",
  images: [{ id: "img-1", file: new File([""], "photo1.jpg"), url: "/placeholder-tree.jpg" }],
  thumbnailUrl: "/placeholder-tree.jpg",
  updatedAt: now - 60000,
});

const draftIntroStep = makeDraft({
  id: "draft-4",
  firstIncompleteStep: "intro",
  currentStep: "intro",
  gardenAddress: null,
  actionUID: null,
  feedback: "",
  updatedAt: now - 86400000 * 3,
});

const meta: Meta<typeof DraftCard> = {
  title: "Client/Cards/DraftCard",
  component: DraftCard,
  tags: ["autodocs"],
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
  argTypes: {
    draft: {
      control: "object",
      description: "Draft record with images array and thumbnail URL",
    },
    actionTitle: {
      control: "text",
      description: "Title of the action this draft belongs to. Falls back to 'Untitled Draft'.",
    },
    gardenName: {
      control: "text",
      description: "Name of the garden. Shown as subtitle prefix with a dot separator.",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the root button element",
    },
    onResume: {
      description: "Callback when the card body is clicked to resume editing the draft",
    },
    onDelete: {
      description: "Callback when the delete button is clicked (event propagation is stopped)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DraftCard>;

export const Default: Story = {
  args: {
    draft: draftWithImages,
    actionTitle: "Plant Native Trees",
    gardenName: "Riverside Commons",
    onResume: () => {},
    onDelete: () => {},
  },
};

export const NoImages: Story = {
  args: {
    draft: draftNoImages,
    actionTitle: "Soil Sampling",
    gardenName: "Urban Farm Co-op",
    onResume: () => {},
    onDelete: () => {},
  },
};

export const UntitledDraft: Story = {
  args: {
    draft: draftIntroStep,
    onResume: () => {},
    onDelete: () => {},
  },
};

export const ReviewStep: Story = {
  args: {
    draft: draftReviewStep,
    actionTitle: "Compost Workshop",
    gardenName: "Hilltop Garden",
    onResume: () => {},
    onDelete: () => {},
  },
};

export const DarkMode: Story = {
  args: {
    draft: draftWithImages,
    actionTitle: "Plant Native Trees",
    gardenName: "Riverside Commons",
    onResume: () => {},
    onDelete: () => {},
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-sm">
      <p className="text-xs text-text-sub-600 font-medium">With images (Step 3/4)</p>
      <DraftCard
        draft={draftWithImages}
        actionTitle="Plant Native Trees"
        gardenName="Riverside Commons"
        onResume={() => {}}
        onDelete={() => {}}
      />

      <p className="text-xs text-text-sub-600 font-medium">No images (Step 2/4)</p>
      <DraftCard
        draft={draftNoImages}
        actionTitle="Soil Sampling"
        gardenName="Urban Farm Co-op"
        onResume={() => {}}
        onDelete={() => {}}
      />

      <p className="text-xs text-text-sub-600 font-medium">Untitled (Step 1/4)</p>
      <DraftCard draft={draftIntroStep} onResume={() => {}} onDelete={() => {}} />

      <p className="text-xs text-text-sub-600 font-medium">Review step (Step 4/4)</p>
      <DraftCard
        draft={draftReviewStep}
        actionTitle="Compost Workshop"
        gardenName="Hilltop Garden"
        onResume={() => {}}
        onDelete={() => {}}
      />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    draft: draftWithImages,
    actionTitle: "Plant Native Trees",
    gardenName: "Riverside Commons",
    onResume: () => {},
    onDelete: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify draft badge is present
    await expect(canvas.getByText("Draft")).toBeVisible();

    // Verify step progress badge
    await expect(canvas.getByText("Step 3/4")).toBeVisible();

    // Verify delete button exists with accessible label
    const deleteButton = canvas.getByRole("button", { name: /delete draft/i });
    await expect(deleteButton).toBeVisible();

    // Click delete button
    await userEvent.click(deleteButton);
  },
};

export const Mobile: Story = {
  args: {
    draft: draftWithImages,
    actionTitle: "Plant Native Trees",
    gardenName: "Riverside Commons",
    onResume: () => {},
    onDelete: () => {},
  },
  parameters: {
    viewport: { defaultViewport: "mobile1" },
  },
};
