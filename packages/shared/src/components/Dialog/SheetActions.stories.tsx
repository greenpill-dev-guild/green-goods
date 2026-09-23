import { RiArrowLeftLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { SheetActions } from "./SheetActions";

const SM_BREAKPOINT_PX = 640;
const EDGE_TOLERANCE_PX = 1;
const MIN_TOUCH_TARGET_PX = 44;

const PHONE_VIEWPORTS = {
  sheetActionsPhone390: {
    name: "Sheet actions phone 390 x 844",
    styles: { width: "390px", height: "844px" },
    type: "mobile",
  },
  sheetActionsPhone320: {
    name: "Sheet actions phone 320 x 692",
    styles: { width: "320px", height: "692px" },
    type: "mobile",
  },
} as const;

/** A sheet-width surface so the bar sits where it does in a real sheet. */
function SheetFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[320px] bg-bg-weak-50">
      <div
        data-testid="sheet-actions-frame"
        className="mx-auto flex max-w-[840px] flex-col border border-stroke-soft-200 bg-bg-white-0"
      >
        <p className="p-4 text-sm text-text-sub-600">Sheet content scrolls above the action bar.</p>
        {children}
      </div>
    </div>
  );
}

const meta = {
  title: "Shared/Feedback/SheetActions",
  component: SheetActions,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "The one action bar every sheet and dialog pins under its body (DL-016). Below 640px the actions stack full width with the primary on top; `steps` keeps Back / Continue in one row. From 640px the bar is one right-aligned row with the primary rightmost. PwaSheet, DialogShell, ConfirmDialog, and the client AppSheet render it through their `actions` prop.",
      },
    },
  },
  args: {
    primary: { label: "Confirm It Was Kept", onClick: fn() },
    secondary: { label: "Not Yet", onClick: fn() },
  },
  render: (args) => (
    <SheetFrame>
      <SheetActions {...args} />
    </SheetFrame>
  ),
} satisfies Meta<typeof SheetActions>;

export default meta;
type Story = StoryObj<typeof meta>;

const buttonRect = (name: string | RegExp) =>
  within(document.body).getByRole("button", { name }).getBoundingClientRect();

export const PhoneStack: Story = {
  tags: ["storybook-ci"],
  parameters: {
    viewport: { defaultViewport: "sheetActionsPhone390", viewports: PHONE_VIEWPORTS },
  },
  play: async ({ args }) => {
    await expect(window.innerWidth).toBeLessThan(SM_BREAKPOINT_PX);
    const primary = buttonRect("Confirm It Was Kept");
    const secondary = buttonRect("Not Yet");
    const frame = within(document.body).getByTestId("sheet-actions-frame").getBoundingClientRect();

    await expect(primary.bottom).toBeLessThanOrEqual(secondary.top);
    await expect(Math.abs(primary.width - secondary.width)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    await expect(primary.width).toBeGreaterThan(frame.width * 0.8);
    await expect(primary.height).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET_PX);

    await userEvent.click(within(document.body).getByRole("button", { name: "Not Yet" }));
    await expect(args.secondary?.onClick).toHaveBeenCalled();
  },
};

export const StepNavigation: Story = {
  tags: ["storybook-ci"],
  parameters: {
    viewport: { defaultViewport: "sheetActionsPhone390", viewports: PHONE_VIEWPORTS },
  },
  args: {
    layout: "steps",
    primary: { label: "Continue", onClick: fn() },
    secondary: {
      label: "Back",
      icon: <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />,
      onClick: fn(),
    },
  },
  play: async () => {
    const back = buttonRect("Back");
    const next = buttonRect("Continue");
    await expect(Math.abs(back.top - next.top)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    await expect(back.right).toBeLessThanOrEqual(next.left);
    await expect(next.width).toBeGreaterThan(back.width);
  },
};

export const LongTranslations: Story = {
  tags: ["storybook-ci"],
  parameters: {
    viewport: { defaultViewport: "sheetActionsPhone320", viewports: PHONE_VIEWPORTS },
  },
  args: {
    primary: { label: "Confirmar que o trabalho foi feito", onClick: fn() },
    secondary: { label: "Ainda não", onClick: fn() },
  },
  play: async () => {
    const primary = within(document.body).getByRole("button", {
      name: "Confirmar que o trabalho foi feito",
    });
    // Stacked labels wrap instead of clipping, and nothing scrolls sideways.
    await expect(primary.scrollWidth).toBeLessThanOrEqual(primary.clientWidth + EDGE_TOLERANCE_PX);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth + EDGE_TOLERANCE_PX
    );
  },
};

export const Destructive: Story = {
  args: {
    primary: { label: "Withdraw This Offer", tone: "danger", onClick: fn() },
    secondary: { label: "Keep It Open", onClick: fn() },
  },
};

export const ThirdChoice: Story = {
  args: {
    primary: { label: "Try Again", onClick: fn() },
    secondary: { label: "Choose a Different Photo", onClick: fn() },
    tertiary: { label: "Discard Draft", tone: "danger", onClick: fn() },
  },
};

export const Loading: Story = {
  tags: ["storybook-ci"],
  args: {
    primary: { label: "Send Request", loading: true, onClick: fn() },
    secondary: { label: "Check Request Status", disabled: true, onClick: fn() },
  },
  play: async () => {
    const send = within(document.body).getByRole("button", { name: "Send Request" });
    // A loading action keeps focus: busy and aria-disabled, never natively disabled.
    await expect(send).toHaveAttribute("aria-busy", "true");
    await expect(send).toHaveAttribute("aria-disabled", "true");
    await expect(send).not.toBeDisabled();
    await expect(
      within(document.body).getByRole("button", { name: "Check Request Status" })
    ).toBeDisabled();
  },
};

export const WideRow: Story = {
  tags: ["storybook-ci"],
  play: async () => {
    await expect(window.innerWidth).toBeGreaterThanOrEqual(SM_BREAKPOINT_PX);
    const primary = buttonRect("Confirm It Was Kept");
    const secondary = buttonRect("Not Yet");
    const frame = within(document.body).getByTestId("sheet-actions-frame").getBoundingClientRect();

    await expect(Math.abs(primary.top - secondary.top)).toBeLessThanOrEqual(EDGE_TOLERANCE_PX);
    await expect(secondary.right).toBeLessThanOrEqual(primary.left);
    // Right-aligned: the primary ends at the bar's inner edge, not stretched across it.
    await expect(frame.right - primary.right).toBeLessThan(32);
    await expect(primary.width).toBeLessThan(frame.width / 2);
  },
};
