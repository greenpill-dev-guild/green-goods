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
import { type ComponentType, type ReactNode, useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
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

// One eligible action with every input type the details step renders, four of
// them required, and optional photos, so Next on Media opens Details as it is.
const DETAILS_ACTION: Action = {
  ...(STORYBOOK_SUBMIT_ACTIONS[0] as Action),
  mediaInfo: { title: "Field photos", required: false, minImageCount: 0, maxImageCount: 3 },
  inputs: [
    {
      key: "seedlingsPlanted",
      title: "Seedlings planted",
      placeholder: "0",
      type: "number",
      required: true,
      options: [],
    },
    {
      key: "seedlingsLost",
      title: "Seedlings lost",
      placeholder: "0",
      type: "number",
      required: false,
      options: [],
    },
    {
      key: "plot",
      title: "Plot code",
      placeholder: "Plot A",
      type: "text",
      required: true,
      options: [],
    },
    {
      key: "condition",
      title: "Site condition",
      placeholder: "Choose a condition",
      type: "select",
      required: true,
      options: ["Stable", "Improving", "Needs attention"],
    },
    {
      key: "canopyCover",
      title: "Canopy cover",
      placeholder: "Choose a range",
      type: "band",
      required: false,
      options: [],
      bands: ["0–25%", "26–50%", "51–75%", "76–100%"],
    },
    {
      key: "species",
      title: "Species planted",
      placeholder: "",
      type: "multi-select",
      required: true,
      options: ["Inga", "Cedar", "Guava"],
    },
    {
      key: "observations",
      title: "Observations",
      placeholder: "Describe what changed",
      type: "textarea",
      required: false,
      options: [],
    },
  ],
};

// The shell reads its garden from the URL's `gardenId`, and falls back to the
// first eligible garden by name, which is not the seeded one. So every story's
// route names the garden the story is about.
function submitWorkPath(garden: SharedGarden = STORYBOOK_PRIMARY_ADMIN_GARDEN) {
  return `/hub/work/submit?gardenId=${garden.id}`;
}

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

// A garden that is not among the steward's own, as a stale or mistyped link names.
const STORYBOOK_UNLISTED_GARDEN = {
  ...STORYBOOK_PRIMARY_ADMIN_GARDEN,
  id: "0x00000000000000000000000000000000000000ff",
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

function SubmitWorkRouteStory() {
  return (
    <>
      <SubmitWork />
      <ToastViewport />
    </>
  );
}

// Renders the panel inline (not portaled) so play-test queries can scope to the
// canvas. DialogShell and MediaStep show it in its dialog host.
function SubmitWorkPanelStory() {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col">
      <SubmitWorkPanel layout="page" onCancel={fn()} onDone={fn()} />
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
          "SubmitWork hosted in the AdminDialog flow host (a centered card on desktop, a full-width bottom-sheet on mobile), plus inline panel states with deterministic admin garden/action fixtures. There is no signed-out state here: the shell's access gate shows Connect to continue in place of every in-app route (Admin/Shell/AdminAccessStateRenderer).",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof SubmitWorkPanel>;

function submitWorkDecorators({
  garden = STORYBOOK_PRIMARY_ADMIN_GARDEN,
  seeds = submitWorkSeeds(),
}: {
  garden?: SharedGarden;
  seeds?: ReadonlyArray<readonly [QueryKey, unknown]>;
} = {}) {
  return [
    withAdminIdentity,
    withSeededQueryClient(seeds),
    withRouter([submitWorkPath(garden)]),
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
  tags: ["storybook-ci"],
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
  tags: ["storybook-ci"],
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

/**
 * The route in a data router: the host's close guard blocks navigation through
 * `useBlocker`, which `withRouter`'s `MemoryRouter` does not provide. The shared
 * `withDataRouter` mounts one path with no search string; this route also needs
 * `gardenId` and somewhere to land when the flow closes.
 */
function SubmitWorkDataRoute({ children }: { children: ReactNode }) {
  const [router] = useState(() =>
    createMemoryRouter(
      [
        { path: "/hub/work/submit", element: children },
        { path: "*", element: <div className="p-6">Hub route</div> },
      ],
      { initialEntries: [submitWorkPath()] }
    )
  );
  return <RouterProvider router={router} />;
}

// The route host in its dialog, as the Hub opens it, with the given actions seeded.
function submitWorkRouteDecorators(actions: Action[]) {
  return [
    withAdminIdentity,
    withSeededQueryClient(submitWorkSeeds({ actions })),
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
  ];
}

// The flow in its real host (portals to the document body): the centered dialog
// on desktop, the bottom sheet on a phone, with one header, a scrolling body and
// a pinned footer. Several eligible actions, so it opens on the chooser.
export const DialogShell: Story = {
  render: () => <SubmitWorkRouteStory />,
  decorators: submitWorkRouteDecorators(CHOOSER_ACTIONS),
};

// The media step in that host. The seeded garden's one action asks for two
// photos, so the flow opens on Media with the count beside the uploader unmet.
export const MediaStep: Story = {
  render: () => <SubmitWorkRouteStory />,
  decorators: submitWorkRouteDecorators([TWO_PHOTO_ACTION]),
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

    // Each photo is under the 1 MB compression threshold, so it stages as it is.
    const input = flow.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("The media step renders no file input");
    await userEvent.upload(input, [
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
    const viewer = await screen.findByRole("dialog", { name: "Image Preview" });
    await expect(within(viewer).getByText("2 / 3")).toBeVisible();
    const scrim = page.querySelector('[data-component="ImagePreviewDialog"][data-slot="overlay"]');
    if (!scrim) throw new Error("The preview renders no scrim");
    const layer = (element: Element) => Number(getComputedStyle(element).zIndex);
    await expect(layer(scrim)).toBeGreaterThanOrEqual(layer(flow));
    await expect(
      flow.compareDocumentPosition(scrim) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    // Closing the preview leaves the flow open and hands focus back to the tile.
    await userEvent.click(within(viewer).getByRole("button", { name: "Close Preview" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Image Preview" })).not.toBeInTheDocument()
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

// From Media, with no photo needed, Next opens the details step.
async function openDetailsStep(canvasElement: HTMLElement) {
  const flow = await within(canvasElement.ownerDocument.body).findByRole("dialog", {
    name: "Submit Work",
  });
  await userEvent.click(await within(flow).findByRole("button", { name: "Next" }));
  await within(flow).findByLabelText("Time Spent (hours)");
  return within(flow);
}

// The details step as it opens: every input type, the required ones marked, and
// nothing flagged before a field has been used.
export const DetailsStep: Story = {
  tags: ["storybook-ci"],
  render: () => <SubmitWorkRouteStory />,
  decorators: submitWorkRouteDecorators([DETAILS_ACTION]),
  play: async ({ canvasElement }) => {
    const flow = await openDetailsStep(canvasElement);
    await waitFor(() => expect(flow.getByText("* Required field")).toBeVisible());
    await expect(flow.queryAllByRole("alert")).toHaveLength(0);
  },
};

// Next with nothing filled in: the four required fields say so, the optional
// ones and time spent stay quiet, and the step holds.
export const DetailsStepChecked: Story = {
  ...DetailsStep,
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const flow = await openDetailsStep(canvasElement);
    await userEvent.click(flow.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(flow.getAllByText("This field is required")).toHaveLength(4));
    await expect(flow.getAllByRole("alert")).toHaveLength(4);
    await expect(flow.getByLabelText("Seedlings lost")).not.toHaveAccessibleDescription();
    await expect(flow.getByLabelText("Time Spent (hours)")).toBeVisible();
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
  tags: ["storybook-ci"],
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

// A link that names a garden this steward cannot open. The shell does not guess
// another garden for a link that names one, so the flow says it cannot find it
// and offers no way to submit. A signed-out viewer never gets this far: the
// shell's access gate shows its connect state in place of every in-app route
// (Admin/Shell/AdminAccessStateRenderer, Connect Required).
export const GardenNotFound: Story = {
  tags: ["storybook-ci"],
  render: () => <SubmitWorkPanelStory />,
  decorators: submitWorkDecorators({ garden: STORYBOOK_UNLISTED_GARDEN }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Garden not found")).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
  },
};
