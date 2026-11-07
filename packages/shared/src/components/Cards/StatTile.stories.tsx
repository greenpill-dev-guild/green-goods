import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";
import { FactList, FactRow } from "./FactRow";
import { StatTile } from "./StatTile";

const meta: Meta<typeof StatTile> = {
  title: "Shared/Cards/StatTile",
  component: StatTile,
  tags: ["autodocs"],
  args: { label: "Approved work", value: "24", delta: "3 more than the previous period" },
};
export default meta;
type Story = StoryObj<typeof StatTile>;

export const Default: Story = {};
export const WithoutDelta: Story = { args: { delta: undefined } };
export const Unavailable: Story = { args: { value: "—", delta: "Could not load this value" } };
export const Empty: Story = { args: { value: "0", delta: "No change" } };

/** The required DL-136 pair, rendered before any route adopts StatTile. */
export const CockpitPair: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div data-surface-scope="admin" className="grid gap-4 sm:grid-cols-2">
      <section className="gg-card space-y-3 p-4" aria-label="Before">
        <h2 className="type-title-md font-semibold text-text-strong">Garden Health · Before</h2>
        <p className="type-meta text-text-sub">Work approved this period</p>
        <div>
          <p className="type-label-sm text-text-soft">Approved work</p>
          <p className="type-title-md font-semibold text-text-strong">24</p>
          <p className="type-meta text-text-soft">3 more than the previous period</p>
        </div>
        <FactList frame="inset">
          <FactRow label="Pending work" value="8" />
        </FactList>
      </section>
      <section className="gg-card space-y-3 p-4" aria-label="After">
        <h2 className="type-title-md font-semibold text-text-strong">Garden Health · After</h2>
        <p className="type-body text-text-sub">Work approved this period</p>
        <StatTile label="Approved work" value="24" delta="3 more than the previous period" />
        <FactList frame="inset">
          <FactRow label="Pending work" value="8" />
        </FactList>
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const tile = canvasElement.querySelector('[data-component="StatTile"]')!;
    const [label, value, delta] = [...tile.children];
    await expect(getComputedStyle(label).fontSize).toBe("12px");
    await expect(getComputedStyle(label).fontWeight).toBe("500");
    await expect(getComputedStyle(value).fontSize).toBe("22px");
    await expect(getComputedStyle(value).fontWeight).toBe("600");
    await expect(getComputedStyle(delta).fontSize).toBe("12px");
  },
};
