import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FormCheckbox, CheckboxGroup } from "./FormCheckbox";

const meta: Meta<typeof FormCheckbox> = {
  title: "Components/Form/FormCheckbox",
  component: FormCheckbox,
  tags: ["autodocs"],
  argTypes: {
    label: {
      control: "text",
      description: "Checkbox label",
    },
    description: {
      control: "text",
      description: "Description text below label",
    },
    error: {
      control: "text",
      description: "Error message",
    },
    checked: {
      control: "boolean",
      description: "Checked state",
    },
    disabled: {
      control: "boolean",
      description: "Disabled state",
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormCheckbox>;

export const Default: Story = {
  args: {
    label: "Accept terms",
    description: "I agree to the terms and conditions",
  },
};

export const Checked: Story = {
  args: {
    label: "Accept terms",
    description: "I agree to the terms and conditions",
    checked: true,
  },
};

export const WithError: Story = {
  args: {
    label: "Accept terms",
    description: "I agree to the terms and conditions",
    error: "You must accept the terms to continue",
  },
};

export const Disabled: Story = {
  args: {
    label: "Accept terms",
    description: "I agree to the terms and conditions",
    disabled: true,
  },
};

export const Interactive: Story = {
  render: function InteractiveCheckbox() {
    const [checked, setChecked] = useState(false);
    return (
      <FormCheckbox
        label="Accept terms"
        description="I agree to the terms and conditions"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
      />
    );
  },
};

// CheckboxGroup stories
export const Group: StoryObj<typeof CheckboxGroup> = {
  render: function GroupStory() {
    const [value, setValue] = useState<(string | number)[]>([]);
    return (
      <CheckboxGroup
        label="Select capitals"
        options={[
          { value: "social", label: "Social Capital" },
          { value: "material", label: "Material Capital" },
          { value: "financial", label: "Financial Capital" },
          { value: "living", label: "Living Capital" },
        ]}
        value={value}
        onChange={setValue}
        columns={2}
      />
    );
  },
};

export const GroupWithPreselected: StoryObj<typeof CheckboxGroup> = {
  render: function GroupPreselectedStory() {
    const [value, setValue] = useState<(string | number)[]>(["social", "living"]);
    return (
      <CheckboxGroup
        label="Select capitals"
        options={[
          { value: "social", label: "Social Capital" },
          { value: "material", label: "Material Capital" },
          { value: "financial", label: "Financial Capital" },
          { value: "living", label: "Living Capital" },
        ]}
        value={value}
        onChange={setValue}
        columns={2}
      />
    );
  },
};

export const GroupDisabled: StoryObj<typeof CheckboxGroup> = {
  render: () => (
    <CheckboxGroup
      label="Select capitals"
      options={[
        { value: "social", label: "Social Capital" },
        { value: "material", label: "Material Capital" },
      ]}
      value={["social"]}
      onChange={() => {}}
      disabled
    />
  ),
};
