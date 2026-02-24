import type { Meta, StoryObj } from "@storybook/react";
import { SkeletonText, SkeletonCard, SkeletonGrid } from "./Skeleton";

// --- SkeletonText ---

const textMeta: Meta<typeof SkeletonText> = {
  title: "Admin/UI/SkeletonText",
  component: SkeletonText,
  tags: ["autodocs"],
  argTypes: {
    lines: {
      control: { type: "number", min: 1, max: 10 },
      description: "Number of skeleton text lines to render",
    },
    width: {
      control: "text",
      description:
        "CSS width for all lines. When omitted, the last line is automatically shortened to 2/3 width.",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the container",
    },
  },
};

export default textMeta;
type TextStory = StoryObj<typeof SkeletonText>;

export const Default: TextStory = {
  args: {
    lines: 3,
  },
};

export const SingleLine: TextStory = {
  args: {
    lines: 1,
  },
};

export const FixedWidth: TextStory = {
  args: {
    lines: 4,
    width: "200px",
  },
};

export const ManyLines: TextStory = {
  args: {
    lines: 8,
  },
};

// --- SkeletonCard stories rendered via the Gallery ---

export const CardDefault: StoryObj<typeof SkeletonCard> = {
  render: () => (
    <div className="max-w-md">
      <SkeletonCard />
    </div>
  ),
};

export const CardHeaderOnly: StoryObj<typeof SkeletonCard> = {
  render: () => (
    <div className="max-w-md">
      <SkeletonCard hasBody={false} />
    </div>
  ),
};

export const CardBodyOnly: StoryObj<typeof SkeletonCard> = {
  render: () => (
    <div className="max-w-md">
      <SkeletonCard hasHeader={false} />
    </div>
  ),
};

// --- SkeletonGrid stories ---

export const GridDefault: StoryObj<typeof SkeletonGrid> = {
  render: () => <SkeletonGrid />,
};

export const GridTwoColumns: StoryObj<typeof SkeletonGrid> = {
  render: () => <SkeletonGrid count={4} columns={2} />,
};

export const GridFourColumns: StoryObj<typeof SkeletonGrid> = {
  render: () => <SkeletonGrid count={8} columns={4} />,
};

// --- Gallery ---

export const Gallery: StoryObj = {
  render: () => (
    <div className="space-y-10">
      <section>
        <h3 className="mb-4 text-sm font-medium text-text-sub">SkeletonText</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-xs text-text-soft">1 line</p>
            <SkeletonText lines={1} />
          </div>
          <div>
            <p className="mb-2 text-xs text-text-soft">3 lines (default)</p>
            <SkeletonText lines={3} />
          </div>
          <div>
            <p className="mb-2 text-xs text-text-soft">Fixed width (150px)</p>
            <SkeletonText lines={3} width="150px" />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-medium text-text-sub">SkeletonCard</h3>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <div>
            <p className="mb-2 text-xs text-text-soft">Full card</p>
            <SkeletonCard />
          </div>
          <div>
            <p className="mb-2 text-xs text-text-soft">Header only</p>
            <SkeletonCard hasBody={false} />
          </div>
          <div>
            <p className="mb-2 text-xs text-text-soft">Body only</p>
            <SkeletonCard hasHeader={false} />
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-sm font-medium text-text-sub">SkeletonGrid (3 columns)</h3>
        <SkeletonGrid count={3} columns={3} />
      </section>
    </div>
  ),
};

export const DarkMode: TextStory = {
  args: {
    lines: 3,
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const DarkModeCards: StoryObj = {
  render: () => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
      <SkeletonCard />
      <SkeletonCard hasBody={false} />
      <SkeletonCard hasHeader={false} />
    </div>
  ),
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};
