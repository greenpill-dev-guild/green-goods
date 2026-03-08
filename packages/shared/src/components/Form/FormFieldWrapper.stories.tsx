import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { FormFieldWrapper } from "./FormFieldWrapper";

const meta: Meta<typeof FormFieldWrapper> = {
  title: "Form Controls/FormFieldWrapper",
  component: FormFieldWrapper,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Shared wrapper for form fields that renders label, error, and helper text. Links error/helper text to the input via aria-describedby. Used internally by FormInput and FormTextarea.",
      },
    },
  },
  argTypes: {
    id: {
      control: "text",
      description: "ID used for htmlFor/aria-describedby linking",
    },
    label: {
      control: "text",
      description: "Label text for the field",
    },
    helperText: {
      control: "text",
      description: "Helper text displayed below the field",
    },
    error: {
      control: "text",
      description: "Error message — overrides helper text when set, shows in red",
    },
    className: {
      control: "text",
      description: "Additional CSS classes",
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormFieldWrapper>;

export const Default: Story = {
  args: {
    id: "default-field",
    label: "Field Label",
    children: (
      <input
        id="default-field"
        type="text"
        placeholder="Enter value..."
        className="w-full rounded-lg border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
      />
    ),
  },
};

export const WithError: Story = {
  args: {
    id: "error-field",
    label: "Email Address",
    error: "Please enter a valid email address",
    children: (
      <input
        id="error-field"
        type="email"
        defaultValue="not-an-email"
        aria-describedby="error-field-helper-text"
        className="w-full rounded-lg border border-error-base bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 focus:border-error-base focus:outline-none focus:ring-2 focus:ring-error-lighter"
      />
    ),
  },
};

export const WithHelperText: Story = {
  args: {
    id: "helper-field",
    label: "Username",
    helperText: "Must be at least 3 characters long",
    children: (
      <input
        id="helper-field"
        type="text"
        placeholder="Choose a username"
        aria-describedby="helper-field-helper-text"
        className="w-full rounded-lg border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
      />
    ),
  },
};

export const Required: Story = {
  args: {
    id: "required-field",
    label: "Garden Name",
    helperText: "This field is required",
    children: (
      <input
        id="required-field"
        type="text"
        required
        placeholder="Enter garden name"
        aria-describedby="required-field-helper-text"
        className="w-full rounded-lg border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
      />
    ),
  },
  parameters: {
    docs: {
      description: {
        story:
          "Note: FormFieldWrapper does not render a required indicator. Required styling must be handled by the child input or by wrapping components like FormInput.",
      },
    },
  },
};

export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    id: "dark-field",
    label: "Dark Mode Field",
    helperText: "Helper text in dark mode",
    children: (
      <input
        id="dark-field"
        type="text"
        placeholder="Dark mode input"
        aria-describedby="dark-field-helper-text"
        className="w-full rounded-lg border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
      />
    ),
  },
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-6 max-w-md">
      <FormFieldWrapper id="gallery-default" label="Default">
        <input
          id="gallery-default"
          type="text"
          placeholder="Enter value..."
          className="w-full rounded-lg border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400"
        />
      </FormFieldWrapper>

      <FormFieldWrapper id="gallery-helper" label="With Helper" helperText="Helpful guidance text">
        <input
          id="gallery-helper"
          type="text"
          placeholder="Enter value..."
          className="w-full rounded-lg border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400"
        />
      </FormFieldWrapper>

      <FormFieldWrapper id="gallery-error" label="With Error" error="This field is required">
        <input
          id="gallery-error"
          type="text"
          defaultValue="bad input"
          className="w-full rounded-lg border border-error-base bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950"
        />
      </FormFieldWrapper>

      <FormFieldWrapper
        id="gallery-both"
        label="Error Overrides Helper"
        helperText="This helper text is hidden"
        error="Error takes precedence over helper text"
      >
        <input
          id="gallery-both"
          type="text"
          className="w-full rounded-lg border border-error-base bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950"
        />
      </FormFieldWrapper>

      <FormFieldWrapper id="gallery-textarea" label="With Textarea">
        <textarea
          id="gallery-textarea"
          placeholder="Multi-line input..."
          rows={3}
          className="w-full rounded-lg border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 resize-none"
        />
      </FormFieldWrapper>
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    id: "interactive-field",
    label: "Interactive Field",
    helperText: "Type something to test interaction",
    children: (
      <input
        id="interactive-field"
        type="text"
        placeholder="Type here..."
        aria-describedby="interactive-field-helper-text"
        className="w-full rounded-lg border border-stroke-sub-300 bg-bg-white-0 px-3 py-2.5 text-sm text-text-strong-950 placeholder:text-text-soft-400 focus:border-primary-base focus:outline-none focus:ring-2 focus:ring-primary-lighter"
      />
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify label is rendered
    const label = canvas.getByText("Interactive Field");
    await expect(label).toBeInTheDocument();
    await expect(label.tagName).toBe("LABEL");
    await expect(label).toHaveAttribute("for", "interactive-field");

    // Verify helper text is rendered and linked
    const helper = canvas.getByText("Type something to test interaction");
    await expect(helper).toBeInTheDocument();
    await expect(helper).toHaveAttribute("id", "interactive-field-helper-text");

    // Type in the input
    const input = canvas.getByPlaceholderText("Type here...");
    await userEvent.click(input);
    await userEvent.type(input, "Hello World");
    await expect(input).toHaveValue("Hello World");
  },
};
