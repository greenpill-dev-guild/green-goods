import type { Meta, StoryObj } from "@storybook/react";
import type { QueryKey } from "@tanstack/react-query";
import { ToastViewport } from "@green-goods/shared/components/Toast/ToastViewport";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import {
  type Action,
  type Address,
  Domain,
  type Garden as SharedGarden,
} from "@green-goods/shared/types/domain";
import {
  AuthActionsContext,
  type AuthActionsValue,
  AuthContext,
  type AuthContextType,
  AuthStateContext,
  type AuthStateValue,
} from "@green-goods/shared/providers/Auth";
import { type ComponentType, type ReactNode, useState } from "react";
import { createMemoryRouter, Route, RouterProvider, Routes } from "react-router-dom";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_ACTIONS,
  STORYBOOK_ADMIN_GARDENS,
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_STEWARD_ADDRESS,
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
import { stagedWorkPhoto } from "../../../../shared/.storybook/workPhotoFixtures";
import SubmitWork, { SubmitWorkPanel } from "./SubmitWork";

const STORYBOOK_STEWARD_ADDRESS_KEY = STORYBOOK_STEWARD_ADDRESS.toLowerCase() as Address;

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

// Actions spanning two of the multi-domain garden's domains (Solar + Education),
// so the domain filter (AdminTabRail) renders above the chooser.
const MULTI_DOMAIN_ACTIONS: Action[] = [
  {
    title: "Solar array log",
    description: "Record output from the community solar array.",
    domain: Domain.SOLAR,
  },
  {
    title: "Panel cleaning pass",
    description: "Log a maintenance clean of the array.",
    domain: Domain.SOLAR,
  },
  {
    title: "Workshop session",
    description: "Document a hands-on training workshop.",
    domain: Domain.EDU,
  },
].map((override, index) => ({
  ...(STORYBOOK_SUBMIT_ACTIONS[0] as Action),
  id: `${DEFAULT_CHAIN_ID}-${index + 1}`,
  inputs: [],
  mediaInfo: { title: "Field photos", required: false, minImageCount: 0, maxImageCount: 3 },
  ...override,
}));

// One eligible action that asks for two photos, so the flow opens on Media with
// the photo count unmet.
const TWO_PHOTO_ACTION: Action = {
  ...(STORYBOOK_SUBMIT_ACTIONS[0] as Action),
  mediaInfo: { title: "Field photos", required: true, minImageCount: 2, maxImageCount: 6 },
};

// The shell reads the garden from the URL, so the route names the seeded one.
const SEEDED_GARDEN_SUBMIT_PATH = `/hub/work/submit?gardenId=${STORYBOOK_PRIMARY_ADMIN_GARDEN.id}`;

const STORYBOOK_EMPTY_DOMAIN_GARDEN = {
  ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
  domainMask: 0,
} satisfies SharedGarden;

const STORYBOOK_REVIEW_ONLY_GARDEN = {
  ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
  stewards: [],
  owners: [],
  evaluators: [STORYBOOK_STEWARD_ADDRESS],
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
      queryKeys.role.stewardGardens(STORYBOOK_STEWARD_ADDRESS_KEY, DEFAULT_CHAIN_ID),
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
  resolveSmartAccountClient: null,
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
          "SubmitWork hosted in the AdminDialog flow host (a centered card on desktop, a full-width bottom-sheet on mobile), plus inline panel states with deterministic admin garden/action fixtures.",
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

// A single eligible action auto-selects onto Media; advancing without the
// required photo is gated inline (not deferred to a submit-time toast).
export const AvailableAction: Story = {
  // Not in storybook-ci: this happy-path play needs live indexer/action data the
  // clean-room CI browser can't reach, so the real panel renders its empty state
  // ("No actions available for this garden's domains") and the assertions fail. Kept
  // for local/authenticated Storybook review.
  render: () => <SubmitWorkPanelStory />,
  decorators: submitWorkDecorators({
    seeds: submitWorkSeeds({ actions: STORYBOOK_SUBMIT_ACTIONS.slice(0, 1) }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // Single action auto-selects onto the Media step. The required photo is gated
    // here: advancing without it shows an inline error and the Details fields stay
    // out of reach.
    await userEvent.click(await canvas.findByRole("button", { name: "Next" }));
    await expect(await canvas.findByText(/Add at least 1 photo to continue/)).toBeVisible();
    await expect(canvas.queryByLabelText(/Plot code/)).not.toBeInTheDocument();
  },
};

// Multiple eligible actions → the scannable card chooser (radiogroup).
export const ActionChooser: Story = {
  // Not in storybook-ci: the card chooser needs live indexer/action data the clean-room
  // CI browser can't reach, so the radiogroup never renders offline. Kept for
  // local/authenticated Storybook review.
  render: () => <SubmitWorkPanelStory />,
  decorators: submitWorkDecorators({ seeds: submitWorkSeeds({ actions: CHOOSER_ACTIONS }) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cards = await canvas.findAllByRole("radio");
    expect(cards.length).toBeGreaterThan(1);
    await userEvent.click(cards[0]);
    // Select-in-place: the card is marked but the chooser stays on the Action
    // step; the footer Next then advances to Media (chooser gone).
    await expect(cards[0]).toBeChecked();
    expect(canvas.getAllByRole("radio").length).toBeGreaterThan(1);
    await userEvent.click(await canvas.findByRole("button", { name: "Next" }));
    await expect(canvas.queryByRole("radio")).not.toBeInTheDocument();
  },
};

// Multi-domain garden → the domain filter (AdminTabRail) renders above the
// chooser. The primary garden is AGRO-only, so this is the only coverage of the
// >1-domain filter branch.
export const DomainFilter: Story = {
  tags: ["storybook-ci"],
  render: () => <SubmitWorkPanelStory />,
  decorators: submitWorkDecorators({
    garden: STORYBOOK_ADMIN_GARDENS[1] as SharedGarden,
    seeds: submitWorkSeeds({ actions: MULTI_DOMAIN_ACTIONS }),
  }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("tablist")).toBeVisible();
    expect((await canvas.findAllByRole("radio")).length).toBeGreaterThan(1);
  },
};

// Centered AdminDialog flow housing (portals to document body) — visual review of
// the real flow inside its modal host: single header, scrolling body, pinned footer.
export const DialogShell: Story = {
  render: () => <SubmitWorkRouteStory />,
  decorators: submitWorkDecorators({ seeds: submitWorkSeeds({ actions: CHOOSER_ACTIONS }) }),
};

/**
 * The route in a data router: the host's close guard blocks navigation through
 * `useBlocker`, which a `MemoryRouter` does not provide.
 */
function SubmitWorkDataRoute({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        { path: "/hub/work/submit", element: children },
        { path: "*", element: <div className="p-6">Hub route</div> },
      ],
      { initialEntries: [SEEDED_GARDEN_SUBMIT_PATH] }
    )
  );
  return <RouterProvider router={router} />;
}

// The media step in the flow's real host: the centered dialog on desktop, the
// bottom sheet on a phone. The seeded garden's one action asks for two photos,
// so the flow opens on Media with the count beside the uploader unmet.
export const MediaStep: Story = {
  render: () => (
    <>
      <SubmitWork />
      <ToastViewport />
    </>
  ),
  decorators: [
    withAdminIdentity,
    withSeededQueryClient(submitWorkSeeds({ actions: [TWO_PHOTO_ACTION] })),
    (Story: ComponentType) => (
      <SubmitWorkDataRoute>
        <Story />
      </SubmitWorkDataRoute>
    ),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "hub",
    }),
  ],
};

// Staging photos in that host: the count turns met, a tile opens the preview
// above the flow, and removing photos turns the count back and holds Next.
export const MediaStepStaging: Story = {
  ...MediaStep,
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    // The flow renders in a portal, so the page is the place to look.
    const page = canvasElement.ownerDocument;
    const screen = within(page.body);
    const flow = await screen.findByRole("dialog", { name: "Submit Work" });
    const photos = () =>
      within(flow.querySelector<HTMLElement>('[data-component="SubmitWorkPhotos"]')!);
    const count = () => photos().getByRole("status");
    await expect(count()).toHaveTextContent("0 of 2 photos");

    // The fixtures are drawings named as photos, so the picker's type filter is
    // off. Each is under the 1 MB compression threshold and stages as it is.
    const input = flow.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("The media step renders no file input");
    await userEvent
      .setup({ applyAccept: false })
      .upload(input, [
        stagedWorkPhoto("east-bed-before.jpg", 420_000),
        stagedWorkPhoto("east-bed-after.jpg", 510_000),
        stagedWorkPhoto("seedling-tray.jpg", 640_000),
      ]);
    const preview = await within(flow).findByRole(
      "button",
      { name: "Preview east-bed-after.jpg" },
      { timeout: 5000 }
    );
    await expect(count()).toHaveTextContent("3 photos added");
    await expect(count()).toHaveAttribute("data-state", "met");

    // Both controls sit on one tile, so each has to take the press at its own centre.
    const remove = within(flow).getByRole("button", { name: "Remove east-bed-after.jpg" });
    for (const control of [preview, remove]) {
      const box = control.getBoundingClientRect();
      const pressed = page.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      await expect(control.contains(pressed)).toBe(true);
    }

    // The flow is a dialog on the modal layer, so the preview's scrim has to sit
    // on that layer and after it, or the flow shows through around the photo.
    await userEvent.click(preview);
    const viewer = await screen.findByRole("dialog", { name: "Image preview" });
    await expect(within(viewer).getByText("2 / 3")).toBeVisible();
    const scrim = page.querySelector('[data-component="ImagePreviewDialog"][data-slot="overlay"]');
    if (!scrim) throw new Error("The preview renders no scrim");
    const layer = (element: Element) => Number(getComputedStyle(element).zIndex);
    await expect(layer(scrim)).toBeGreaterThanOrEqual(layer(flow));
    await expect(
      flow.compareDocumentPosition(scrim) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Closing the preview leaves the flow open and hands focus back to the tile.
    await userEvent.click(within(viewer).getByRole("button", { name: "Close preview" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Image preview" })).not.toBeInTheDocument()
    );
    await expect(preview).toHaveFocus();

    // Back below the requirement, the count turns amber again and Next is held.
    await userEvent.click(remove);
    await userEvent.click(within(flow).getByRole("button", { name: "Remove seedling-tray.jpg" }));
    await expect(count()).toHaveTextContent("1 of 2 photos");
    await expect(count()).toHaveAttribute("data-state", "needed");
    await userEvent.click(within(flow).getByRole("button", { name: "Next" }));
    await expect(await within(flow).findByText(/Add at least 2 photos to continue/)).toBeVisible();
  },
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
    await expect(await canvas.findByRole("button", { name: "Configure Domains" })).toBeVisible();
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
