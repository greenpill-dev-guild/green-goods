import type { Meta, StoryObj } from "@storybook/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import RouteErrorBoundary from "./RouteErrorBoundary";

interface StoryArgs {
  kind: "generic" | "chunk" | "network" | "notFound";
}

function buildError(kind: StoryArgs["kind"]) {
  switch (kind) {
    case "chunk":
      return new Error("Failed to fetch dynamically imported module: /assets/chunk-abc123.js");
    case "network":
      return new Error("Network error: Failed to fetch /api/data");
    case "notFound":
      return new Response(null, { status: 404, statusText: "Not Found" });
    case "generic":
    default:
      return new Error("Unexpected render error while resolving route component.");
  }
}

function RouteErrorBoundaryHarness({ kind }: StoryArgs) {
  const error = buildError(kind);
  const router = createMemoryRouter(
    [
      {
        path: "/",
        errorElement: <RouteErrorBoundary />,
        loader: () => {
          throw error;
        },
        element: <div>Never rendered.</div>,
      },
    ],
    { initialEntries: ["/"] }
  );
  return <RouterProvider router={router} />;
}

const meta: Meta<typeof RouteErrorBoundaryHarness> = {
  title: "Admin/Shell/RouteErrorBoundary",
  component: RouteErrorBoundaryHarness,
  tags: ["autodocs"],
  argTypes: {
    kind: {
      control: "select",
      options: ["generic", "chunk", "network", "notFound"],
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          "React Router error element. Differentiates chunk-load failures (stale deploy), network errors, 404 responses, and generic render errors. The harness mounts a memory router whose loader throws the chosen error so each state renders via the real boundary code path.",
      },
    },
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof RouteErrorBoundaryHarness>;

export const Generic: Story = {
  args: { kind: "generic" },
};

export const ChunkLoadError: Story = {
  args: { kind: "chunk" },
};

export const NetworkError: Story = {
  args: { kind: "network" },
};

export const NotFound: Story = {
  args: { kind: "notFound" },
};
