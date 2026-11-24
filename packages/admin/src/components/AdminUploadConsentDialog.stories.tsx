import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { AdminUploadConsentDialog } from "./AdminUploadConsentDialog";

const skip = fn();
const meta = {
  title: "Admin/Primitives/AdminUploadConsentDialog",
  component: AdminUploadConsentDialog,
  decorators: [withAdminPrimitiveFrame],
  tags: ["storybook-ci"],
  args: {
    kind: "admin-file",
    prompt: {
      reason: "sign-in",
      checked: false,
      saving: false,
      saveFailed: false,
      setChecked: fn(),
      accept: fn(async () => {}),
      cancel: skip,
    },
  },
} satisfies Meta<typeof AdminUploadConsentDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstSignIn: Story = {
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole("dialog", { name: "Before You Share" });
    await expect(dialog).toHaveAttribute("data-component", "AdminDialog");
    await expect(within(dialog).getByRole("button", { name: "Agree and Continue" })).toBeDisabled();
    skip.mockClear();
    await userEvent.click(within(dialog).getByRole("button", { name: "Skip for Now" }));
    await expect(skip).toHaveBeenCalledOnce();
  },
};
