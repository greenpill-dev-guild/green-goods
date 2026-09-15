import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { TextInput } from "../../src/components/Form/ControlPrimitives";
import { IconButton } from "../../src/components/IconButton";
import { RiShareLine } from "@remixicon/react";
import { ClientTokens, PRESSED } from "./clientSpecimens";
import { Page, Section, Specimen, StoryLink, TokenTable } from "./measure";
import { APP, STORY_LINKS } from "./rules";

const meta = {
  title: "Design System/App/Foundations",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    surface: "app",
    docs: {
      description: {
        component:
          "The tokens behind the installed app's controls, read live from this browser: the corner pair, the height scale, the label type, and the radius steps every control is built from. Values come from shared theme.css and the DesignMD `rounded.*` scale.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tokens: Story = {
  render: () => (
    <Page
      title="Installed app · Foundations"
      lede="What the app surface sets and what the primitives read. The button corner is a surface token, never a class on a call site (DL-025, DL-026)."
    >
      <Section id="tokens" title="Surface tokens" lede="Read from the page root while this story renders on the app surface.">
        <ClientTokens rules={APP} />
      </Section>
      <Section id="corners" title="Corner pair" lede="The 16px field corner at rest, 12px pressed, for every emphasis (DL-029), so a button and the field beside it share one shape. Icon buttons are circles and chips capsules on both surfaces.">
        <div className="sb-ds-row">
          <Specimen title="rest · 16px" target=".gg-button" all expect={{ radius: 16 }}>
            <Button>Create Garden</Button>
            <Button emphasis="secondary">Cancel</Button>
          </Specimen>
          <Specimen title="pressed · 12px (simulated)" target=".gg-button" all expect={{ radius: 12 }}>
            <div style={PRESSED} className="flex flex-wrap items-center gap-3">
              <Button>Create Garden</Button>
              <Button emphasis="secondary">Cancel</Button>
            </div>
          </Specimen>
          <Specimen title="icon button · circle" expect={{ radius: "circle" }}>
            <IconButton aria-label="Share" icon={<RiShareLine />} />
          </Specimen>
          <Specimen title="chip · capsule" expect={{ radius: "pill" }}>
            <Chip>Offers</Chip>
          </Specimen>
          <Specimen title="field · 16px" expect={{ radius: 16 }}>
            <TextInput aria-label="Garden name" placeholder="Garden name" />
          </Specimen>
        </div>
      </Section>
      <Section id="heights" title="Height scale" lede="Buttons and fields share one scale (DL-023): 48 page-level, 44 default, 40 dense rows, 32 beside text. Below 44 the hit area grows to 48.">
        <div className="sb-ds-row">
          <Specimen title="lg · 48" target=".gg-button, .gg-control" all expect={{ height: 48 }}>
            <Button size="lg">Submit Work</Button>
            <TextInput aria-label="lg field" controlSize="lg" placeholder="lg field" className="max-w-[180px]" />
          </Specimen>
          <Specimen title="md · 44" target=".gg-button, .gg-control" all expect={{ height: 44 }}>
            <Button>Create Garden</Button>
            <TextInput aria-label="md field" placeholder="md field" className="max-w-[180px]" />
          </Specimen>
          <Specimen
            title="sm · 40"
            targets={[
              { name: "button", selector: ".gg-button", expect: { height: 40, hit: 48 } },
              { name: "field", selector: ".gg-control", expect: { height: 40 } },
            ]}
          >
            <Button size="sm">Endow</Button>
            <TextInput aria-label="sm field" controlSize="sm" placeholder="sm field" className="max-w-[180px]" />
          </Specimen>
          <Specimen title="compact · 32" expect={{ height: 32, hit: 48 }}>
            <Button size="compact" emphasis="secondary">
              Join Garden
            </Button>
          </Specimen>
        </div>
      </Section>
      <Section id="type" title="Label type" lede="Inter, weight 400. 16px on lg and md, 14px on sm, compact, and chips (the `--text-label-md` / `--text-label-sm` tokens).">
        <div className="sb-ds-row">
          <Specimen title="16px / 400" expect={{ labelSize: 16, weight: 400, family: "Inter" }}>
            <Button>Create Garden</Button>
          </Specimen>
          <Specimen title="14px / 400" expect={{ labelSize: 14, weight: 400, family: "Inter" }}>
            <Button size="sm" emphasis="secondary">
              Endow
            </Button>
          </Specimen>
        </div>
      </Section>
      <Section id="radius-scale" title="Radius scale (DesignMD rounded.*)" lede="The steps every client corner comes from. Buttons and fields never take a radius class; their primitive owns the shape.">
        <TokenTable
          tokens={[
            { name: "--gg-radius-none", expected: "0px", note: "website buttons" },
            { name: "--gg-radius-md", expected: "8px", note: "tags" },
            { name: "--gg-radius-squircle", expected: "12px", note: "the pressed app corner; actions inside a field" },
            { name: "--gg-radius-lg", expected: "16px", note: "fields, cards, app buttons" },
            { name: "--gg-radius-xl", expected: "20px", note: "panels, sheets" },
            { name: "--gg-radius-2xl", expected: "24px", note: "dialogs, bottom sheets" },
            { name: "--gg-radius-full", expected: "9999px", note: "chips, icon buttons" },
          ]}
        />
        <div className="sb-ds-links" style={{ marginTop: 12 }}>
          <StoryLink id={STORY_LINKS.sharedTokens}>Shared/Tokens/Foundation</StoryLink>
          <StoryLink id="design-system-app-components--buttons">App · Components</StoryLink>
        </div>
      </Section>
    </Page>
  ),
};
