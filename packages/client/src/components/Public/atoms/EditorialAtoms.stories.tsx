import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { expect } from "storybook/test";
import {
  EditorialDivider,
  EditorialDomainChip,
  type EditorialDomain,
  EditorialGhostButton,
  EditorialGhostLink,
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialLinkArrow,
  EditorialMetaRow,
  EditorialNumeral,
  EditorialPrimaryButton,
  EditorialPrimaryLink,
} from "./EditorialAtoms";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-bg-weak-50 p-8">
    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">{title}</p>
    <div className="mt-4">{children}</div>
  </section>
);

const meta: Meta = {
  title: "Client/Public/Editorial Atoms",
  decorators: [
    (Story) => (
      <MemoryRouter>
        {/* The atoms only render on the public website, whose shell sets data-site (DL-026). */}
        <div data-site="website">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Browser editorial atoms — kicker, headings, lede, numerals, dividers, " +
          "buttons, links, domain chips. Two tones: default (ink on linen) and dark " +
          "(foreground on walnut).",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Typography: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Section title="§ Kicker">
        <EditorialKicker>§ 01 — Featured Gardens</EditorialKicker>
      </Section>
      <Section title="§ Headings">
        <div className="flex flex-col gap-6">
          <EditorialHeading size="display" as="h1">
            From good intentions to green outcomes.
          </EditorialHeading>
          <EditorialHeading size="section">Tended places, openly recorded.</EditorialHeading>
          <EditorialHeading size="sub">Riverbend Commons</EditorialHeading>
        </div>
      </Section>
      <Section title="§ Lede">
        <EditorialLede>
          Green Goods makes regenerative work easier to support, turning accessible contributions
          into a trusted public record of how land, water, and community grow healthier together.
        </EditorialLede>
      </Section>
      <Section title="§ Numeral">
        <div className="flex gap-3">
          <EditorialNumeral>i.</EditorialNumeral>
          <EditorialNumeral>ii.</EditorialNumeral>
          <EditorialNumeral>iii.</EditorialNumeral>
          <EditorialNumeral>iv.</EditorialNumeral>
        </div>
      </Section>
    </div>
  ),
};

export const TypographyOnWalnut: Story = {
  render: () => (
    <div className="bg-editorial-deep p-10">
      <EditorialKicker tone="dark">§ 04 — Get In Touch</EditorialKicker>
      <div className="mt-3">
        <EditorialHeading tone="dark" size="section">
          A letter, once a season.
        </EditorialHeading>
      </div>
      <div className="mt-4 max-w-prose">
        <EditorialLede tone="dark">
          Quiet dispatches from the Gardens &mdash; what&apos;s planted, what&apos;s tended,
          what&apos;s ready to be funded.
        </EditorialLede>
      </div>
      <div className="mt-6">
        <EditorialDivider tone="dark" />
      </div>
      <div className="mt-6">
        <EditorialNumeral tone="dark">i.</EditorialNumeral>
      </div>
    </div>
  ),
};

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-col gap-6 bg-bg-weak-50 p-8">
      <div className="flex flex-wrap gap-3">
        <EditorialPrimaryButton>Subscribe</EditorialPrimaryButton>
        <EditorialGhostButton>Schedule a call →</EditorialGhostButton>
      </div>
      <div className="flex flex-wrap gap-3">
        <EditorialPrimaryLink to="/gardens">Explore Gardens</EditorialPrimaryLink>
        <EditorialGhostLink to="/impact">View impact record</EditorialGhostLink>
      </div>
      <div className="flex flex-wrap gap-3">
        <EditorialPrimaryButton disabled>Disabled</EditorialPrimaryButton>
        <EditorialGhostButton disabled>Disabled</EditorialGhostButton>
      </div>
    </div>
  ),
};

/** The shared height steps: lg 48 for hero actions, md 44 for sections and panels, sm 40 for rows. */
export const ButtonSizes: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-col gap-4 bg-bg-weak-50 p-8">
      {(["lg", "md", "sm"] as const).map((size) => (
        <div key={size} className="flex flex-wrap items-center gap-3" data-size-row={size}>
          <EditorialPrimaryButton size={size}>Endow</EditorialPrimaryButton>
          <EditorialGhostButton size={size} variant="warm">
            Manage Endowments
          </EditorialGhostButton>
          <EditorialGhostLink size={size} to="/impact">
            View Public Evidence
          </EditorialGhostLink>
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    for (const [size, height] of [
      ["lg", 48],
      ["md", 44],
      ["sm", 40],
    ] as const) {
      const row = canvasElement.querySelector(`[data-size-row="${size}"]`);
      const actions = Array.from(row?.querySelectorAll<HTMLElement>(".gg-button") ?? []);
      await expect(actions).toHaveLength(3);
      for (const action of actions) {
        const style = getComputedStyle(action);
        await expect(action.getBoundingClientRect().height).toBe(height);
        // Every website button, link or not, is square with a semibold label (DL-029).
        await expect(Number.parseFloat(style.borderTopLeftRadius)).toBe(0);
        await expect(style.fontWeight).toBe("600");
      }
    }
  },
};

export const ButtonsOnWalnut: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3 bg-editorial-deep p-8">
      <EditorialPrimaryButton>Subscribe</EditorialPrimaryButton>
      <EditorialGhostButton tone="dark">Schedule a call →</EditorialGhostButton>
    </div>
  ),
};

export const InlineLinkArrow: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Section title="§ Default tone">
        <EditorialLinkArrow to="/gardens">Browse the living archive</EditorialLinkArrow>
      </Section>
      <div className="bg-editorial-deep p-8">
        <EditorialLinkArrow tone="dark" to="/gardens">
          Or just explore the Gardens
        </EditorialLinkArrow>
      </div>
      <Section title="§ External">
        <EditorialLinkArrow external to="https://greenpill.network">
          The Manifesto
        </EditorialLinkArrow>
      </Section>
    </div>
  ),
};

export const MetaRowExample: Story = {
  render: () => (
    <Section title="§ Meta row">
      <EditorialMetaRow
        items={[
          { label: "Hudson Valley, NY" },
          { label: "47 contributors" },
          { label: "312 entries of work" },
        ]}
      />
    </Section>
  ),
};

const DOMAIN_DEMOS: Array<{ id: EditorialDomain; label: string; count: number }> = [
  { id: "all", label: "All", count: 19 },
  { id: "solar", label: "Solar", count: 4 },
  { id: "agro", label: "Agroforestry", count: 7 },
  { id: "education", label: "Education", count: 5 },
  { id: "waste", label: "Waste", count: 3 },
];

export const DomainChips: Story = {
  render: () => {
    const ChipBar = () => {
      const [active, setActive] = useState<EditorialDomain>("all");
      return (
        <div className="flex flex-wrap gap-2">
          {DOMAIN_DEMOS.map((entry) => (
            <EditorialDomainChip
              key={entry.id}
              domain={entry.id}
              active={active === entry.id}
              count={entry.count}
              onClick={() => setActive(entry.id)}
            >
              {entry.label}
            </EditorialDomainChip>
          ))}
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-8 bg-bg-weak-50 p-8">
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
            § Inactive (default)
          </p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_DEMOS.map((entry) => (
              <EditorialDomainChip
                key={entry.id}
                domain={entry.id}
                active={false}
                count={entry.count}
                onClick={() => undefined}
              >
                {entry.label}
              </EditorialDomainChip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
            § Active per domain
          </p>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_DEMOS.map((entry) => (
              <EditorialDomainChip
                key={entry.id}
                domain={entry.id}
                active
                count={entry.count}
                onClick={() => undefined}
              >
                {entry.label}
              </EditorialDomainChip>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-text-soft-400">
            § Live (click to toggle)
          </p>
          <ChipBar />
        </div>
      </div>
    );
  },
};

export const Divider: Story = {
  render: () => (
    <div className="flex flex-col gap-6">
      <Section title="§ Default">
        <div className="flex flex-col gap-4">
          <EditorialKicker>Above</EditorialKicker>
          <EditorialDivider />
          <EditorialKicker>Below</EditorialKicker>
        </div>
      </Section>
      <div className="bg-editorial-deep p-8">
        <div className="flex flex-col gap-4">
          <EditorialKicker tone="dark">Above</EditorialKicker>
          <EditorialDivider tone="dark" />
          <EditorialKicker tone="dark">Below</EditorialKicker>
        </div>
      </div>
    </div>
  ),
};
