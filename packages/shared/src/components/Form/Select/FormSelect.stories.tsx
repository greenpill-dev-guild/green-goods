import type { Meta, StoryObj } from "@storybook/react";
import { useForm, FormProvider } from "react-hook-form";
import { FormSelect, type FormSelectOption } from "./FormSelect";

const sampleOptions: FormSelectOption[] = [
  { label: "Reforestation", value: "reforestation" },
  { label: "Wetland Restoration", value: "wetland" },
  { label: "Soil Regeneration", value: "soil" },
  { label: "Biodiversity Monitoring", value: "biodiversity" },
  { label: "Water Quality Testing", value: "water" },
];

function FormSelectWrapper(props: {
  isMulti?: boolean;
  error?: string;
  defaultValue?: string | string[];
  options?: FormSelectOption[];
}) {
  const { isMulti = true, error, defaultValue, options = sampleOptions } = props;
  const methods = useForm({
    defaultValues: {
      tags: defaultValue ?? (isMulti ? [] : ""),
    },
  });

  return (
    <FormProvider {...methods}>
      <div className="w-[400px]">
        <FormSelect
          name="tags"
          label="Regenerative Tags"
          placeholder="Select tags..."
          options={options}
          control={methods.control}
          isMulti={isMulti}
          error={error}
        />
      </div>
    </FormProvider>
  );
}

const meta: Meta<typeof FormSelectWrapper> = {
  title: "Form Controls/FormSelect",
  component: FormSelectWrapper,
  tags: ["autodocs"],
  argTypes: {
    isMulti: {
      control: "boolean",
      description: "Allow multiple selections",
    },
    error: {
      control: "text",
      description: "Error message to display below the select",
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormSelectWrapper>;

export const Default: Story = {
  args: {},
};

export const SingleSelect: Story = {
  args: {
    isMulti: false,
  },
};

export const WithPreselectedValues: Story = {
  args: {
    defaultValue: ["reforestation", "soil"],
  },
};

export const WithError: Story = {
  args: {
    error: "At least one tag is required",
  },
};

export const EmptyOptions: Story = {
  args: {
    options: [],
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-2 text-sm font-medium text-text-sub-600">Multi-select (default)</p>
        <FormSelectWrapper />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text-sub-600">Single select</p>
        <FormSelectWrapper isMulti={false} />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text-sub-600">With error</p>
        <FormSelectWrapper error="At least one tag is required" />
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-text-sub-600">With pre-selected values</p>
        <FormSelectWrapper defaultValue={["reforestation", "soil"]} />
      </div>
    </div>
  ),
};

export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
