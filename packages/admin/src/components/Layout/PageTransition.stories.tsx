import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { PageTransition } from "./PageTransition";

/**
 * PageTransition wraps `<Outlet />` with close-then-navigate sheet orchestration.
 *
 * On route change:
 * 1. If a sheet is open, calls `onNavigateAway` to save state and close it (300ms)
 * 2. Triggers `document.startViewTransition()` for a cross-fade
 * 3. Calls `onNavigateArrive` to restore any saved sheet state
 *
 * The CSS view-transition keyframes (`view-fade-out` / `view-fade-in`) are
 * defined in `index.css` and applied automatically via `::view-transition-*`.
 */

const meta: Meta<typeof PageTransition> = {
  title: "Admin/UI/PageTransition",
  component: PageTransition,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={["/page-a"]}>
        <Story />
      </MemoryRouter>
    ),
  ],
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
  decorators: [],
};

export const Gallery: Story = {
  render: () => (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">Interactive Route Transition</h3>
        <p className="mb-4 text-xs text-text-soft">
          Click buttons to navigate between routes. Each navigation triggers a View Transitions API
          cross-fade. If a sheet is open, it closes first (300ms), then the view fades.
        </p>
        <MemoryRouter initialEntries={["/page-a"]}>
          <NavControls />
          <Routes>
            <Route element={<PageTransition />}>
              <Route
                path="/page-a"
                element={<MockPage title="Page A - Gardens" color="bg-bg-weak" />}
              />
              <Route
                path="/page-b"
                element={<MockPage title="Page B - Endowments" color="bg-success-lighter" />}
              />
              <Route
                path="/page-c"
                element={<MockPage title="Page C - Actions" color="bg-warning-lighter" />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </section>
    </div>
  ),
  decorators: [],
};

export const DarkMode: Story = {
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
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
