import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { PageTransition } from "./PageTransition";

/**
 * PageTransition wraps `<Outlet />` with close-then-navigate sheet orchestration.
 *
 * On route change:
 * 1. If a sheet is open, calls `onNavigateAway` to save state and wait for sheet close motion
 * 2. Triggers `document.startViewTransition()` for a cross-fade
 * 3. Calls `onNavigateArrive` to restore any saved sheet state
 *
 * The app supplies view-transition keyframes. This Storybook story focuses on
 * route orchestration and route state, not CI interaction coverage.
 */

const meta: Meta<typeof PageTransition> = {
  title: "Admin/Shell/PageTransition",
  component: PageTransition,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof PageTransition>;

/** Mock page content for demonstrating transitions */
function MockPage({ title, color }: { title: string; color: string }) {
  return (
    <div className={`rounded-xl border border-stroke-soft p-8 ${color}`}>
      <h2 className="text-lg font-bold text-text-strong">{title}</h2>
      <p className="mt-2 text-sm text-text-sub">
        This page uses the View Transitions API for cross-fade animations.
      </p>
    </div>
  );
}

/** Navigation controls for interactive demo */
function NavControls() {
  const navigate = useNavigate();
  return (
    <div className="mb-4 flex gap-2">
      <button
        type="button"
        onClick={() => navigate("/page-a")}
        className="rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong hover:bg-bg-soft transition-colors"
      >
        Page A
      </button>
      <button
        type="button"
        onClick={() => navigate("/page-b")}
        className="rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong hover:bg-bg-soft transition-colors"
      >
        Page B
      </button>
      <button
        type="button"
        onClick={() => navigate("/page-c")}
        className="rounded-lg border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong hover:bg-bg-soft transition-colors"
      >
        Page C
      </button>
    </div>
  );
}

export const Default: Story = {
  render: () => (
    <MemoryRouter initialEntries={["/page-a"]}>
      <NavControls />
      <Routes>
        <Route element={<PageTransition />}>
          <Route path="/page-a" element={<MockPage title="Page A" color="bg-bg-weak" />} />
          <Route path="/page-b" element={<MockPage title="Page B" color="bg-success-lighter" />} />
          <Route path="/page-c" element={<MockPage title="Page C" color="bg-warning-lighter" />} />
        </Route>
      </Routes>
    </MemoryRouter>
  ),
};
