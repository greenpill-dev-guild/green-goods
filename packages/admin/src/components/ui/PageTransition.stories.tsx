import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { PageTransition } from "./PageTransition";

/**
 * PageTransition wraps `<Outlet />` with a CSS animation keyed on `location.pathname`.
 * Each route change triggers the `animate-page-slide-in` animation.
 *
 * Because the component depends on react-router (useLocation + Outlet),
 * stories must be wrapped in a MemoryRouter with mock routes.
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
        This page content slides in via the animate-page-slide-in animation.
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

export const AnimationPreview: Story = {
  render: () => (
    <div className="space-y-4">
      <p className="text-sm text-text-sub">
        The animation below shows the slide-in effect that fires on each route change. Click the
        buttons above in the Default story to see it in action.
      </p>
      <div className="animate-page-slide-in rounded-xl border border-stroke-soft bg-bg-weak p-8">
        <h2 className="text-lg font-bold text-text-strong">Animated Content</h2>
        <p className="mt-2 text-sm text-text-sub">
          This block uses the same animate-page-slide-in class directly.
        </p>
      </div>
    </div>
  ),
  decorators: [],
};

export const Gallery: Story = {
  render: () => (
    <div className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">Interactive Route Transition</h3>
        <p className="mb-4 text-xs text-text-soft">
          Click buttons to navigate between routes. Each navigation triggers a fresh slide-in
          animation keyed on the pathname.
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
                element={<MockPage title="Page B - Treasury" color="bg-success-lighter" />}
              />
              <Route
                path="/page-c"
                element={<MockPage title="Page C - Actions" color="bg-warning-lighter" />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-medium text-text-sub">Animation Class Preview</h3>
        <div className="animate-page-slide-in rounded-xl border border-stroke-soft bg-bg-weak p-6">
          <p className="text-sm text-text-strong">
            Static preview of the animate-page-slide-in class
          </p>
        </div>
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
