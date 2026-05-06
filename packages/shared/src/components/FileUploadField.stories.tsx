import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { FileUploadField } from "./FileUploadField";

function createImageFile(name: string, lastModified: number) {
  return new File([new Uint8Array([137, 80, 78, 71])], name, {
    type: "image/png",
    lastModified,
  });
}

function StatefulPreview({
  initialFiles,
  multiple = true,
}: {
  initialFiles: File[];
  multiple?: boolean;
}) {
  const [files, setFiles] = useState<File[]>(initialFiles);

  return (
    <FileUploadField
      label="Garden media"
      helpText="Upload images that document work completed in the field."
      accept="image/*"
      multiple={multiple}
      currentFiles={files}
      onFilesChange={setFiles}
      onRemoveFile={(index) => setFiles((current) => current.filter((_, item) => item !== index))}
    />
  );
}

const meta: Meta<typeof FileUploadField> = {
  title: "Shared/Form/FileUploadField",
  component: FileUploadField,
  tags: ["autodocs"],
  argTypes: {
    accept: {
      control: "text",
      description: "Accepted file input pattern.",
    },
    multiple: {
      control: "boolean",
      description: "Allow selecting more than one file.",
    },
    showPreview: {
      control: "boolean",
      description: "Show a preview list of currently selected files.",
    },
    compress: {
      control: "boolean",
      description: "Enable image compression before calling onFilesChange.",
    },
    disabled: {
      control: "boolean",
      description: "Disable the trigger button and hidden input.",
    },
    label: {
      control: "text",
      description: "Optional field label.",
    },
    helpText: {
      control: "text",
      description: "Optional helper copy displayed under the label.",
    },
    currentFiles: {
      control: false,
      description: "Currently attached files shown in the preview list.",
    },
    onFilesChange: {
      control: false,
      description: "Called with the next selected file list.",
    },
    onRemoveFile: {
      control: false,
      description: "Called when a previewed file is removed.",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: "Attach evidence",
    helpText: "PNG, JPG, or WebP. Keep uploads under 10MB.",
    accept: "image/*",
    multiple: true,
    showPreview: true,
    onFilesChange: fn(),
  },
};

export const WithPreview: Story = {
  args: {
    label: "Garden media",
    helpText: "Upload images that document work completed in the field.",
    accept: "image/*",
    multiple: true,
    showPreview: true,
    onFilesChange: fn(),
  },
  render: () => (
    <StatefulPreview
      initialFiles={[
        createImageFile("garden-team-photo.png", 1712448000000),
        createImageFile("seedling-closeup.png", 1712534400000),
      ]}
    />
  ),
};

export const SingleFileNoPreview: Story = {
  args: {
    label: "Upload agreement",
    helpText: "PDF or image upload accepted.",
    accept: ".pdf,image/*",
    multiple: false,
    showPreview: false,
    onFilesChange: fn(),
  },
};

export const Disabled: Story = {
  args: {
    label: "Upload media",
    helpText: "Uploads are locked while the submission is being processed.",
    accept: "image/*",
    multiple: true,
    disabled: true,
    onFilesChange: fn(),
  },
};

export const InteractivePreview: Story = {
  args: {
    label: "Garden media",
    helpText: "Upload images that document work completed in the field.",
    accept: "image/*",
    multiple: true,
    showPreview: true,
    onFilesChange: fn(),
  },
  render: () => (
    <StatefulPreview
      initialFiles={[
        createImageFile("garden-overview.png", 1712620800000),
        createImageFile("compost-bed.png", 1712707200000),
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("garden-overview.png")).toBeVisible();
    const removeButtons = canvas.getAllByRole("button", { name: /remove/i });
    await userEvent.click(removeButtons[0]);
    await expect(canvas.queryByText("garden-overview.png")).not.toBeInTheDocument();
  },
};
