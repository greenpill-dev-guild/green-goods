import {
  RiErrorWarningLine,
  RiFileListLine,
  RiInboxLine,
  RiLoader4Line,
  RiSeedlingLine,
  RiWifiOffLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect, within } from "storybook/test";
import { Button } from "./Button";
import { EmptyState, type EmptyStateProps } from "./ListPrimitives";

const meta: Meta<typeof EmptyState> = {
  title: "Shared/Primitives/ListPrimitives",
  component: EmptyState,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The state block (`EmptyState`) that stands in for a list, a tab, a panel or a screen that is empty, loading, failed or not ready. The block has one anatomy on both surfaces: a 56px round tile, the title, one description and the surface's own action. Its type comes from the roles, so it draws at the app's 16px density and the cockpit's 14px one; the calm tile is the app's green tint and the cockpit's neutral one.",
      },
    },
  },
  args: {
    icon: <RiInboxLine />,
    title: "Nothing moving right now",
    description:
      "When you offer something or take up a neighbor's offer, it lives here until it is settled.",
  },
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

/** A list with nothing in it yet, and the act that fills it. */
export const Empty: Story = {
  args: {
    icon: <RiSeedlingLine />,
    title: "No gardens match your filters",
    description: "Reset filters or broaden your search to see more results.",
    action: (
      <Button size="sm" emphasis="secondary">
        Reset Filters
      </Button>
    ),
  },
};

export const EmptyWithoutAction: Story = {
  args: {
    icon: <RiFileListLine />,
    title: "No actions yet",
    description: "Actions will appear here once they have been created.",
  },
};

/** A screen waiting on its read: the tile carries a spinner, still in the calm tone. */
export const Loading: Story = {
  args: {
    icon: <RiLoader4Line className="animate-spin motion-reduce:animate-none" />,
    title: "Loading garden...",
    description: undefined,
  },
};

/** A failed read: the failure tone, one line saying nothing was lost, and Try Again. */
export const Failed: Story = {
  args: {
    tone: "error",
    icon: <RiErrorWarningLine />,
    title: "Couldn't load promises",
    description: "Nothing was lost. Check your connection and try again.",
    action: (
      <Button size="sm" emphasis="secondary">
        Try Again
      </Button>
    ),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A failure replaces the content, so it is announced.
    await expect(canvas.getByRole("alert")).toHaveTextContent("Couldn't load promises");
    await expect(canvas.getByRole("button", { name: "Try Again" })).toBeVisible();
  },
};

export const Warning: Story = {
  args: {
    tone: "warning",
    icon: <RiErrorWarningLine />,
    title: "This jar is paused",
    description: "Claims open again when a steward resumes it.",
  },
};

/** Offline is a wait, not a fault, so it keeps the calm tone. */
export const Offline: Story = {
  args: {
    icon: <RiWifiOffLine />,
    title: "You're offline",
    description: "Nothing was lost. This screen loads when you are back online.",
  },
};

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[28rem] w-80 flex-col rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0">
      {children}
    </div>
  );
}

/**
 * In a sheet tab the tile and title hold one upper-middle anchor (DL-036), so a longer
 * description or an action grows below them and switching tabs never moves the state.
 */
export const SheetAnchor: Story = {
  render: () => (
    <div className="flex flex-wrap gap-4">
      <Frame>
        <EmptyState
          className="flex-1"
          placement="sheet"
          icon={<RiInboxLine />}
          title="No drafts"
          description="Work you start and leave lives here."
        />
      </Frame>
      <Frame>
        <EmptyState
          className="flex-1"
          placement="sheet"
          tone="error"
          icon={<RiErrorWarningLine />}
          title="Couldn't load your work"
          description="Nothing was lost. Your drafts stay on this phone, and the list comes back when the connection does."
          action={
            <Button size="sm" emphasis="secondary">
              Try Again
            </Button>
          }
        />
      </Frame>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [calm, failed] = within(canvasElement).getAllByRole("heading");
    // The anchor holds: both titles sit at the same height whatever grows below them.
    await expect(
      Math.abs(calm.getBoundingClientRect().top - failed.getBoundingClientRect().top)
    ).toBeLessThan(1);
  },
};

/** Under a list's header row the tile sits 32px down, where the first row would land (DL-056). */
export const ListAnchor: Story = {
  render: () => (
    <Frame>
      <div className="flex h-12 items-center border-b border-stroke-soft-200 px-4 type-label-sm text-text-sub-600">
        Gathering…
      </div>
      <EmptyState
        className="flex-1"
        placement="list"
        icon={<RiInboxLine />}
        title="No promises yet"
        description="Offers and requests from the garden show here."
      />
    </Frame>
  ),
};

const STATES: Array<{ name: string; props: EmptyStateProps }> = [
  {
    name: "Empty",
    props: {
      icon: <RiInboxLine />,
      title: "No work waiting for review",
      description: "When gardeners submit work, it lands here for you to check.",
      action: <Button size="sm">Open the Queue</Button>,
    },
  },
  {
    name: "Loading",
    props: {
      icon: <RiLoader4Line className="animate-spin motion-reduce:animate-none" />,
      title: "Loading garden...",
    },
  },
  {
    name: "Failed",
    props: {
      tone: "error",
      icon: <RiErrorWarningLine />,
      title: "Hub data could not be loaded",
      description: "Refresh the workspace and try again.",
      action: (
        <Button size="sm" emphasis="secondary">
          Try Again
        </Button>
      ),
    },
  },
  {
    name: "Warning",
    props: {
      tone: "warning",
      icon: <RiWifiOffLine />,
      title: "Connection problem",
      description: "Check your connection and reload the page.",
    },
  },
];

/**
 * The two sizes: each state at the app's density beside the cockpit's (the cockpit's token
 * scope), so the title, description, button and calm tile follow each surface's own settings.
 */
export const BothSizes: Story = {
  render: () => (
    <div className="grid gap-6">
      <div className="grid grid-cols-[6rem_1fr_1fr] gap-4 type-label-sm text-text-sub-600">
        <span>State</span>
        <span>Installed app</span>
        <span>Cockpit</span>
      </div>
      {STATES.map((state) => (
        <div key={state.name} className="grid grid-cols-[6rem_1fr_1fr] items-start gap-4">
          <span className="type-label-sm text-text-sub-600">{state.name}</span>
          <div className="rounded-[var(--radius-lg)] bg-bg-white-0">
            <EmptyState {...state.props} />
          </div>
          <div data-surface-scope="admin" className="rounded-[var(--radius-lg)] bg-bg-white-0">
            <EmptyState {...state.props} />
          </div>
        </div>
      ))}
    </div>
  ),
};

/** Every state on the cockpit's own root, as its views draw them. */
export const CockpitStates: Story = {
  parameters: { surface: "admin" },
  render: () => (
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2" data-tone="hub">
      {STATES.map((state) => (
        <div key={state.name} className="rounded-[var(--radius-lg)] bg-bg-white-0">
          <EmptyState {...state.props} />
        </div>
      ))}
    </div>
  ),
};
