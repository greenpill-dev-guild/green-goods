import type { AdminLoginController } from "@green-goods/shared/hooks/admin-ui/auth/useAdminLoginController";
import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import { withAdminIdentity } from "../../../shared/.storybook/decorators";
import { AdminSignIn } from "./AdminSignIn";

const controller: AdminLoginController = {
  mode: "entry",
  changeMode: fn(),
  username: "storybook-steward",
  setUsername: fn(),
  error: null,
  isSigningIn: false,
  canSignInByName: true,
  hasStoredCredential: false,
  storedUsername: null,
  createAccountByName: fn(async () => {}),
  signInByName: fn(async () => {}),
  signInWithStoredPasskey: fn(async () => {}),
};
const meta: Meta<typeof AdminSignIn> = {
  title: "Admin/Identity/AdminSignIn",
  component: AdminSignIn,
  tags: ["autodocs"],
  decorators: [
    withAdminIdentity,
    (Story) => (
      <div className="flex justify-center p-6">
        <Story />
      </div>
    ),
  ],
  args: { controller },
  parameters: {
    docs: {
      description: {
        component:
          "Account creation and existing-account sign-in. The real admin controls render against deterministic controller state; no passkey or wallet ceremony is started.",
      },
    },
  },
};
export default meta;
type Story = StoryObj<typeof AdminSignIn>;
export const Default: Story = {};
export const CreateAccount: Story = { args: { controller: { ...controller, mode: "create" } } };
export const ExistingAccount: Story = { args: { controller: { ...controller, mode: "signin" } } };
export const Remembered: Story = {
  args: {
    controller: {
      ...controller,
      mode: "entry",
      hasStoredCredential: true,
      storedUsername: "storybook-steward",
    },
  },
};
export const Registering: Story = {
  args: { controller: { ...controller, mode: "create", isSigningIn: true } },
};
export const SigningIn: Story = {
  args: { controller: { ...controller, mode: "signin", isSigningIn: true } },
};
export const Unavailable: Story = {
  args: { controller: { ...controller, error: "Passkey recovery is temporarily unavailable." } },
};
export const LocalAccounts: Story = {
  args: { controller: { ...controller, canSignInByName: false } },
};

const feedbackStates = [
  { name: "idle", controller },
  {
    name: "error",
    controller: { ...controller, error: "Passkey recovery is temporarily unavailable." },
  },
  {
    name: "long-error",
    controller: {
      ...controller,
      error:
        "Passkey recovery is temporarily unavailable. Please keep your account name and try again when the service is available. If the problem continues, open Green Goods in your recommended browser and try signing in again with the same passkey account.",
    },
  },
  { name: "pending", controller: { ...controller, isSigningIn: true } },
];
const screens = ["entry", "create", "signin"] as const;

export const FeedbackLayout: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-wrap justify-center gap-8">
      {[320, 384].map((width) => (
        <div key={width} className="flex flex-col gap-8" style={{ width }}>
          {screens.flatMap((mode) =>
            feedbackStates.map((state) => (
              <div
                key={`${mode}-${state.name}`}
                data-testid={`feedback-${width}-${mode}-${state.name}`}
              >
                <AdminSignIn controller={{ ...state.controller, mode }} />
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const width of [320, 384]) {
      const idle = canvas.getByTestId(`feedback-${width}-entry-idle`);
      const measure = (panel: HTMLElement) => {
        const bounds = panel.getBoundingClientRect();
        return {
          height: bounds.height,
          firstSlotTop:
            within(panel).getByTestId("admin-auth-slot-one").getBoundingClientRect().top -
            bounds.top,
          secondSlotTop:
            within(panel).getByTestId("admin-auth-slot-two").getBoundingClientRect().top -
            bounds.top,
          feedbackTop:
            within(panel).getByTestId("admin-sign-in-feedback").getBoundingClientRect().top -
            bounds.top,
          navigationTop:
            within(panel).getByTestId("admin-auth-navigation").getBoundingClientRect().top -
            bounds.top,
        };
      };
      const expected = measure(idle);
      await expect(expected.height).toBeGreaterThan(0);
      for (const mode of screens) {
        const ready = canvas.getByTestId(`feedback-${width}-${mode}-idle`);
        const controlTop = (panel: HTMLElement) => {
          const bounds = panel.getBoundingClientRect();
          const controls = within(panel).getAllByRole("button");
          const field = panel.querySelector("input");
          return {
            first: (field ?? controls[0]).getBoundingClientRect().top - bounds.top,
            second: controls[field ? 0 : 1].getBoundingClientRect().top - bounds.top,
          };
        };
        for (const state of feedbackStates) {
          const panel = canvas.getByTestId(`feedback-${width}-${mode}-${state.name}`);
          await expect(measure(panel)).toEqual(expected);
          await expect(controlTop(panel)).toEqual(controlTop(ready));
        }
        const longError = within(
          canvas.getByTestId(`feedback-${width}-${mode}-long-error`)
        ).getByTestId("admin-sign-in-feedback");
        await expect(longError.scrollHeight).toBeGreaterThan(longError.clientHeight);
      }
    }
  },
};
