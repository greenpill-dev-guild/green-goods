import type { Meta, StoryObj } from "@storybook/react";
import { expect, within } from "storybook/test";
import { FormProgress } from "./Progress";

/**
 * A flow's steps in its top bar, each named under its marker. Submit Work, adding
 * proof and composing a promise share it, so every flow shows where you are by name.
 */
const meta: Meta<typeof FormProgress> = {
  title: "Client/Navigation/FormProgress",
  component: FormProgress,
  tags: ["autodocs", "storybook-ci"],
  parameters: { layout: "centered" },
  args: {
    currentStep: 2,
    steps: ["Start", "Media", "Details", "Review"],
  },
};

export default meta;
type Story = StoryObj<typeof FormProgress>;

export const SubmitWork: Story = {
  play: async ({ canvasElement }) => {
    const list = within(canvasElement).getByRole("list", { name: "Steps" });
    const steps = within(list).getAllByRole("listitem");
    await expect(steps).toHaveLength(4);
    // Each marker carries its step's name; the current one is marked as the step.
    for (const [index, name] of ["Start", "Media", "Details", "Review"].entries()) {
      await expect(within(steps[index]).getByText(name)).toBeVisible();
    }
    await expect(steps[1]).toHaveAttribute("aria-current", "step");
  },
};

export const AddingProof: Story = {
  args: { currentStep: 3, steps: ["Media", "Details", "Review"] },
};
