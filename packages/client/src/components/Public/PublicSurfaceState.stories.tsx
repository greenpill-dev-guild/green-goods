import type { Meta, StoryObj } from "@storybook/react";
import { PublicSurfaceState } from "./PublicSurfaceState";

const meta: Meta<typeof PublicSurfaceState> = {
  title: "Client/Public/PublicSurfaceState",
  component: PublicSurfaceState,
  args: {
    state: "ready",
    loading: <p>Loading the public record…</p>,
    error: <p>The public record is temporarily unavailable.</p>,
    empty: <p>No public records are available yet.</p>,
    children: <p>Three public records are ready.</p>,
  },
  parameters: {
    docs: {
      description: {
        component:
          "The semantic loading, error, empty, and ready switch shared by public collection surfaces.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicSurfaceState>;

export const Ready: Story = {};
export const Loading: Story = { args: { state: "loading" } };
export const Error: Story = { args: { state: "error" } };
export const Empty: Story = { args: { state: "empty" } };
