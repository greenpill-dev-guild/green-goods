import type { Meta, StoryObj } from "@storybook/react";
import { MemoryRouter } from "react-router-dom";
import { EditorialReadDeeper } from "./EditorialReadDeeper";

const meta = {
  title: "Public/Atoms/EditorialReadDeeper",
  component: EditorialReadDeeper,
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Quiet pathway from an editorial section into the docs site. Pair a community-flavored link with an optional builder link. Use sparingly — at most one per editorial section, never above the fold.",
      },
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="bg-editorial-warm p-12 max-w-3xl">
          <p className="font-serif text-2xl text-text-strong-950 mb-6">
            Section content above the read-deeper block.
          </p>
          <p className="text-text-sub-600 mb-6 max-w-prose">
            The pattern lives at the end of an editorial section — never as a standalone block. The
            hairline border sets it apart from the content above, but the typography stays in the
            editorial dialect.
          </p>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof EditorialReadDeeper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CommunityAndBuilder: Story = {
  args: {
    community: {
      labelId: "story.community",
      defaultLabel: "How proof works",
      href: "/docs/community/how-it-works",
    },
    builder: {
      labelId: "story.builder",
      defaultLabel: "Why on-chain",
      href: "/docs/builders/architecture",
    },
  },
};

export const CommunityOnly: Story = {
  args: {
    community: {
      labelId: "story.community-only",
      defaultLabel: "How funding flows",
      href: "/docs/community/funder-guide",
    },
  },
};

export const DarkTone: Story = {
  args: {
    community: {
      labelId: "story.dark-community",
      defaultLabel: "How proof works",
      href: "/docs/community/how-it-works",
    },
    builder: {
      labelId: "story.dark-builder",
      defaultLabel: "Why on-chain",
      href: "/docs/builders/architecture",
    },
    tone: "dark",
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="bg-editorial-deep p-12 max-w-3xl">
          <p className="font-serif text-2xl text-editorial-deep-fg mb-6">
            Section on a deep walnut surface.
          </p>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
};
