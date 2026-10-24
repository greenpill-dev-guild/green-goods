import {
  RiExternalLinkLine,
  RiPencilLine,
  RiShieldCheckLine,
  RiTimeLine,
  RiUserLine,
} from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import { type ReactNode, useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button } from "../Button";
import { Switch } from "../Form/ControlPrimitives";
import { IconButton } from "../IconButton";
import { FactList, FactRow } from "./FactRow";

/** A work's facts, in the order a steward reads them before approving. */
const WORK_FACTS: Array<[string, string]> = [
  ["Action", "Plant native saplings"],
  ["Submitted", "12 Oct 2026, 9:40"],
  ["Photos", "3"],
  ["Confirms it", "chidi.eth"],
  ["Reward", "0.01 WETH"],
];

function Column({ width, children }: { width: number; children: ReactNode }) {
  return <div style={{ width }}>{children}</div>;
}

const meta: Meta<typeof FactRow> = {
  title: "Shared/Cards/FactRow",
  component: FactRow,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    docs: {
      description: {
        component:
          "The facts about one thing on both surfaces (DL-109): a label beside its value in divided rows, the label in the narrower column and the quieter ink, a value that wraps rather than being cut, and the row's one action in its right slot. A row with no value is a setting: its label names the control there and reads as a field title. Each surface's type roles set the density.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof FactRow>;

/** A record's facts as a card of their own: what a steward checks before approving. */
export const Default: Story = {
  render: () => (
    <Column width={358}>
      <FactList aria-label="Work">
        {WORK_FACTS.map(([label, value]) => (
          <FactRow key={label} label={label} value={value} />
        ))}
      </FactList>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // A description list, so a screen reader hears each label with its value.
    await expect(canvas.getAllByRole("term")).toHaveLength(WORK_FACTS.length);
    await expect(canvas.getAllByRole("definition")).toHaveLength(WORK_FACTS.length);
    // The label takes the narrower column and the quieter ink.
    const row = canvasElement.querySelector<HTMLElement>(".gg-fact-row")!;
    const [term, value] = [...row.children] as HTMLElement[];
    await expect(term.getBoundingClientRect().width).toBeLessThan(
      value.getBoundingClientRect().width
    );
    const label = term.querySelector<HTMLElement>(".gg-fact-label")!;
    await expect(getComputedStyle(label).color).not.toBe(getComputedStyle(value).color);
    await expect(getComputedStyle(value).fontWeight).toBe("500");
  },
};

/**
 * A review before a send: each fact keeps its Edit in the right slot, beside the value, so the
 * row stays one line where the value fits.
 */
export const WithAction: Story = {
  render: () => (
    <Column width={358}>
      <FactList aria-label="Review">
        <FactRow
          label="To"
          value="maria.eth"
          valueTitle="0x5a3B9c2d1e4F6a7B8c9D0e1F2a3B4c5D6e7F8a9B"
          action={
            <IconButton
              size="sm"
              emphasis="tertiary"
              aria-label="Edit To"
              icon={<RiPencilLine />}
              onClick={fn()}
            />
          }
        />
        <FactRow
          label="Amount"
          value="12.5 G$"
          action={
            <IconButton
              size="sm"
              emphasis="tertiary"
              aria-label="Edit Amount"
              icon={<RiPencilLine />}
              onClick={fn()}
            />
          }
        />
        <FactRow
          label="Vault"
          value="0x5a3B…8a9B"
          action={
            <a
              href="https://celoscan.io"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1 type-meta text-primary-dark"
            >
              <RiExternalLinkLine className="h-4 w-4" aria-hidden />
              <span className="sr-only">Opens in Celo Explorer</span>
            </a>
          }
        />
      </FactList>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const edit = canvas.getByRole("button", { name: "Edit To" });
    // The action sits at the row's end, after the value.
    const row = edit.closest<HTMLElement>(".gg-fact-row")!;
    const value = row.querySelector<HTMLElement>(".gg-fact-value")!;
    await expect(edit.getBoundingClientRect().left).toBeGreaterThan(
      value.getBoundingClientRect().left
    );
    await expect(value).toHaveAttribute("title", "0x5a3B9c2d1e4F6a7B8c9D0e1F2a3B4c5D6e7F8a9B");
  },
};

function SettingsList() {
  const [open, setOpen] = useState(true);
  return (
    <FactList aria-label="Settings">
      <FactRow
        labelId="story-open-joining"
        label="Open joining"
        description="Anyone can ask to join; a steward approves each request."
        action={
          <Switch checked={open} onCheckedChange={setOpen} aria-labelledby="story-open-joining" />
        }
      />
      <FactRow
        label="Update"
        description="Check for a newer version."
        action={
          <Button emphasis="secondary" size="sm" className="w-[120px]">
            Check
          </Button>
        }
      />
    </FactList>
  );
}

/**
 * A settings list: each row's label names the control in its right slot and reads as a field
 * title, never quieter than the fields beside it; the hint sits under it.
 */
export const Settings: Story = {
  render: () => (
    <Column width={358}>
      <SettingsList />
    </Column>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const toggle = canvas.getByRole("switch", { name: "Open joining" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    const label = canvasElement.querySelector<HTMLElement>("#story-open-joining")!;
    await expect(label).toHaveClass("gg-field-label");
    await expect(getComputedStyle(label).fontWeight).toBe("500");
  },
};

/** Rows inside a frame that already exists (a dialog section, a card): no card of their own. */
export const Inset: Story = {
  render: () => (
    <Column width={358}>
      <section className="gg-card space-y-2 p-4">
        <h3 className="type-title-sm text-text-strong-950">Each promise</h3>
        <FactList frame="inset">
          <FactRow label="Kind" value="Garden work" />
          <FactRow label="Due" value="24 Oct 2026, 17:00 WAT" />
          <FactRow label="Reward" value="40 G$ when kept" />
        </FactList>
      </section>
    </Column>
  ),
};

/**
 * A long value wraps in its column, an address breaks anywhere, and a long Portuguese label
 * wraps in its own; nothing is cut.
 */
export const LongValues: Story = {
  render: () => (
    <Column width={288}>
      <FactList aria-label="Assessment">
        <FactRow
          label="Diagnóstico"
          value={
            "As famílias da Rua 5 dependem de geradores a diesel quatro horas por dia.\nO custo do combustível limita o uso produtivo da eletricidade."
          }
        />
        <FactRow label="Conta registrada" value="0x5a3B9c2d1e4F6a7B8c9D0e1F2a3B4c5D6e7F8a9B" />
        <FactRow label="Permissão do Safe restante por período" value="1.250,00 G$" />
      </FactList>
    </Column>
  ),
  play: async ({ canvasElement }) => {
    for (const value of canvasElement.querySelectorAll<HTMLElement>(".gg-fact-value")) {
      await expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
    }
    // The line break the steward typed survives.
    const [diagnosis] = canvasElement.querySelectorAll<HTMLElement>(".gg-fact-value");
    await expect(getComputedStyle(diagnosis).whiteSpace).toBe("pre-line");
  },
};

/** Where a screen marks each fact, as the app's promise pages do, a glyph leads the label. */
export const WithIcons: Story = {
  render: () => (
    <Column width={358}>
      <FactList aria-label="Promise">
        <FactRow icon={<RiTimeLine />} label="Due" value="Oct 31, 2026" />
        <FactRow icon={<RiUserLine />} label="Who does it" value="tomi.eth" />
        <FactRow
          icon={<RiShieldCheckLine />}
          label="Who confirms"
          value="chidi.eth"
          description="A steward of the garden"
        />
      </FactList>
    </Column>
  ),
};

/**
 * The same facts at each surface's density: the label on `type-label-sm` and the value on
 * `type-body`, 14px and 16px in the app, 12px and 14px in the cockpit.
 */
export const Densities: Story = {
  render: () => (
    <div className="flex flex-wrap gap-8">
      <section className="flex flex-col gap-2">
        <h3 className="type-label-sm text-text-sub-600">Installed app</h3>
        <Column width={358}>
          <FactList>
            {WORK_FACTS.slice(0, 3).map(([label, value]) => (
              <FactRow key={label} label={label} value={value} />
            ))}
          </FactList>
        </Column>
      </section>
      <section className="flex flex-col gap-2" data-surface-scope="admin">
        <h3 className="type-label-sm text-text-sub-600">Cockpit</h3>
        <Column width={366}>
          <FactList>
            {WORK_FACTS.slice(0, 3).map(([label, value]) => (
              <FactRow key={label} label={label} value={value} />
            ))}
          </FactList>
        </Column>
      </section>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const [app, cockpit] = [...canvasElement.querySelectorAll<HTMLElement>("section")];
    const size = (section: HTMLElement, part: string) =>
      getComputedStyle(section.querySelector(part) as HTMLElement).fontSize;
    await expect(size(app, ".gg-fact-label")).toBe("14px");
    await expect(size(app, ".gg-fact-value")).toBe("16px");
    await expect(size(cockpit, ".gg-fact-label")).toBe("12px");
    await expect(size(cockpit, ".gg-fact-value")).toBe("14px");
  },
};
