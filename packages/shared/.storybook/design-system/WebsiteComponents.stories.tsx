import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, within } from "storybook/test";
import {
  type EditorialDomain,
  EditorialDomainChip,
  EditorialGhostButton,
  EditorialPrimaryButton,
} from "../../../client/src/components/Public/atoms/EditorialAtoms";
import {
  ButtonMatrix,
  ButtonStates,
  Chips,
  Fields,
  HitAreas,
  IconButtons,
} from "./clientSpecimens";
import { Page, Row, Section, Specimen, StoryLink } from "./measure";
import { APP_SIZES, STORY_LINKS, WEBSITE } from "./rules";

const meta = {
  title: "Design System/Website/Components",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    surface: "website",
    docs: {
      description: {
        component:
          "The public website's controls: the same shared family inside data-site=\"website\", where every button is square with a semibold label (DL-024, DL-026, DL-029), plus the editorial atoms that wrap it and the underline field. Measured live against the website rules.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const DOMAINS: Array<[EditorialDomain, string, number]> = [
  ["all", "All", 50],
  ["solar", "Solar", 12],
  ["agro", "Agroforestry", 31],
  ["education", "Education", 7],
  ["waste", "Waste", 0],
];

function EditorialAtoms() {
  const [domain, setDomain] = useState<EditorialDomain>("all");
  return (
    <>
      <Row>
        <Specimen title="EditorialPrimaryButton · md" expect={WEBSITE.button("md")}>
          <EditorialPrimaryButton>Subscribe</EditorialPrimaryButton>
        </Specimen>
        <Specimen title="EditorialGhostButton · ghost / warm" target=".gg-button" all expect={WEBSITE.button("md")}>
          <EditorialGhostButton>Schedule a Call →</EditorialGhostButton>
          <EditorialGhostButton variant="warm">Endow</EditorialGhostButton>
        </Specimen>
        <Specimen title="row actions · sm 40" target=".gg-button" all expect={WEBSITE.button("sm")}>
          <EditorialPrimaryButton size="sm">Donate</EditorialPrimaryButton>
          <EditorialGhostButton size="sm" variant="warm">
            Endow
          </EditorialGhostButton>
        </Specimen>
        <Specimen title="hero · lg 48" expect={WEBSITE.button("lg")}>
          <EditorialPrimaryButton size="lg">Explore Gardens</EditorialPrimaryButton>
        </Specimen>
        <Specimen
          title="on walnut · dark tone"
          target=".gg-button"
          all
          expect={WEBSITE.button("md")}
          wide
        >
          <div className="flex w-full flex-wrap items-center gap-3 bg-editorial-deep p-4">
            <EditorialPrimaryButton>Subscribe</EditorialPrimaryButton>
            <EditorialGhostButton tone="dark">Read the Journal</EditorialGhostButton>
          </div>
        </Specimen>
        <Specimen title="EditorialDomainChip" target=".gg-chip" all expect={WEBSITE.chip("compact")} wide>
          <div className="flex flex-wrap gap-2">
            {DOMAINS.map(([key, label, count]) => (
              <EditorialDomainChip
                key={key}
                domain={key}
                active={domain === key}
                count={count}
                onClick={() => setDomain(key)}
              >
                {label}
              </EditorialDomainChip>
            ))}
          </div>
        </Specimen>
      </Row>
    </>
  );
}

/** Every emphasis, tone, size, and state on the website surface, plus the editorial atoms. */
export const Buttons: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <Page
      title="Public website · Components"
      lede="The same primitives as the app, square and semibold on the website. Editorial atoms are thin wrappers that only add the dialect's colours; cards, dialogs, panels, and buttons are all square, while icon buttons stay circles and chips capsules."
    >
      <Section id="buttons" title="Button" lede={WEBSITE.rules[0]}>
        {APP_SIZES.map((size) => (
          <div key={size} style={{ marginBottom: 12 }}>
            <ButtonMatrix rules={WEBSITE} size={size} />
          </div>
        ))}
        <ButtonStates rules={WEBSITE} />
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.sharedButtonWebsite}>Shared/Primitives/Button › WebsiteSurface</StoryLink>
        </div>
      </Section>
      <Section id="editorial" title="Editorial atoms" lede="EditorialPrimaryButton, EditorialGhostButton (ghost, warm, dark tone), and EditorialDomainChip pass size through to the shared primitive and add only colour.">
        <EditorialAtoms />
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.editorialAtoms}>Client/Public/Editorial Atoms</StoryLink>
        </div>
      </Section>
      <Section id="icon-buttons" title="IconButton" lede="Circles on the website too; the close on an editorial dialog is the md circle.">
        <IconButtons rules={WEBSITE} />
      </Section>
      <Section id="chips" title="Chip" lede="Capsules; the editorial domain chip colours the active state with the domain's ink instead of green.">
        <Chips rules={WEBSITE} />
      </Section>
      <Section id="fields" title="Fields" lede="The editorial underline field on editorial sections (no box, hairline in the text colour, serif text) and the 16px shared field inside funding and account panels.">
        <Fields rules={WEBSITE} website />
      </Section>
      <Section id="hit-areas" title="Hit areas">
        <HitAreas rules={WEBSITE} />
      </Section>
    </Page>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const px = (value: string) => Number.parseFloat(value);
    // Every button except the specimen that simulates the pressed corner.
    const buttons = Array.from(
      canvasElement.querySelectorAll<HTMLElement>(".gg-button[data-emphasis]")
    ).filter((button) => !button.closest("[data-pressed-demo]"));
    await expect(buttons.length).toBeGreaterThan(30);
    for (const button of buttons) {
      await expect(px(getComputedStyle(button).borderTopLeftRadius)).toBe(0);
      await expect(getComputedStyle(button).fontWeight).toBe("600");
    }
    const editorial = canvas.getByRole("textbox", { name: "Email" });
    await expect(getComputedStyle(editorial).fontFamily.split(",")[0].replace(/["']/g, "").trim()).toBe(
      "Fraunces"
    );
    await expect(px(getComputedStyle(editorial).borderTopLeftRadius)).toBe(0);
    await expect(px(getComputedStyle(editorial).borderBottomWidth)).toBe(1);
  },
};
