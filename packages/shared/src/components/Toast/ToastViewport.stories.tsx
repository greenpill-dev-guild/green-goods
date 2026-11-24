import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";
import { useIntl } from "react-intl";
import { useWalletReconnectPrompt } from "../../hooks/auth/useWalletReconnectPrompt";
import { refuseWithoutWallet } from "../../modules/auth/wallet-reconnect";
import { wasAskedToReconnect } from "../../utils/errors/unsent-failures";
import {
  AuthStateContext,
  AuthActionsContext,
  type AuthContextType,
} from "../../providers/authContext";
import { ToastViewport } from "./ToastViewport";
import { toastService } from "./toast.service";
import { createUpdateToasts } from "./presets/update";

const meta: Meta<typeof ToastViewport> = {
  title: "Shared/Feedback/ToastViewport",
  component: ToastViewport,
  tags: ["autodocs", "storybook-ci"],
  argTypes: {
    position: {
      control: "select",
      options: [
        "top-left",
        "top-center",
        "top-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
      ],
      description: "Position of the toast container on screen",
    },
    variant: {
      control: "select",
      options: ["default", "editorial"],
      description: "Visual treatment for the toast shell",
    },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof ToastViewport>;

function ToastTrigger({ viewport }: { viewport?: React.ReactNode }) {
  return (
    <div className="relative h-[300px] w-full bg-bg-white-0 p-8">
      {viewport ?? <ToastViewport />}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => toastService.success({ title: "Operation completed" })}
          className="rounded-lg bg-success-base px-3 py-2 text-sm font-medium text-white"
        >
          Success
        </button>
        <button
          type="button"
          onClick={() => toastService.error({ title: "Something went wrong" })}
          className="rounded-lg bg-error-base px-3 py-2 text-sm font-medium text-white"
        >
          Error
        </button>
        <button
          type="button"
          onClick={() => toastService.info({ title: "Here is an update" })}
          className="rounded-lg bg-information-base px-3 py-2 text-sm font-medium text-white"
        >
          Info
        </button>
      </div>
    </div>
  );
}

export const Default: Story = {
  render: () => <ToastTrigger />,
};

export const BottomRight: Story = {
  render: () => <ToastTrigger viewport={<ToastViewport position="bottom-right" />} />,
};

export const EditorialWebsite: Story = {
  render: () => <ToastTrigger viewport={<ToastViewport variant="editorial" />} />,
};

export const Interactive: Story = {
  render: () => <ToastTrigger />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const successBtn = canvas.getByRole("button", { name: "Success" });
    await userEvent.click(successBtn);
    await expect(successBtn).toBeVisible();
  },
};

/**
 * A toast with a title, a message and an action: the status icon sits on the
 * title's line, and the message and action run the toast's full width below it.
 * The action's green is the text role, so it reads on the dark toast too.
 */
export const TitleMessageAndAction: Story = {
  render: () => <ToastTrigger />,
  play: async ({ canvasElement }) => {
    toastService.error({
      id: "title-message-action",
      title: "Couldn't add proof",
      message: "It's still saved on this phone. Try again here or from Your Work.",
      action: { label: "Open Your Work", onClick: () => {} },
      // Long enough to measure and capture; a persistent toast would add a close button.
      duration: 60_000,
    });
    // A toast an earlier story raised may still be leaving; read this one.
    const title = await within(canvasElement).findByText("Couldn't add proof");
    const body = title.closest("[data-testid=toast-content]") as HTMLElement;
    const titleLine = title.parentElement as HTMLElement;
    const icon = titleLine.querySelector("svg") as SVGElement;
    const message = within(body).getByText(/still saved on this phone/);
    const center = (box: DOMRect) => box.top + box.height / 2;
    const iconBox = icon.getBoundingClientRect();
    const titleBox = title.getBoundingClientRect();
    await expect(Math.abs(center(iconBox) - center(titleBox))).toBeLessThanOrEqual(1);
    // The message starts where the icon does, not after it.
    await expect(message.getBoundingClientRect().left).toBe(iconBox.left);
    const action = within(body).getByRole("button", { name: "Open Your Work" });
    const probe = document.createElement("span");
    probe.style.color = "var(--color-primary-on-surface)";
    body.append(probe);
    await expect(getComputedStyle(action).color).toBe(getComputedStyle(probe).color);
    probe.remove();
  },
};

/** Saved upload recovery uses the same persistent toast and explicit action as app updates. */
export const QueuedUploadRecovery: Story = {
  render: () => <ToastViewport position="bottom-center" />,
  play: async ({ canvasElement }) => {
    const toasts = createUpdateToasts(({ id, defaultMessage }) => defaultMessage ?? id);
    toasts.codeUnavailable(() => {});
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Restart to continue")).toBeVisible();
    await expect(await canvas.findByRole("button", { name: /^Update$/ })).toBeVisible();
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
  render: () => <ToastTrigger />,
};

const reconnectSession: AuthContextType = {
  authMode: "wallet",
  walletRestore: "restoring",
  isReady: true,
  isAuthenticated: true,
  isAuthenticating: false,
  error: null,
  credential: null,
  smartAccountAddress: null,
  smartAccountClient: null,
  resolveSmartAccountClient: null,
  userName: null,
  hasStoredCredential: false,
  walletAddress: null,
  eoaAddress: undefined,
  embeddedAddress: null,
  externalWalletConnected: false,
  externalWalletAddress: null,
  createAccount: async () => {},
  loginWithPasskey: async () => {},
  loginWithWallet: fn(),
  loginWithEmbedded: () => {},
  signOut: async () => {},
  switchToWallet: () => {},
  switchToPasskey: () => {},
  retry: () => {},
  dismissError: () => {},
  clearPasskey: () => {},
  disconnectWallet: async () => {},
};

function WalletReconnectToast() {
  useWalletReconnectPrompt();
  const { formatMessage } = useIntl();
  return (
    <div className="p-8">
      <ToastViewport position="bottom-center" />
      <button
        type="button"
        data-testid="wallet-act"
        className="rounded-lg bg-information-base px-3 py-2 text-sm font-medium text-white"
        onClick={() => {
          try {
            refuseWithoutWallet();
          } catch (error) {
            if (!wasAskedToReconnect(error)) throw error;
          }
        }}
      >
        {formatMessage({ id: "app.common.submit" })}
      </button>
    </div>
  );
}

export const WalletReconnect: Story = {
  beforeEach: () => {
    toastService.dismissAll();
    return () => toastService.dismissAll();
  },
  render: () => (
    <AuthStateContext.Provider value={reconnectSession}>
      <AuthActionsContext.Provider value={reconnectSession}>
        <WalletReconnectToast />
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("wallet-act"));
    await expect(await canvas.findByTestId("wallet-reconnect-action")).toBeVisible();
  },
};
