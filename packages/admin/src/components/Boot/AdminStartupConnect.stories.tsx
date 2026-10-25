import { Button } from "@green-goods/shared/components/Button";
import { useWalletModalOpen } from "@green-goods/shared/hooks/auth/useWalletModalOpen";
import {
  AuthActionsContext,
  AuthContext,
  AuthStateContext,
  useAuthActions,
  useAuthState,
} from "@green-goods/shared/providers/Auth";
import type { Meta, StoryObj } from "@storybook/react";
import { type ComponentProps, useCallback, useState } from "react";
import { expect, fn, mocked, userEvent, waitFor, within } from "storybook/test";
import { withSignedOutAuth } from "../../../../shared/.storybook/decorators";
import { resetHookMocks } from "../../../../shared/.storybook/moduleMocks";
import { AdminStartupConnect } from "./AdminStartupConnect";

type StartupStoryArgs = ComponentProps<typeof AdminStartupConnect> & {
  fixtureReady: boolean;
  fixtureAuthenticated: boolean;
  fixtureModal: "opens" | "never-opens";
  onWalletRequest: () => void;
};

/** Supplies fictional auth facts to the real startup gate; no wallet SDK or credentials exist here. */
function StartupFixture(args: StartupStoryArgs) {
  const { onWalletRequest, fixtureModal } = args;
  const baseState = useAuthState();
  const baseActions = useAuthActions();
  const [ready, setReady] = useState(args.fixtureReady);
  const [modalOpen, setModalOpen] = useState(false);
  const [attempts, setAttempts] = useState(0);
  mocked(useWalletModalOpen).mockReturnValue(modalOpen);
  const loginWithWallet = useCallback(() => {
    onWalletRequest();
    setAttempts((count) => count + 1);
    if (fixtureModal === "opens") setModalOpen(true);
  }, [fixtureModal, onWalletRequest]);
  const address = args.fixtureAuthenticated
    ? ("0x000000000000000000000000000000000000f201" as const)
    : null;
  const state = {
    ...baseState,
    isReady: ready,
    isAuthenticated: args.fixtureAuthenticated,
    authMode: args.fixtureAuthenticated ? ("wallet" as const) : null,
    walletAddress: address,
    eoaAddress: address ?? undefined,
    externalWalletAddress: address,
    externalWalletConnected: args.fixtureAuthenticated,
  };
  const actions = { ...baseActions, loginWithWallet };
  return (
    <>
      <aside className="surface-section space-y-2 p-4" aria-label="Storybook fixture controls">
        <p className="type-meta text-text-sub">
          Fictional auth readiness and modal observations. These controls never open a wallet or
          sign in.
        </p>
        <p role="status" className="type-meta text-text-sub">
          Simulated wallet requests: {attempts}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            disabled={ready}
            onClick={() => setReady(true)}
          >
            Mark Fixture Auth Ready
          </Button>
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            disabled={!modalOpen}
            onClick={() => setModalOpen(false)}
          >
            Dismiss Simulated Wallet
          </Button>
        </div>
      </aside>
      <AuthStateContext.Provider value={state}>
        <AuthActionsContext.Provider value={actions}>
          <AuthContext.Provider value={{ ...state, ...actions }}>
            <AdminStartupConnect requested={args.requested}>{args.children}</AdminStartupConnect>
          </AuthContext.Provider>
        </AuthActionsContext.Provider>
      </AuthStateContext.Provider>
    </>
  );
}

const meta: Meta<StartupStoryArgs> = {
  title: "Admin/Boot/AdminStartupConnect",
  component: AdminStartupConnect,
  tags: ["autodocs"],
  decorators: [withSignedOutAuth],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Real AdminStartupConnect and BootConnect, supplied with explicit fictional readiness, identity and wallet-modal observations through public Auth contexts and the preview-registered modal-hook spy. Workspace content is a labeled fixture child. This proves the startup gate's rendering and callbacks, not real wallet opening, passkey possession or production authentication.",
      },
    },
  },
  args: {
    requested: true,
    fixtureReady: false,
    fixtureAuthenticated: false,
    fixtureModal: "never-opens",
    onWalletRequest: fn(),
    children: (
      <section className="surface-section p-6" data-testid="startup-workspace-fixture">
        <h2 className="type-title-md font-semibold">Workspace fixture admitted</h2>
        <p className="type-body text-text-sub">
          The real startup gate admitted its child. No production workspace or account was opened.
        </p>
      </section>
    ),
  },
  argTypes: {
    children: { control: false },
    onWalletRequest: { control: false },
    fixtureReady: { control: "boolean" },
    fixtureAuthenticated: { control: "boolean" },
    fixtureModal: { control: "select", options: ["opens", "never-opens"] },
  },
  beforeEach: () => {
    const language = localStorage.getItem("gg-language");
    localStorage.setItem("gg-language", "en");
    mocked(useWalletModalOpen).mockReturnValue(false);
    return () => {
      resetHookMocks(useWalletModalOpen)();
      if (language === null) localStorage.removeItem("gg-language");
      else localStorage.setItem("gg-language", language);
    };
  },
  render: (args) => <StartupFixture {...args} />,
};
export default meta;
type Story = StoryObj<StartupStoryArgs>;

export const WaitForReadiness: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId("passkey-start-button")).toBeVisible();
    await expect(args.onWalletRequest).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Mark Fixture Auth Ready" }));
    await waitFor(() => expect(args.onWalletRequest).toHaveBeenCalledTimes(1));
    await expect(canvas.queryByTestId("startup-workspace-fixture")).not.toBeInTheDocument();
  },
};
export const PasskeyBeforeReadiness: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("passkey-start-button"));
    await expect(canvas.getByTestId("startup-workspace-fixture")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Mark Fixture Auth Ready" }));
    await expect(args.onWalletRequest).not.toHaveBeenCalled();
  },
};
export const WalletModalDismissal: Story = {
  args: { fixtureReady: true, fixtureModal: "opens" },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(args.onWalletRequest).toHaveBeenCalledTimes(1));
    await expect(canvas.queryByTestId("startup-workspace-fixture")).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss Simulated Wallet" }));
    await expect(canvas.getByTestId("startup-workspace-fixture")).toBeVisible();
  },
};
export const WalletRetryAndPasskeyFallback: Story = {
  args: { fixtureReady: true },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(args.onWalletRequest).toHaveBeenCalledTimes(1));
    await userEvent.click(canvas.getByTestId("connect-wallet-button"));
    await expect(args.onWalletRequest).toHaveBeenCalledTimes(2);
    await userEvent.click(canvas.getByTestId("passkey-start-button"));
    await expect(canvas.getByTestId("startup-workspace-fixture")).toBeVisible();
  },
};
export const RestoredIdentity: Story = {
  args: { fixtureReady: true, fixtureAuthenticated: true },
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getByTestId("startup-workspace-fixture")).toBeVisible();
    await expect(args.onWalletRequest).not.toHaveBeenCalled();
  },
};
export const OrdinaryStartupBeforeReadiness: Story = {
  args: { requested: false },
  play: async ({ canvasElement, args }) => {
    await expect(within(canvasElement).getByTestId("startup-workspace-fixture")).toBeVisible();
    await expect(args.onWalletRequest).not.toHaveBeenCalled();
  },
};
