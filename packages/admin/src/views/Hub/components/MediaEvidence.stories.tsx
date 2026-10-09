import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { FIXTURE_WORK_MEDIA } from "../../../../../shared/.storybook/fixtures";
import { AdminDialog } from "@/components/AdminDialog";
import { MediaEvidence } from "./MediaEvidence";

const meta: Meta<typeof MediaEvidence> = {
  title: "Admin/Workflows/Hub/MediaEvidence",
  component: MediaEvidence,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Photo grid + audio-note list used when reviewing work detail. Photos open in a full-screen lightbox. Fixture images are data-url SVGs so stories run fully offline.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof MediaEvidence>;

export const PhotosOnly: Story = {
  args: {
    media: FIXTURE_WORK_MEDIA,
    actionTitle: "Riverbank cleanup",
  },
};

export const Empty: Story = {
  args: {
    media: [],
    actionTitle: "Riverbank cleanup",
  },
};

export const WithAudioNotes: Story = {
  args: {
    media: FIXTURE_WORK_MEDIA.slice(0, 2),
    // Audio CIDs aren't exercised by `resolveIPFSUrl` in Storybook — the
    // AudioPlayer renders its empty state, which is the reviewable
    // contract here.
    audioNoteCids: ["bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"],
    actionTitle: "Species survey",
  },
};

/**
 * As the Hub's review dialog holds it. The viewer opens from inside a dialog, so
 * its scrim has to cover that dialog, and closing it has to hand focus back to
 * the photo that opened it.
 */
export const InReviewDialog: Story = {
  // Left out of the docs page, which a dialog that is always open would cover.
  tags: ["storybook-ci", "!autodocs"],
  args: {
    media: FIXTURE_WORK_MEDIA,
    actionTitle: "Riverbank cleanup",
  },
  render: (args) => (
    <AdminDialog open onOpenChange={() => undefined} title="Riverbank cleanup" size="lg" tone="hub">
      <MediaEvidence {...args} />
    </AdminDialog>
  ),
  play: async ({ canvasElement }) => {
    // The dialog and the viewer render in portals, so the page is the place to look.
    const page = canvasElement.ownerDocument;
    const screen = within(page.body);
    const review = await screen.findByRole("dialog", { name: "Riverbank cleanup" });
    const photo = within(review).getByRole("button", {
      name: "View Riverbank cleanup photo 2 of 4",
    });

    // Named from the catalogue, so a steward reads it in their own language.
    await userEvent.click(photo);
    const viewer = await screen.findByRole("dialog", { name: "Image Preview" });
    await expect(within(viewer).getByText("2 / 4")).toBeVisible();

    const scrim = page.querySelector('[data-component="ImagePreviewDialog"][data-slot="overlay"]');
    if (!scrim) throw new Error("The viewer renders no scrim");
    const layer = (element: Element) => Number(getComputedStyle(element).zIndex);
    await expect(layer(scrim)).toBeGreaterThanOrEqual(layer(review));
    await expect(
      review.compareDocumentPosition(scrim) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    await userEvent.click(within(viewer).getByRole("button", { name: "Close Preview" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Image Preview" })).not.toBeInTheDocument()
    );
    await expect(photo).toHaveFocus();
  },
};
