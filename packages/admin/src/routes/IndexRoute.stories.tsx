import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import { AppBar, DEFAULT_CHAIN_ID, MainSheet, queryKeys, type Address } from "@green-goods/shared";
import {
  AuthActionsContext,
  AuthContext,
  AuthStateContext,
  type AuthActionsValue,
  type AuthContextType,
  type AuthStateValue,
} from "@green-goods/shared/providers";
import type { ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { expect, fn, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_OPERATOR_ADDRESS,
} from "../../../shared/.storybook/adminFixtures";
import {
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
  withWagmi,
} from "../../../shared/.storybook/decorators";
import { CanvasGardenAccessState } from "@/components/Layout/CanvasGardenAccessState";
import { CanvasIndexerErrorState } from "@/components/Layout/CanvasIndexerErrorState";
import { SeedlingIllustration } from "@/components/Layout/SeedlingIllustration";
import IndexRoute from "./IndexRoute";

const STORYBOOK_OPERATOR_ADDRESS_KEY = STORYBOOK_OPERATOR_ADDRESS.toLowerCase() as Address;

const noopAsync = async () => {};
const noop = () => {};

function StoryAuthProvider({ children, state }: { children: ReactNode; state: AuthStateValue }) {
  const actions: AuthActionsValue = {
    createAccount: noopAsync,
    loginWithPasskey: noopAsync,
    loginWithWallet: noop,
    loginWithEmbedded: noop,
    signOut: noopAsync,
    switchToWallet: noop,
    switchToPasskey: noop,
    retry: noop,
    dismissError: noop,
    clearPasskey: noop,
    disconnectWallet: noopAsync,
  };
  const value: AuthContextType = { ...state, ...actions };

  return (
    <AuthStateContext.Provider value={state}>
      <AuthActionsContext.Provider value={actions}>
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
      </AuthActionsContext.Provider>
    </AuthStateContext.Provider>
  );
}

const walletAuthState: AuthStateValue = {
  authMode: "wallet",
  isReady: true,
  isAuthenticated: true,
  isAuthenticating: false,
  error: null,
  credential: null,
  smartAccountAddress: null,
  smartAccountClient: null,
  userName: "Storybook operator",
  hasStoredCredential: false,
  walletAddress: STORYBOOK_OPERATOR_ADDRESS,
  eoaAddress: STORYBOOK_OPERATOR_ADDRESS,
  embeddedAddress: null,
  externalWalletConnected: true,
  externalWalletAddress: STORYBOOK_OPERATOR_ADDRESS,
};

const loadingAuthState: AuthStateValue = {
  ...walletAuthState,
  isReady: false,
  isAuthenticated: false,
  eoaAddress: undefined,
  walletAddress: null,
  externalWalletConnected: false,
  externalWalletAddress: null,
};

const disconnectedAuthState: AuthStateValue = {
  ...walletAuthState,
  authMode: null,
  isAuthenticated: false,
  userName: null,
  eoaAddress: undefined,
  walletAddress: null,
  externalWalletConnected: false,
  externalWalletAddress: null,
};

const embeddedAuthState: AuthStateValue = {
  ...walletAuthState,
  authMode: "embedded",
  eoaAddress: undefined,
  walletAddress: null,
  embeddedAddress: STORYBOOK_OPERATOR_ADDRESS,
};

const NO_GARDEN_SEEDS: ReadonlyArray<readonly [QueryKey, unknown]> = [
  ...STORYBOOK_ADMIN_SHELL_SEEDS,
  [queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), []],
  [queryKeys.role.operatorGardens(STORYBOOK_OPERATOR_ADDRESS_KEY, DEFAULT_CHAIN_ID), []],
  [
    queryKeys.role.deploymentPermissions(STORYBOOK_OPERATOR_ADDRESS_KEY, DEFAULT_CHAIN_ID),
    { isOwner: false, isInAllowlist: true, canDeploy: true },
  ],
];

function IndexRouteScenario({ state }: { state: AuthStateValue }) {
  return (
    <StoryAuthProvider state={state}>
      <Routes>
        <Route path="/" element={<IndexRoute />} />
        <Route
          path="/hub/work"
          element={
            <div className="flex min-h-full items-center justify-center p-6" role="status">
              Redirected to Hub workbench
            </div>
          }
        />
        <Route
          path="/garden/create"
          element={
            <div className="flex min-h-full items-center justify-center p-6" role="status">
              Garden creation route
            </div>
          }
        />
      </Routes>
    </StoryAuthProvider>
  );
}

const meta: Meta<typeof IndexRoute> = {
  title: "Admin/Routes/IndexRoute",
  component: IndexRoute,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Route-backed home state catalog for the admin '/' entrypoint: loading, connect-required, wallet-required, no-garden, and redirect-ready states.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function indexRouteDecorators(
  seeds: ReadonlyArray<readonly [QueryKey, unknown]> = STORYBOOK_ADMIN_SHELL_SEEDS
) {
  return [
    withWagmi,
    withSeededQueryClient(seeds),
    withRouter(["/"]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "home",
    }),
  ];
}

export const Loading: Story = {
  render: () => <IndexRouteScenario state={loadingAuthState} />,
  decorators: indexRouteDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("status", { name: "Checking authentication..." })
    ).toBeVisible();
  },
};

export const ConnectRequired: Story = {
  render: () => <IndexRouteScenario state={disconnectedAuthState} />,
  decorators: indexRouteDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Connect to continue" })).toBeVisible();
    await expect(await canvas.findByRole("button", { name: "Connect Wallet" })).toBeVisible();
  },
};

export const WalletRequired: Story = {
  render: () => <IndexRouteScenario state={embeddedAuthState} />,
  decorators: indexRouteDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId("wallet-required-shell")).toBeVisible();
    await expect(
      await canvas.findByRole("button", { name: "Sign out & connect wallet" })
    ).toBeVisible();
  },
};

export const NoGardenAccess: Story = {
  render: () => <IndexRouteScenario state={walletAuthState} />,
  decorators: indexRouteDecorators(NO_GARDEN_SEEDS),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByTestId("canvas-no-garden-access")).toBeVisible();
    await expect(await canvas.findByRole("button", { name: "Create Garden" })).toBeVisible();
  },
};

export const RedirectReady: Story = {
  render: () => <IndexRouteScenario state={walletAuthState} />,
  decorators: indexRouteDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "Redirected to Hub workbench"
    );
  },
};

/**
 * Visual harness for the indexer-error and operator-misclassification cases.
 *
 * The route-driven scenarios above can't simulate `useGardens.isError = true`
 * via React Query seeds (errors come from queryFn execution, not setQueryData),
 * so these stories render the terminal-state components directly inside the
 * home shell. They cover the IndexerError state introduced by the audit fix
 * and the operator-only no-garden copy that operators see now that
 * `canCreateGarden` is gated to deployers.
 */
function HomeShellHarness({ children }: { children: ReactNode }) {
  return (
    <div
      data-tone="home"
      className="admin-m3 h-full min-h-0 workspace-canvas workspace-canvas-grid"
    >
      <div className="canvas-area-top">
        <AppBar
          gardenChip={
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-strong">
              <SeedlingIllustration className="h-5 w-5" />
              Green Goods
            </span>
          }
        />
      </div>
      <MainSheet isReceded={false}>
        <main id="main-content" tabIndex={-1} className="main-scroll-area h-full overflow-y-auto">
          {children}
        </main>
      </MainSheet>
      <div className="canvas-area-bottom" />
    </div>
  );
}

const harnessDecorators = [
  withCanvasFrame({
    className: "p-0",
    heightClassName: "h-[760px]",
    workspace: "home",
  }),
];

export const NoGardenAccessOperator: Story = {
  tags: ["visual-harness"],
  name: "NoGardenAccess (operator copy)",
  render: () => (
    <HomeShellHarness>
      <CanvasGardenAccessState onCreateGarden={fn()} canCreateGarden={false} />
    </HomeShellHarness>
  ),
  decorators: harnessDecorators,
  parameters: {
    docs: {
      description: {
        story:
          "Operator-only copy: no Create Garden CTA, message reads 'Ask a garden owner to add you as an operator.' This is what `useEligibleAdminGardens.canCreateGarden=false` produces — and after the F2 fix that gate is `role === \"deployer\"`, so any operator with zero eligible gardens lands here.",
      },
    },
  },
};

export const IndexerError: Story = {
  tags: ["visual-harness"],
  render: () => (
    <HomeShellHarness>
      <CanvasIndexerErrorState onRetry={fn()} />
    </HomeShellHarness>
  ),
  decorators: harnessDecorators,
  parameters: {
    docs: {
      description: {
        story:
          "Distinct from the no-garden state. Renders when `useEligibleAdminGardens.isError` is true and the role-confirmed cross-check did not produce any fallback gardens. Previously this case rendered the no-garden copy, which gaslit operators during indexer outages.",
      },
    },
  },
};
