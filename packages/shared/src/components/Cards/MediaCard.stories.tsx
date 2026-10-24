import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, within } from "storybook/test";
import FENCE_AFTER from "../../../.storybook/fixture-art/documentation-fence-after.jpg?url";
import SEEDLINGS from "../../../.storybook/fixture-art/documentation-seedlings.jpg?url";
import { StatusBadge } from "../StatusBadge";
import { MediaCard, type MediaCardProps } from "./MediaCard";

function Photo({ src }: { src: string }) {
  return <img src={src} alt="" className="h-full w-full object-cover" />;
}

/** A picture-less object draws its own fallback; a tint stands in for one here. */
function NoPicture() {
  return <div className="h-full w-full bg-bg-soft" />;
}

const BASE: MediaCardProps = {
  media: <Photo src={SEEDLINGS} />,
  mediaLabel: "Agroforestry",
  mediaCount: "1 / 3",
  title: "Planted 50 native saplings along the ridge",
  status: <StatusBadge status="approved" size="xs" />,
  subtitle: "Planting event",
  details: "maria.eth",
  detailsEnd: "2 hr. ago",
};

const meta: Meta<typeof MediaCard> = {
  title: "Shared/Cards/MediaCard",
  component: MediaCard,
  tags: ["autodocs", "storybook-ci"],
  args: { ...BASE, onClick: fn() },
  argTypes: {
    layout: { control: "inline-radio", options: ["stacked", "wide"] },
    selected: { control: "boolean" },
  },
  parameters: {
    docs: {
      description: {
        component:
          "The card shape for an object with a picture of its own (work, gardens, actions, impact certificates). Stacked puts the picture on top; wide puts it in a 144px column on the left with the text centered beside it. The card draws the shared card surface (`gg-card`): a 24px corner, a hairline edge and a faint shadow. One title line, the status pill under it, one optional line, one detail line; the photo count and the domain sit on the picture.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof MediaCard>;

export const Stacked: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: 340 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("button");
    await expect(card).toHaveAttribute("data-layout", "stacked");
    await expect(within(card).getByRole("heading")).toHaveAttribute("title", BASE.title);
  },
};

export const Wide: Story = {
  args: { layout: "wide" },
  decorators: [
    (Story) => (
      <div style={{ width: 560 }}>
        <Story />
      </div>
    ),
  ],
  play: async ({ canvasElement }) => {
    const card = within(canvasElement).getByRole("button");
    await expect(card).toHaveAttribute("data-layout", "wide");
    await expect(within(card).getByText("1 / 3")).toBeVisible();
  },
};

/** Every state at both layouts: a picture or none, a line under the status or none, selected, and a card that opens nothing. */
export const StateCatalog: Story = {
  render: () => {
    const states: Array<{ label: string; props: Partial<MediaCardProps> }> = [
      { label: "Photo", props: {} },
      {
        label: "No picture, no count",
        props: { media: <NoPicture />, mediaCount: undefined, subtitle: "" },
      },
      {
        label: "Long title and label",
        props: {
          title:
            "Organized a community-wide composting workshop with hands-on training for 25 families",
          mediaLabel: "Agroforestería",
          media: <Photo src={FENCE_AFTER} />,
        },
      },
      { label: "Selected", props: { selected: true } },
      { label: "Opens nothing", props: { onClick: undefined } },
    ];
    return (
      <div className="flex flex-col gap-8 p-4">
        {(["stacked", "wide"] as const).map((layout) => (
          <section key={layout} className="flex flex-col gap-3">
            <h2 className="type-title-sm text-text-strong">{layout}</h2>
            <ul
              className="grid list-none gap-3 p-0"
              style={{
                gridTemplateColumns: `repeat(auto-fill, minmax(${layout === "wide" ? 26 : 18}rem, 1fr))`,
              }}
            >
              {states.map(({ label, props }) => (
                <li key={label} className="flex min-w-0 flex-col gap-1.5">
                  <span className="type-meta text-text-soft">{label}</span>
                  <MediaCard {...BASE} onClick={() => {}} layout={layout} {...props} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  },
};

/** The cockpit draws the same card at its own density: its type roles and its card ground and edge. */
export const InTheCockpit: Story = {
  parameters: { surface: "admin" },
  render: () => (
    <div
      className="grid gap-3.5 p-6"
      style={{
        width: 1176,
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 26rem), 1fr))",
      }}
    >
      <MediaCard {...BASE} layout="wide" onClick={() => {}} />
      <MediaCard
        {...BASE}
        layout="wide"
        media={<NoPicture />}
        mediaLabel="Education"
        mediaCount={undefined}
        title="Water quality readings, north stream"
        subtitle={undefined}
        details="0x7B2e…41C9"
        detailsEnd="3 days ago"
        onClick={() => {}}
      />
    </div>
  ),
};
