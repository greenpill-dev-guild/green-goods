import type { WorkFormData } from "@green-goods/shared/hooks/work/useWorkForm";
import type { WorkInput } from "@green-goods/shared/types/domain";
import type { Meta, StoryObj } from "@storybook/react";
import { useForm } from "react-hook-form";
import { withAdminPrimitiveFrame, withI18n } from "../../../../../shared/.storybook/decorators";
import { SubmitWorkFields } from "./SubmitWorkFields";

const INPUTS: WorkInput[] = [
  {
    key: "plot",
    title: "Plot code",
    placeholder: "Plot A",
    type: "text",
    required: true,
    options: [],
  },
  {
    key: "condition",
    title: "Site condition",
    placeholder: "Choose a condition",
    type: "select",
    required: true,
    options: ["Stable", "Improving", "Needs attention"],
  },
  {
    key: "observations",
    title: "Observations",
    placeholder: "Describe what changed",
    type: "textarea",
    required: false,
    options: [],
  },
];

function FieldsStory() {
  const form = useForm<WorkFormData>();
  return (
    <div className="space-y-4">
      <SubmitWorkFields
        inputs={INPUTS}
        control={form.control}
        register={form.register}
        errors={{}}
      />
    </div>
  );
}

const meta = {
  title: "Admin/Workflows/Garden/SubmitWorkFields",
  component: SubmitWorkFields,
  tags: ["autodocs"],
  decorators: [withI18n, withAdminPrimitiveFrame],
} satisfies Meta<typeof SubmitWorkFields>;

export default meta;
type Story = StoryObj;

export const FieldTypes: Story = {
  render: () => <FieldsStory />,
};
