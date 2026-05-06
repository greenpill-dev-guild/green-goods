import { RiRefreshLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "storybook/test";
import { withCanvasFrame } from "../../../.storybook/decorators";
import {
  RefreshActionProvider,
  useRefreshAction,
  useRefreshActionValue,
} from "./RefreshActionContext";

function RefreshActionPreview({ enabled = true, fetching = false }) {
  useRefreshAction(
    enabled
      ? {
          onRefresh: fn(),
          isFetching: fetching,
          labelId: fetching ? "app.common.refreshing" : "app.common.refresh",
        }
      : null
  );

  const config = useRefreshActionValue();

  return (
    <div className="max-w-md rounded-xl border border-stroke-soft-200 bg-bg-white-0 p-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-weak-50 text-text-sub-600">
          <RiRefreshLine className={fetching ? "h-5 w-5 animate-spin" : "h-5 w-5"} />
        </span>
        <div>
          <p className="text-label-md text-text-strong-950">Registered refresh action</p>
          <p className="text-sm text-text-sub-600">
            {config
              ? `${config.labelId ?? "app.common.refresh"} · ${config.isFetching ? "fetching" : "idle"}`
              : "No action registered"}
          </p>
        </div>
      </div>
    </div>
  );
}

const meta = {
  title: "Shared/Canvas/RefreshActionContext",
  tags: ["autodocs"],
  decorators: [withCanvasFrame({ heightClassName: "min-h-[220px]" })],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RefreshActionProvider>
      <RefreshActionPreview />
    </RefreshActionProvider>
  ),
};

export const Fetching: Story = {
  render: () => (
    <RefreshActionProvider>
      <RefreshActionPreview fetching />
    </RefreshActionProvider>
  ),
};

export const Unregistered: Story = {
  render: () => (
    <RefreshActionProvider>
      <RefreshActionPreview enabled={false} />
    </RefreshActionProvider>
  ),
};
