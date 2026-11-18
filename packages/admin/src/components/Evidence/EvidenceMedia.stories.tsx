import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { FIXTURE_WORK_MEDIA } from "../../../../shared/.storybook/fixtures";
import { EvidenceDocumentList, EvidencePhotoGrid } from "./EvidenceMedia";

const meta: Meta = {
  title: "Admin/Components/EvidenceMedia",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The photo grid and document rows that Review's work media and the Garden pool's promise proof share. A photo opens large; a document opens from the gateway in a new tab, with its kind and size under its name.",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="max-w-md space-y-4 p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj;

/** Photos as tiles, then documents as rows, including a long name that truncates. */
export const PhotosAndDocuments: Story = {
  render: () => (
    <>
      <EvidencePhotoGrid
        sources={FIXTURE_WORK_MEDIA.slice(0, 3)}
        photoLabel={(index) => `Proof photo ${index + 1}`}
        photoAlt={(index) => `Proof photo ${index + 1}`}
      />
      <EvidenceDocumentList
        label="Documents"
        documents={[
          {
            cid: "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy",
            type: "application/pdf",
            name: "qa-report.pdf",
            size: 1024,
          },
          {
            cid: "bafkreibm6jg3ux5qumhcn2b3flc3tyu6dmlb4xa7u5bf44yegnrjhc4yeq",
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            name: "Riverside fence repair, volunteer log and signed sign-off sheet.docx",
            size: 1_258_291,
          },
          {
            cid: "bafkreia5cufmf2fjxzhr6vjz4qxmhbq6k7a3d2etm6zkqbqpl7xbbzrxse",
            type: "text/markdown",
            name: "notes.md",
          },
        ]}
      />
    </>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole("button", { name: /^Proof photo/ })).toHaveLength(3);
    await expect(canvas.getByText("PDF document · 1 kB")).toBeVisible();
    // A document whose size is unknown still says what it is.
    await expect(canvas.getByText("Markdown file")).toBeVisible();
  },
};
