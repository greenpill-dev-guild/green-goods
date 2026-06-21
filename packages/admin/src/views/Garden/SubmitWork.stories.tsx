import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import {
  DEFAULT_CHAIN_ID,
  Domain,
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

// Multiple eligible (AGRO) actions so the chooser renders in-panel instead of
// auto-selecting. The primary garden is AGRO-only, so these all use Domain.AGRO.
const CHOOSER_ACTIONS: Action[] = [
  { title: "Canopy baseline", description: "Document baseline canopy cover for the plot." },
  {
    title: "Canopy transect upload",
    description: "Upload a canopy transect photo series for the plot.",
  },
  { title: "Regrowth note", description: "Log a quick observation on observed regrowth." },
].map((override, index) => ({
  ...(STORYBOOK_SUBMIT_ACTIONS[0] as Action),
  id: `${DEFAULT_CHAIN_ID}-${index + 1}`,
  domain: Domain.AGRO,
  inputs: [
    {
      key: "plot",
      title: "Plot code",
      placeholder: "Plot A",
      type: "text",
      required: true,
      options: [],
    },
  ],
  mediaInfo: { title: "Field photos", required: true, minImageCount: 1, maxImageCount: 3 },
  ...override,
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

// Renders the panel inline (not portaled) so play-test queries can scope to the
// canvas. The responsive full-screen dialog is exercised by DialogShell.
function SubmitWorkPanelStory() {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <SubmitWorkPanel layout="page" onCancel={fn()} onSuccess={fn()} />
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
          "SubmitWork as a responsive full-screen dialog (desktop) / full-page route (mobile), plus inline panel states with deterministic admin garden/action fixtures.",
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

// A single eligible action auto-selects into Capture; submitting without media
// surfaces the required-media validation.
export const AvailableAction: Story = {
  tags: ["storybook-ci"],
  render: () => <SubmitWorkPanelStory />,
  decorators: submitWorkDecorators({
    seeds: submitWorkSeeds({ actions: STORYBOOK_SUBMIT_ACTIONS.slice(0, 1) }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByLabelText(/Plot code/)).toBeVisible();
    await expect(await canvas.findByLabelText("Time Spent (hours)")).toBeVisible();
    await userEvent.type(await canvas.findByLabelText(/Plot code/), "Plot A");
    await userEvent.click(await canvas.findByRole("button", { name: "Submit Work" }));
    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("At least one image is required")).toBeVisible();
  },
};

// Multiple eligible actions → the scannable card chooser (radiogroup).
export const ActionChooser: Story = {
  tags: ["storybook-ci"],
  render: () => <SubmitWorkPanelStory />,
  decorators: submitWorkDecorators({ seeds: submitWorkSeeds({ actions: CHOOSER_ACTIONS }) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cards = await canvas.findAllByRole("radio");
    expect(cards.length).toBeGreaterThan(1);
    await userEvent.click(cards[0]);
    await expect(await canvas.findByRole("button", { name: "Change action" })).toBeVisible();
  },
};

// Desktop full-screen dialog housing (portals to document body) — visual review.
export const DialogShell: Story = {
  render: () => <SubmitWorkRouteStory />,
  decorators: submitWorkDecorators({ seeds: submitWorkSeeds({ actions: CHOOSER_ACTIONS }) }),
};

export const NoDomainRecovery: Story = {
  tags: ["storybook-ci"],
  render: () => <SubmitWorkPanelStory />,
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
  render: () => <SubmitWorkPanelStory />,
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
  render: () => <SubmitWorkPanelStory />,
  decorators: disconnectedDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText("Please connect your wallet to submit work")
    ).toBeVisible();
  },
};
