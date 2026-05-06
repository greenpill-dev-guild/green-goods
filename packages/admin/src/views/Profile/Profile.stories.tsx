import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { expect, within } from "storybook/test";
import {
  STORYBOOK_ADMIN_SHELL_SEEDS,
  STORYBOOK_PRIMARY_ADMIN_GARDEN,
} from "../../../../shared/.storybook/adminFixtures";
import {
  withAdminIdentity,
  withCanvasFrame,
  withSeededQueryClient,
  withSelectedAdminGarden,
} from "../../../../shared/.storybook/decorators";
import { CanvasLayout } from "@/components/Layout/CanvasLayout";
import { adminCanvasRoutes } from "@/routes/views";

function mobileQueryList(query: string): MediaQueryList {
  const matches = query.includes("min-width: 600px") ? false : query.includes("max-width");
  return {
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
}

function MobileProfileMedia({ children }: { children: ReactNode }) {
  const originalMatchMediaRef = useRef<typeof window.matchMedia | null>(null);

  if (typeof window !== "undefined" && originalMatchMediaRef.current === null) {
    originalMatchMediaRef.current = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => mobileQueryList(query);
  }

  useEffect(() => {
    return () => {
      if (originalMatchMediaRef.current) {
        window.matchMedia = originalMatchMediaRef.current;
      }
    };
  }, []);

  return <>{children}</>;
}

interface ProfileCanvasStoryProps {
  initialPath?: string;
}

function ProfileCanvasStory({ initialPath = "/profile" }: ProfileCanvasStoryProps) {
  const router = useMemo(
    () =>
      createMemoryRouter(
        [
          {
            element: <CanvasLayout />,
            children: adminCanvasRoutes,
          },
        ],
        { initialEntries: [initialPath] }
      ),
    [initialPath]
  );

  return (
    <MobileProfileMedia>
      <RouterProvider router={router} />
    </MobileProfileMedia>
  );
}

const meta: Meta<typeof ProfileCanvasStory> = {
  title: "Admin/Workspaces/Profile",
  component: ProfileCanvasStory,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    viewport: { defaultViewport: "mobile1" },
    docs: {
      description: {
        component:
          "Mobile-only route-backed Profile coverage through the real CanvasLayout shell and account panels.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ProfileCanvasStory>;

function profileDecorators() {
  return [
    withAdminIdentity,
    withSeededQueryClient(STORYBOOK_ADMIN_SHELL_SEEDS),
    withSelectedAdminGarden(STORYBOOK_PRIMARY_ADMIN_GARDEN),
    withCanvasFrame({
      className: "p-0",
      heightClassName: "h-[760px]",
      workspace: "profile",
    }),
  ];
}

export const ProfileRoute: Story = {
  args: { initialPath: "/profile" },
  decorators: profileDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Account" })).toBeVisible();
    await expect(await canvas.findByRole("tab", { name: "Profile" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  },
};

export const SettingsRoute: Story = {
  args: { initialPath: "/profile?tab=settings" },
  decorators: profileDecorators(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByRole("heading", { name: "Account" })).toBeVisible();
    await expect(await canvas.findByRole("tab", { name: "Settings" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(await canvas.findByRole("heading", { name: "Theme" })).toBeVisible();
  },
};
