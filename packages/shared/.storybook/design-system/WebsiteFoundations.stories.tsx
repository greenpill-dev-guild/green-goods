import { RiShareLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
} from "../../../client/src/components/Public/atoms/EditorialAtoms";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { TextInput } from "../../src/components/Form/ControlPrimitives";
import { IconButton } from "../../src/components/IconButton";
import { ClientTokens, PRESSED } from "./clientSpecimens";
import { Page, Section, Specimen, StoryLink } from "./measure";
import { STORY_LINKS, WEBSITE } from "./rules";

const meta = {
  title: "Design System/Website/Foundations",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    surface: "website",
    docs: {
      description: {
        component:
          "The tokens the public website sets on top of the shared family: square buttons (no press morph) and the semibold label weight flipped by data-site=\"website\" on the shell (so portaled dialogs match), the editorial serif, and the square surfaces around the controls.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tokens: Story = {
  render: () => (
    <Page
      title="Public website · Foundations"
      lede='PublicShell carries data-site="website"; the corner and weight tokens sit on :root, so every shared button on the site, dialogs included, takes the website shape without a class.'
    >
      <Section id="tokens" title="Surface tokens" lede="Read live while this story renders inside the website surface.">
        <ClientTokens rules={WEBSITE} />
      </Section>
      <Section id="corners" title="Corners" lede="Square at rest and while pressed, for every emphasis (DL-028); icon buttons stay circles and chips capsules.">
        <div className="sb-ds-row">
          <Specimen title="rest · 0px" target=".gg-button" all expect={{ radius: 0, weight: 600 }}>
            <Button>Explore Gardens</Button>
            <Button emphasis="secondary">Schedule a Call →</Button>
          </Specimen>
          <Specimen title="pressed · 0px (simulated)" target=".gg-button" all expect={{ radius: 0 }}>
            <div style={PRESSED} className="flex flex-wrap items-center gap-3">
              <Button>Explore Gardens</Button>
              <Button emphasis="secondary">Schedule a Call →</Button>
            </div>
          </Specimen>
          <Specimen title="icon button · circle" expect={{ radius: "circle" }}>
            <IconButton aria-label="Share" icon={<RiShareLine />} />
          </Specimen>
          <Specimen title="chip · capsule" expect={{ radius: "pill" }}>
            <Chip>Solar</Chip>
          </Specimen>
          <Specimen title="editorial field · 0px underline" expect={WEBSITE.editorialField()}>
            <TextInput aria-label="Email" surface="editorial" placeholder="you@example.com" />
          </Specimen>
        </div>
      </Section>
      <Section id="type" title="Type" lede="Inter for controls at weight 600; Fraunces for editorial headings, numerals, and the underline field's text.">
        <div className="sb-ds-row">
          <Specimen title="button label · 16px / 600 Inter" expect={{ labelSize: 16, weight: 600, family: "Inter" }}>
            <Button>Subscribe</Button>
          </Specimen>
          <Specimen title="editorial heading · Fraunces" target="h2" expect={{ family: "Fraunces" }} wide>
            <div className="flex flex-col gap-2">
              <EditorialKicker>§ 01 — Featured Gardens</EditorialKicker>
              <EditorialHeading as="h2" size="section">
                Tended places, openly accounted for
              </EditorialHeading>
              <EditorialLede>Every garden publishes its work, its evidence, and its funding.</EditorialLede>
            </div>
          </Specimen>
        </div>
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.editorialTokens}>Client/Public/Editorial Tokens</StoryLink>
          <StoryLink id="design-system-website-components--buttons">Website · Components</StoryLink>
        </div>
      </Section>
    </Page>
  ),
};
