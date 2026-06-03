import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import {
  DEFAULT_CHAIN_ID,
  queryKeys,
  ToastViewport,
  type Action,
  type Address,
  type Garden as SharedGarden,
} from "@green-goods/shared";
import {
  AuthActionsContext,
  AuthContext,
  AuthStateContext,
  type AuthActionsValue,
  type AuthContextType,
  type AuthStateValue,
} from "@green-goods/shared/providers";
import type { ComponentType, ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import { expect, fn, userEvent, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_ACTIONS,
  STORYBOOK_ADMIN_GARDENS,
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_OPERATOR_ADDRESS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withRouter,
  withSeededQueryClient,
  withSelectedAdminGarden,
  withWagmi,
} from "../../../../shared/.storybook/decorators";
import SubmitWork, { SubmitWorkPanel } from "./SubmitWork";

const STORYBOOK_OPERATOR_ADDRESS_KEY = STORYBOOK_OPERATOR_ADDRESS.toLowerCase() as Address;

const STORYBOOK_SUBMIT_ACTIONS: Action[] = STORYBOOK_ADMIN_ACTIONS.map((action, index) => ({
  ...action,
  id: `${DEFAULT_CHAIN_ID}-${index + 1}`,
  inputs:
    index === 0
      ? [
          {
            key: "plot",
            title: "Plot code",
            placeholder: "Plot A",
            type: "text",
            required: true,
            options: [],
          },
        ]
      : [],
  mediaInfo:
    index === 0
      ? {
          title: "Field photos",
          required: true,
          minImageCount: 1,
          maxImageCount: 3,
        }
      : action.mediaInfo,
}));

const STORYBOOK_EMPTY_DOMAIN_GARDEN = {
  ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
  domainMask: 0,
} satisfies SharedGarden;

const STORYBOOK_REVIEW_ONLY_GARDEN = {
  ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
  operators: [],
  owners: [],
  evaluators: [STORYBOOK_OPERATOR_ADDRESS],
} satisfies SharedGarden;

function replaceGarden(garden: SharedGarden) {
  return STORYBOOK_ADMIN_GARDENS.map((entry) => (entry.id === garden.id ? garden : entry));
}

function submitWorkSeeds({
  actions = STORYBOOK_SUBMIT_ACTIONS,
  gardens = STORYBOOK_ADMIN_GARDENS,
}: {
  actions?: Action[];
  gardens?: SharedGarden[];
} = {}): ReadonlyArray<readonly [QueryKey, unknown]> {
  return [
    ...STORYBOOK_ADMIN_SHELL_SEEDS,
    [queryKeys.actions.byChain(DEFAULT_CHAIN_ID), actions],
    [queryKeys.gardens.byChain(DEFAULT_CHAIN_ID), gardens],
    [
      queryKeys.role.operatorGardens(STORYBOOK_OPERATOR_ADDRESS_KEY, DEFAULT_CHAIN_ID),
      gardens.map((garden) => ({ id: garden.id, name: garden.name })),
    ],
  ];
}

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

const disconnectedAuthState: AuthStateValue = {
  authMode: null,
  isReady: true,
  isAuthenticated: false,
  isAuthenticating: false,
  error: null,
  credential: null,
  smartAccountAddress: null,
  smartAccountClient: null,
  userName: null,
  hasStoredCredential: false,
  walletAddress: null,
  eoaAddress: undefined,
  embeddedAddress: null,
  externalWalletConnected: false,
  externalWalletAddress: null,
};

function SubmitWorkRouteStory() {
  return (
    <>
      <Routes>
        <Route path="/hub/work/submit" element={<SubmitWork />} />
        <Route path="/garden/settings" element={<div className="p-6">Garden settings route</div>} />
      </Routes>
      <ToastViewport />
    </>
  );
}

function SubmitWorkSheetStory() {
  return (
    <div className="mx-auto max-w-xl p-4">
      <SubmitWorkPanel layout="sheet" onCancel={fn()} onSuccess={fn()} />
      <ToastViewport />
    </div>
  );
}

const meta: Meta<typeof SubmitWorkPanel> = {
  title: "Admin/Workflows/Garden/SubmitWorkPanel",
  component: SubmitWorkPanel,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Real SubmitWorkPanel route and sheet states with deterministic admin garden/action fixtures.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SubmitWorkPanel>;

function submitWorkDecorators({
  initialPath = "/hub/work/submit",
  garden = STORYBOOK_PRIMARY_ADMIN_GARDEN,
  seeds = submitWorkSeeds(),
}: {
  initialPath?: string;
  garden?: SharedGarden;
  seeds?: ReadonlyArray<readonly [QueryKey, unknown]>;
} = {}) {
  return [
    withAdminIdentity,
    withSeededQueryClient(seeds),
    withSelectedAdminGarden(garden),
    withRouter([initialPath]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ];
}

function disconnectedDecorators() {
  return [
    withWagmi,
    (Story: ComponentType) => (
      <StoryAuthProvider state={disconnectedAuthState}>
        <Story />
      </StoryAuthProvider>
    ),
    withSeededQueryClient(submitWorkSeeds()),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withRouter(["/hub/work/submit"]),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ];
}

export const PageAvailableAction: Story = {
  tags: ["storybook-ci"],
  render: () => <SubmitWorkRouteStory />,
  decorators: submitWorkDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Submit Work" })).toBeVisible();
    await userEvent.selectOptions(await canvas.findByLabelText(/Action/), `${DEFAULT_CHAIN_ID}-1`);
    await expect(await canvas.findByLabelText(/Plot code/)).toBeVisible();
    await expect(await canvas.findByLabelText("Time Spent (hours)")).toBeVisible();
    await userEvent.type(await canvas.findByLabelText(/Plot code/), "Plot A");
    await userEvent.click(await canvas.findByRole("button", { name: "Submit Work" }));
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("At least one image is required")).toBeVisible();
  },
};

export const SheetAvailableAction: Story = {
  render: () => <SubmitWorkSheetStory />,
  decorators: submitWorkDecorators(),
};

export const NoDomainRecovery: Story = {
  render: () => <SubmitWorkRouteStory />,
  decorators: submitWorkDecorators({
    garden: STORYBOOK_EMPTY_DOMAIN_GARDEN,
    seeds: submitWorkSeeds({
      gardens: replaceGarden(STORYBOOK_EMPTY_DOMAIN_GARDEN),
    }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("No actions available for this garden's domains")
    ).toBeVisible();
    await expect(await canvas.findByRole("button", { name: "Configure domains" })).toBeVisible();
  },
};

export const NoPermission: Story = {
  render: () => <SubmitWorkRouteStory />,
  decorators: submitWorkDecorators({
    garden: STORYBOOK_REVIEW_ONLY_GARDEN,
    seeds: submitWorkSeeds({
      gardens: replaceGarden(STORYBOOK_REVIEW_ONLY_GARDEN),
    }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("You don't have permission to submit work for this garden")
    ).toBeVisible();
  },
};

export const Unauthenticated: Story = {
  render: () => <SubmitWorkSheetStory />,
  decorators: disconnectedDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("Please connect your wallet to submit work")
    ).toBeVisible();
  },
};
