import { RiDeleteBinLine, RiHandHeartLine, RiImageLine, RiSeedlingLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { FIXTURE_WORK_MEDIA } from "../../../../.storybook/fixtures";
import { expectItemRowsFit } from "../../../../.storybook/itemRowFit";
import { IconButton } from "../../IconButton";
import { ItemRow, type ItemRowProps, ItemRowSkeleton } from "./ItemRow";

const photoCount = (count: number) => (
  <>
    <RiImageLine aria-hidden="true" />
    <span aria-hidden="true">{count}</span>
    <span className="sr-only">{`${count} photos`}</span>
  </>
);

const workRow: ItemRowProps = {
  lead: { kind: "photo", src: FIXTURE_WORK_MEDIA[0], mark: photoCount(3) },
  title: "Planted 50 native saplings along the river",
  status: { label: "Pending", tone: "warning" },
  details: ["maria.eth", { text: "2 hr. ago", tone: "soft" }],
  edge: "warning",
};

/** One column of rows at a phone's list width, the way a list stacks them (12px apart). */
function Column({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-(--gg-list-gap)" style={{ width }}>
      {children}
    </div>
  );
}

const meta: Meta<typeof ItemRow> = {
  title: "Shared/Cards/ItemRow",
  component: ItemRow,
  tags: ["autodocs", "storybook-ci"],
  args: { ...workRow, onOpen: fn() },
  parameters: {
    docs: {
      description: {
        component:
          "One item in a list on both surfaces (F7): 88px in every state and language, the item's photo or a 56px icon tile, a one-line title, the one status pill under it, at most two details on one line, and the row's one action in its right slot. The cockpit's density comes from its tokens, so the same row draws 13px titles there.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof ItemRow>;

/** A work row: the photo with its count, the status pill, who and how long ago, the status edge. */
export const Default: Story = {
  render: (args) => (
    <Column width={358}>
      <ItemRow {...args} />
    </Column>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const row = canvas.getByRole("button");
    await expect(row).toHaveAccessibleName(/Planted 50 native saplings.*Pending.*maria\.eth/);
    await userEvent.click(row);
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
    await expectItemRowsFit(canvasElement);
  },
};

/** An item with no picture of its own leads with a centered 56px icon tile. */
export const IconLead: Story = {
  args: {
    lead: { kind: "icon", icon: <RiHandHeartLine /> },
    title: "Water the seedlings every morning",
    status: { label: "Needs you", tone: "warning" },
    details: ["Due Fri", "tomi.eth"],
    edge: undefined,
  },
  render: (args) => (
    <Column width={358}>
      <ItemRow {...args} />
    </Column>
  ),
};

const discard = fn();

/**
 * The one action a row that needs the reader keeps, in its right slot: the row still opens
 * from everywhere else, and the action does not open it.
 */
export const WithAction: Story = {
  render: (args) => (
    <Column width={358}>
      <ItemRow
        {...args}
        action={
          <IconButton
            aria-label="Discard"
            onClick={(event) => {
              event.stopPropagation();
              discard();
            }}
            icon={<RiDeleteBinLine aria-hidden="true" />}
          />
        }
      />
    </Column>
  ),
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Discard" }));
    await expect(discard).toHaveBeenCalledTimes(1);
    await expect(args.onOpen).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: /Planted 50 native saplings/ }));
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
    await expectItemRowsFit(canvasElement);
  },
};

/** Every state, tone and lead in one list keeps one height: nothing makes one row taller. */
export const OneHeight: Story = {
  render: () => (
    <Column width={358}>
      <ItemRow {...workRow} status={{ label: "Approved", tone: "success" }} edge="success" />
      <ItemRow {...workRow} status={{ label: "Rejected", tone: "error" }} edge="error" />
      <ItemRow {...workRow} status={{ label: "Uploading", tone: "info" }} edge="info" />
      <ItemRow {...workRow} status={{ label: "Offline", tone: "neutral" }} edge="neutral" />
      <ItemRow {...workRow} lead={{ kind: "photo", src: null }} title="A work with no photo yet" />
      <ItemRow
        lead={{ kind: "icon", icon: <RiSeedlingLine /> }}
        title="A row with no status and one detail"
        details={["12 works"]}
      />
      <ItemRow
        lead={{ kind: "avatar", src: null }}
        title="A person with no photo"
        status={{ label: "Gardener", tone: "neutral" }}
        details={["2 roles"]}
      />
      <ItemRow {...workRow} title="The record the list has open" selected onOpen={fn()} />
      <ItemRow {...workRow} title="Content, with nothing to open" />
    </Column>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
    // Content takes no focus: only the row that opens something is a button.
    await expect(within(canvasElement).getAllByRole("button")).toHaveLength(1);
  },
};

/**
 * The same rows at the installed app's density and the cockpit's: one row, its title at
 * 15px in the app and 13px in the cockpit (`type-card-title`), the card surface on each
 * surface's own ladder.
 */
export const Densities: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8">
      <section className="flex flex-col gap-2">
        <h3 className="type-label-sm text-text-sub-600">Installed app</h3>
        <Column width={358}>
          <ItemRow {...workRow} onOpen={fn()} />
          <ItemRow
            lead={{ kind: "icon", icon: <RiHandHeartLine /> }}
            title="Water the seedlings every morning"
            status={{ label: "Needs you", tone: "warning" }}
            details={["Due Fri", "tomi.eth"]}
            onOpen={fn()}
          />
        </Column>
      </section>
      <section className="flex flex-col gap-2" data-surface-scope="admin">
        <h3 className="type-label-sm text-text-sub-600">Cockpit</h3>
        <Column width={366}>
          <ItemRow
            {...workRow}
            status={{ label: "Pending", tone: "neutral" }}
            edge="neutral"
            onOpen={fn()}
          />
          <ItemRow
            lead={{ kind: "icon", icon: <RiHandHeartLine /> }}
            title="Water the seedlings every morning"
            status={{ label: "Needs you", tone: "warning" }}
            details={["Due Fri", "tomi.eth"]}
            onOpen={fn()}
          />
        </Column>
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
    const [app, cockpit] = [...canvasElement.querySelectorAll<HTMLElement>("section")];
    const titleSize = (section: HTMLElement) =>
      getComputedStyle(section.querySelector(".gg-item-row-title") as HTMLElement).fontSize;
    await expect(titleSize(app)).toBe("15px");
    await expect(titleSize(cockpit)).toBe("13px");
  },
};

/**
 * A detail line never wraps. At 288px the second detail no longer fits beside the first, so
 * it drops whole, separator and all; a first detail too long on its own ends in an ellipsis.
 */
export const DetailLineDropsWhole: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      {[358, 328, 288].map((width) => (
        <Column key={width} width={width}>
          <ItemRow
            {...workRow}
            details={["chidinma-okonkwo.greengoods.eth", { text: "hace 2 h", tone: "soft" }]}
          />
          <ItemRow
            {...workRow}
            details={[
              "A single detail far too long to fit on one line beside anything",
              "2 hr. ago",
            ]}
          />
        </Column>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expectItemRowsFit(canvasElement);
    const narrow = [...canvasElement.querySelectorAll<HTMLElement>(".gg-item-row")].slice(-2);
    for (const row of narrow) {
      const line = row.querySelector<HTMLElement>(".gg-item-row-details");
      const [, second] = row.querySelectorAll<HTMLElement>(".gg-item-row-detail");
      await expect(second.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        (line as HTMLElement).getBoundingClientRect().bottom - 1
      );
    }
  },
};

/**
 * While a list loads, each row is its own frame with nothing in it: the loaded row's height,
 * and its photo where the loaded row's photo lands, inside the same status edge.
 */
export const Loading: Story = {
  render: () => (
    <Column width={358}>
      <ItemRow {...workRow} onOpen={fn()} />
      <ItemRowSkeleton edge="neutral" />
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const [row, skeleton] = [...canvasElement.querySelectorAll<HTMLElement>(".gg-item-row")];
    await expect(skeleton.getBoundingClientRect().height).toBe(row.getBoundingClientRect().height);
    const photo = (element: HTMLElement) => {
      const box = (
        element.querySelector(".gg-item-row-photo") as HTMLElement
      ).getBoundingClientRect();
      return { left: box.left - element.getBoundingClientRect().left, width: box.width };
    };
    await expect(photo(skeleton)).toEqual(photo(row));
  },
};
