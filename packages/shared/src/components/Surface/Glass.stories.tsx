import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Primitives/Glass",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Glass material tiers — `.glass-ground`, `.glass-raised`, `.glass-floating`, `.glass-overlay`, and `.glass-surface`. Reserved for navigation-tier chrome and overlays (TopContextBar, NavigationBar, sheets, MainSheet). Content surfaces stay solid by default. All tiers flatten to solid --neutral-0 / --neutral-900 with 1px high-contrast stroke under `@media (prefers-contrast: more)`.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

const GlassSample = ({ className, label }: { className: string; label: string }) => (
  <div className={`${className} rounded-xl p-5`}>
    <div className="text-label-md text-text-strong-950">{label}</div>
    <div className="mt-1 text-paragraph-sm text-text-sub-600">
      Translucent tier — backdrop blur + tint + inset ring
    </div>
  </div>
);

const Backdrop: React.FC<React.PropsWithChildren<{ className?: string }>> = ({
  children,
  className,
}) => (
  <div
    className={`relative overflow-hidden rounded-2xl ${className ?? ""}`}
    style={{
      backgroundImage:
        "radial-gradient(circle at 20% 20%, rgba(34,197,94,0.35), transparent 40%), radial-gradient(circle at 80% 30%, rgba(59,130,246,0.35), transparent 40%), radial-gradient(circle at 50% 80%, rgba(245,158,11,0.3), transparent 45%)",
      backgroundColor: "rgb(var(--neutral-100))",
    }}
  >
    <div className="p-6">{children}</div>
  </div>
);

export const Tiers: Story = {
  render: () => (
    <Backdrop className="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassSample className="glass-ground" label="glass-ground" />
        <GlassSample className="glass-raised" label="glass-raised" />
        <GlassSample className="glass-floating" label="glass-floating" />
        <GlassSample className="glass-overlay" label="glass-overlay" />
      </div>
    </Backdrop>
  ),
};

export const Surface: Story = {
  render: () => (
    <Backdrop className="max-w-xl">
      <GlassSample className="glass-surface" label="glass-surface (MainSheet)" />
    </Backdrop>
  ),
  parameters: {
    docs: {
      description: {
        story:
          "`.glass-surface` is the MainSheet tier — lighter than `.glass-ground`, heavier than `.glass-floating`. Used only on the MainSheet content pane, not on content cards within it.",
      },
    },
  },
};

export const DarkMode: Story = {
  decorators: [
    (Story) => (
      <div data-theme="dark" className="rounded-3xl bg-[rgb(var(--neutral-950))] p-6">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <Backdrop>
      <div className="grid gap-4 sm:grid-cols-2">
        <GlassSample className="glass-ground" label="glass-ground (dark)" />
        <GlassSample className="glass-raised" label="glass-raised (dark)" />
        <GlassSample className="glass-floating" label="glass-floating (dark)" />
        <GlassSample className="glass-overlay" label="glass-overlay (dark)" />
      </div>
    </Backdrop>
  ),
};
