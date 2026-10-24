import { RiLeafLine, RiTimeLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { withAdminPrimitiveFrame } from "../../../shared/.storybook/decorators";
import { drawnRings } from "../../../shared/.storybook/design-system/measure";
import { AdminFilterChip } from "./AdminFilterChip";

const meta: Meta<typeof AdminFilterChip> = {
  title: "Admin/Primitives/AdminFilterChip",
  component: AdminFilterChip,
  tags: ["autodocs"],
  decorators: [withAdminPrimitiveFrame],
  parameters: {
    docs: {
      description: {
        component:
          "The cockpit's filter chip: a 32px capsule with a 44px hit area, outlined when unselected and filled with the workspace tone's action color when selected, the installed app's selected look (DL-101). Selection shows by fill alone, with no check mark, so a chip keeps its width when chosen (DL-065); an optional leading icon shows in both states.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof AdminFilterChip>;

export const Unselected: Story = {
  args: {
    label: "Pending",
    selected: false,
    leadingIcon: RiTimeLine,
    onToggle: () => {},
  },
};

export const Selected: Story = {
  args: {
    label: "Pending",
    selected: true,
    leadingIcon: RiTimeLine,
    onToggle: () => {},
  },
};

export const Disabled: Story = {
  args: {
    label: "Archived",
    selected: false,
    disabled: true,
    onToggle: () => {},
  },
};

export const StateCatalog: Story = {
  render: () => {
    const Catalog = () => {
      const [active, setActive] = useState<Set<string>>(new Set(["pending", "approved"]));
      const toggle = (id: string) =>
        setActive((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });

      return (
        <div className="flex flex-wrap gap-2">
          <AdminFilterChip
            label="Pending"
            leadingIcon={RiTimeLine}
            selected={active.has("pending")}
            onToggle={() => toggle("pending")}
          />
          <AdminFilterChip
            label="Harvested"
            leadingIcon={RiLeafLine}
            selected={active.has("harvested")}
            onToggle={() => toggle("harvested")}
          />
          <AdminFilterChip
            label="Approved"
            selected={active.has("approved")}
            onToggle={() => toggle("approved")}
          />
          <AdminFilterChip label="Archived" selected={false} disabled onToggle={() => {}} />
        </div>
      );
    };

    return <Catalog />;
  },
};

const WORKSPACE_TONES = [
  ["hub", "Hub"],
  ["garden", "Garden"],
  ["community", "Community"],
  ["actions", "Actions"],
] as const;

/** Pending and Approved as the Hub draws them: two scopes of one list (DL-082). */
const ScopePair = () => {
  const [scope, setScope] = useState<"pending" | "approved">("pending");
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Work scope">
      <AdminFilterChip
        label="Pending"
        selected={scope === "pending"}
        onToggle={() => setScope("pending")}
      />
      <AdminFilterChip
        label="Approved"
        selected={scope === "approved"}
        onToggle={() => setScope("approved")}
      />
    </div>
  );
};

const ChipToneMatrix = ({ theme }: { theme: "light" | "dark" }) => (
  <section
    data-theme={theme}
    className="admin-m3 rounded-[var(--m3-shape-lg)] bg-[rgb(var(--m3-surface))] p-4"
  >
    <div className="mb-3 type-label-sm font-semibold uppercase text-[rgb(var(--m3-on-surface-variant))]">
      {theme}
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {WORKSPACE_TONES.map(([tone, label]) => (
        <div
          key={`${theme}-${tone}`}
          data-tone={tone}
          data-testid={`${theme}-${tone}`}
          className="rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-low))] p-3"
        >
          <div className="mb-2 type-label-sm font-medium text-[rgb(var(--m3-on-surface-variant))]">
            {label}
          </div>
          <ScopePair />
        </div>
      ))}
    </div>
  </section>
);

/** A token's channel triple ("37 71 208") as the color the browser computes. */
const channelColor = (scope: Element, token: string) =>
  `rgb(${getComputedStyle(scope).getPropertyValue(token).trim().split(/\s+/).join(", ")})`;

/**
 * Each workspace's chips in light and dark. A selected chip takes its tone's
 * action fill and ink, the installed app's selected look in the workspace tone
 * (DL-101). The play test walks every scope by keyboard: the capsule, the tone
 * pair, a focus ring that stands off the selected fill, and a width that holds
 * when the selection moves (DL-065).
 */
export const WorkspaceToneMatrix: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="space-y-4">
      <ChipToneMatrix theme="light" />
      <ChipToneMatrix theme="dark" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Scopes in reading order, so each Tab reaches the next chip.
    for (const theme of ["light", "dark"] as const) {
      for (const [tone] of WORKSPACE_TONES) {
        const scope = within(canvasElement).getByTestId(`${theme}-${tone}`);
        const pending = within(scope).getByRole("button", { name: "Pending" });
        const approved = within(scope).getByRole("button", { name: "Approved" });
        const widths = [pending, approved].map((chip) => chip.getBoundingClientRect().width);

        for (const chip of [pending, approved]) {
          await expect(
            Number.parseFloat(getComputedStyle(chip).borderTopLeftRadius)
          ).toBeGreaterThanOrEqual(chip.getBoundingClientRect().height / 2);
        }
        await expect(pending).toHaveAttribute("aria-pressed", "true");
        await expect(getComputedStyle(pending).backgroundColor).toBe(
          channelColor(scope, "--tone-action")
        );
        await expect(getComputedStyle(pending).color).toBe(channelColor(scope, "--tone-on-action"));

        // The ring draws 2px off the fill: the offset ring, then the ring in
        // the tone's focus color.
        await userEvent.tab();
        await expect(pending).toHaveFocus();
        await waitFor(() => expect(drawnRings(pending)).toHaveLength(2));
        await expect(drawnRings(pending)[1]).toContain(channelColor(scope, "--tone-focus-ring"));

        await userEvent.tab();
        await userEvent.keyboard(" ");
        await expect(approved).toHaveAttribute("aria-pressed", "true");
        await expect(pending).toHaveAttribute("aria-pressed", "false");
        await expect([pending, approved].map((chip) => chip.getBoundingClientRect().width)).toEqual(
          widths
        );
        await waitFor(() =>
          expect(getComputedStyle(approved).backgroundColor).toBe(
            channelColor(scope, "--tone-action")
          )
        );
      }
    }
  },
};
