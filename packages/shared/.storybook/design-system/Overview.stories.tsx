import { RiCloseLine, RiShareLine } from "@remixicon/react";
import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties, ReactNode } from "react";
import { expect, waitFor, within } from "storybook/test";
import { AdminButton, AdminIconButton } from "../../../admin/src/components/AdminButton";
import { AdminFilterChip } from "../../../admin/src/components/AdminFilterChip";
import { AdminTextField } from "../../../admin/src/components/AdminTextField";
import { Button } from "../../src/components/Button";
import { Chip } from "../../src/components/Chip";
import { TextInput } from "../../src/components/Form/ControlPrimitives";
import { IconButton } from "../../src/components/IconButton";
import { Page, Row, Section, Specimen, StoryLink, TokenTable } from "./measure";
import { ADMIN, APP, STORY_LINKS, WEBSITE } from "./rules";

const meta = {
  title: "Design System/Overview",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    // The page root is the installed app; the website and admin columns scope
    // their own tokens with `data-surface-scope` (surfaces.css).
    surface: "app",
    docs: {
      description: {
        component:
          "The three button and control systems side by side, rendered from the real components and measured live: the installed app and public website share one primitive family with one corner per surface (DL-026, DL-029: the 16px field corner in the app, square on the website), and the admin cockpit keeps its M3 pills on the DL-011 / DL-030 compact metric. Each specimen reads its own height, corner, label size, weight, font, and hit area from the browser and grades them against that surface's rules.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Overrides the resting corner token with the pressed one to show the press morph at rest. */
const pressed: CSSProperties = {
  ["--gg-button-radius" as string]: "var(--gg-button-radius-pressed)",
};

function Column({
  surface,
  title,
  rules,
  children,
}: {
  surface: "app" | "website" | "admin";
  title: string;
  rules: string[];
  children: ReactNode;
}) {
  return (
    <div className="sb-ds-column" data-surface-scope={surface} data-column={surface}>
      <h3>{title}</h3>
      <ul className="sb-ds-rules">
        {rules.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
      {children}
    </div>
  );
}

function ClientColumn({ surface }: { surface: "app" | "website" }) {
  const rules = surface === "app" ? APP : WEBSITE;
  return (
    <Column surface={surface} title={rules.name} rules={rules.rules}>
      <Row>
        <Specimen title="Primary / secondary / tertiary · md" expect={rules.button("md")} wide>
          <Button>Create Garden</Button>
          <Button emphasis="secondary">Cancel</Button>
          <Button emphasis="tertiary">Show More</Button>
        </Specimen>
        <Specimen
          title="Pressed corner (simulated)"
          expect={{ radius: rules.cornerPressed, weight: rules.weight }}
          note="The resting token is swapped for the pressed one; a real press tightens one step (DL-001, DL-026)."
        >
          <div style={pressed}>
            <Button>Create Garden</Button>
          </div>
        </Specimen>
        <Specimen title="Destructive primary" expect={rules.button("md")}>
          <Button tone="danger">Remove Photo</Button>
        </Specimen>
        <Specimen title="lg · 48" expect={rules.button("lg")}>
          <Button size="lg">Submit Work</Button>
        </Specimen>
        <Specimen title="sm · 40" expect={rules.button("sm")}>
          <Button size="sm" emphasis="secondary">
            Endow
          </Button>
        </Specimen>
        <Specimen title="compact · 32" expect={rules.button("compact")}>
          <Button size="compact" emphasis="secondary">
            Join Garden
          </Button>
        </Specimen>
        <Specimen title="Icon button · md" expect={rules.iconButton("md")}>
          <IconButton aria-label="Share" icon={<RiShareLine />} />
          <IconButton aria-label="Close" emphasis="secondary" icon={<RiCloseLine />} />
        </Specimen>
        <Specimen title="Icon button · compact" expect={rules.iconButton("compact")}>
          <IconButton aria-label="Share" size="compact" emphasis="secondary" icon={<RiShareLine />} />
        </Specimen>
        <Specimen title="Chip · 32" expect={rules.chip("compact")}>
          <Chip>Offers</Chip>
          <Chip selected>Confirmed</Chip>
        </Specimen>
        <Specimen title="Field · md" expect={rules.field("md")}>
          <TextInput aria-label="Garden name" placeholder="Garden name" />
        </Specimen>
        {surface === "website" ? (
          <Specimen title="Editorial field" expect={WEBSITE.editorialField()}>
            <TextInput aria-label="Email" surface="editorial" placeholder="you@example.com" />
          </Specimen>
        ) : null}
        <Specimen
          title="Hit areas (dashed)"
          expect={rules.button("compact")}
          note="sm and compact keep a 48px finger box; the dashed outline is the ::after box."
        >
          <div className="sb-show-hit flex flex-wrap items-center gap-4 py-2">
            <Button size="compact" emphasis="secondary">
              Compact
            </Button>
            <Button size="sm">Small</Button>
            <IconButton aria-label="Share" size="compact" icon={<RiShareLine />} />
            <Chip>Chip</Chip>
          </div>
        </Specimen>
      </Row>
      <div style={{ marginTop: 14 }}>
        <TokenTable
          scopeSelector={`[data-column="${surface}"]`}
          tokens={[
            { name: "--gg-button-radius", expected: `${rules.cornerRest}px` },
            { name: "--gg-button-radius-pressed", expected: `${rules.cornerPressed}px` },
            { name: "--gg-button-weight", expected: String(rules.weight) },
            { name: "--text-label-md", expected: "16px", note: "lg and md labels" },
            { name: "--text-label-sm", expected: "14px", note: "sm and compact labels, chips" },
            { name: "--radius-lg", expected: "16px", note: "fields (DL-022)" },
          ]}
        />
      </div>
    </Column>
  );
}

function AdminColumn() {
  return (
    <Column surface="admin" title={ADMIN.name} rules={ADMIN.rules}>
      <div className="admin-m3" data-tone="hub">
        <Row>
          <Specimen title="Filled / outlined / text · md" expect={ADMIN.button("md")} wide>
            <AdminButton>Create Garden</AdminButton>
            <AdminButton variant="outlined">Cancel</AdminButton>
            <AdminButton variant="text">Show More</AdminButton>
          </Specimen>
          <Specimen
            title="No press morph"
            expect={ADMIN.button("md")}
            note="Pills stay pills; feedback is the M3 state layer and an elevation step, never a corner change (Rule 18)."
          >
            <AdminButton variant="tonal">Save Draft</AdminButton>
          </Specimen>
          <Specimen title="Danger" expect={ADMIN.button("md")}>
            <AdminButton variant="danger">Remove Member</AdminButton>
          </Specimen>
          <Specimen title="lg · 40" expect={ADMIN.button("lg")}>
            <AdminButton size="lg">Submit Work</AdminButton>
          </Specimen>
          <Specimen title="sm · 28" expect={ADMIN.button("sm")}>
            <AdminButton size="sm" variant="outlined">
              Manage Members
            </AdminButton>
          </Specimen>
          <Specimen title="Icon button · md" expect={ADMIN.iconButton("md")}>
            <AdminIconButton label="Share">
              <RiShareLine />
            </AdminIconButton>
            <AdminIconButton label="Close" variant="tonal">
              <RiCloseLine />
            </AdminIconButton>
          </Specimen>
          <Specimen title="Icon button · lg" expect={ADMIN.iconButton("lg")}>
            <AdminIconButton label="Share" size="lg">
              <RiShareLine />
            </AdminIconButton>
          </Specimen>
          <Specimen title="Filter chip · 32" expect={ADMIN.chip()}>
            <AdminFilterChip label="Pending" selected={false} onToggle={() => {}} />
            <AdminFilterChip label="Approved" selected onToggle={() => {}} />
          </Specimen>
          <Specimen
            title="Field · 44"
            targets={[
              {
                name: "container",
                selector: '[data-component="AdminTextField"] > div:first-child',
                expect: ADMIN.fieldContainer(),
              },
              { name: "label", selector: "label", expect: ADMIN.fieldLabel() },
              { name: "input", selector: "input", expect: ADMIN.fieldInput() },
            ]}
          >
            <div style={{ width: "100%" }}>
              <AdminTextField label="Garden name" defaultValue="Rio Claro" />
            </div>
          </Specimen>
          <Specimen
            title="Hit areas (dashed)"
            expect={{ height: 28, hit: 44 }}
            note="Every tier carries a 44px finger box: admin-hit-target below 40px, admin-hit-target-lg on the 40px tier (DL-030)."
          >
            <div className="sb-show-hit flex flex-wrap items-center gap-4 py-2">
              <AdminButton size="sm" variant="outlined">
                Small
              </AdminButton>
              <AdminButton size="md">Medium</AdminButton>
              <AdminIconButton label="Add" size="lg">
                <RiShareLine />
              </AdminIconButton>
            </div>
          </Specimen>
        </Row>
      </div>
      <AdminTokens />
    </Column>
  );
}

/** Reads from the admin column, so the values are the cockpit's, not the app root's. */
function AdminTokens() {
  return (
    <div style={{ marginTop: 14 }}>
      <TokenTable
        scopeSelector='[data-column="admin"]'
        tokens={[
          { name: "--text-label-lg", expected: "14px", note: "buttons, chips, tabs" },
          { name: "--text-label-md", expected: "12px", note: "meta, count chips" },
          { name: "--text-label-sm", expected: "11px", note: "chips only" },
          { name: "--text-body-md", expected: "14px", note: "field text" },
          { name: "--radius-xl", expected: "16px", note: "the 16px page-container step (DL-030)" },
          { name: "--radius-2xl", expected: "16px", note: "the 16px page-container step (DL-030)" },
          { name: "--m3-shape-full", expected: "9999px", note: "the pill" },
        ]}
      />
    </div>
  );
}

/** Every column at once. The admin column sets its own scope, so its tokens read as the cockpit resolves them. */
export const ThreeSystems: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <Page
      title="Button and control systems"
      lede="Three surfaces, two systems. The installed app and the public website share the shared Button, IconButton, Chip, and field primitives and differ only in the corner and label weight the surface sets (16px like the fields in the app, square on the website); the admin cockpit keeps AdminButton pills on its compact metric. Every specimen below is the real component measured in this browser."
    >
      <Section title="Side by side">
        <div className="sb-ds-columns">
          <ClientColumn surface="app" />
          <ClientColumn surface="website" />
          <AdminColumn />
        </div>
      </Section>
      <Section
        title="Where to go deeper"
        lede="Foundations and Components per surface are the canonical pages and read green while a system holds. Admin · Shared pieces measures the shared components the cockpit renders on the cockpit's own metric (DL-031)."
      >
        <div className="sb-ds-links">
          <StoryLink id="design-system-app-foundations--tokens">App · Foundations</StoryLink>
          <StoryLink id="design-system-app-components--buttons">App · Components</StoryLink>
          <StoryLink id="design-system-website-foundations--tokens">Website · Foundations</StoryLink>
          <StoryLink id="design-system-website-components--buttons">Website · Components</StoryLink>
          <StoryLink id="design-system-admin-components--buttons">Admin · Components</StoryLink>
          <StoryLink id="design-system-admin-foundations--tokens">Admin · Foundations</StoryLink>
          <StoryLink id="design-system-admin-shared-pieces--pieces">Admin · Shared pieces</StoryLink>
          <StoryLink id={STORY_LINKS.sharedButton}>Shared/Primitives/Button</StoryLink>
          <StoryLink id={STORY_LINKS.sharedIconButton}>Shared/Primitives/IconButton</StoryLink>
          <StoryLink id={STORY_LINKS.sharedChip}>Shared/Primitives/Chip</StoryLink>
          <StoryLink id={STORY_LINKS.sharedControls}>Shared/Form/ControlPrimitives</StoryLink>
          <StoryLink id={STORY_LINKS.editorialAtoms}>Client/Public/Editorial Atoms</StoryLink>
          <StoryLink id={STORY_LINKS.adminButton}>Admin/Primitives/AdminButton</StoryLink>
          <StoryLink id={STORY_LINKS.adminTextField}>Admin/Primitives/AdminTextField</StoryLink>
        </div>
      </Section>
    </Page>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const px = (value: string) => Number.parseFloat(value);
    const first = (family: string) => family.split(",")[0].replace(/["']/g, "").trim();
    const column = (surface: string) =>
      canvasElement.querySelector<HTMLElement>(`[data-column="${surface}"]`);

    // Installed app: the 16px field corner, weight 400, Inter (DL-029).
    const app = within(column("app") as HTMLElement);
    const appPrimary = app.getAllByRole("button", { name: "Create Garden" })[0];
    await expect(appPrimary.getBoundingClientRect().height).toBe(44);
    await expect(px(getComputedStyle(appPrimary).borderTopLeftRadius)).toBe(16);
    await expect(getComputedStyle(appPrimary).fontWeight).toBe("400");
    await expect(first(getComputedStyle(appPrimary).fontFamily)).toBe("Inter");

    // Public website: square, weight 600, serif editorial field (DL-029).
    const site = within(column("website") as HTMLElement);
    const sitePrimary = site.getAllByRole("button", { name: "Create Garden" })[0];
    await expect(px(getComputedStyle(sitePrimary).borderTopLeftRadius)).toBe(0);
    await expect(getComputedStyle(sitePrimary).fontWeight).toBe("600");
    const editorial = site.getByRole("textbox", { name: "Email" });
    await expect(first(getComputedStyle(editorial).fontFamily)).toBe("Fraunces");
    await expect(px(getComputedStyle(editorial).borderTopLeftRadius)).toBe(0);

    // Admin cockpit (DL-030): one 14px label at every size, Plus Jakarta Sans,
    // 32px pills, a 12px floating label, and xl / 2xl on the 16px step.
    const admin = within(column("admin") as HTMLElement);
    const adminMd = admin.getAllByRole("button", { name: "Create Garden" })[0];
    await expect(adminMd.getBoundingClientRect().height).toBe(32);
    await expect(getComputedStyle(adminMd).fontSize).toBe("14px");
    await expect(first(getComputedStyle(adminMd).fontFamily)).toBe("Plus Jakarta Sans");
    const adminSm = admin.getByRole("button", { name: "Manage Members" });
    await expect(adminSm.getBoundingClientRect().height).toBe(28);
    await expect(getComputedStyle(adminSm).fontSize).toBe("14px");
    const adminField = admin.getByRole("textbox", { name: "Garden name" });
    await expect(getComputedStyle(adminField).fontSize).toBe(window.innerWidth < 640 ? "16px" : "14px");
    const adminLabel = admin.getByText("Garden name", { selector: "label" });
    await expect(getComputedStyle(adminLabel).fontSize).toBe("12px");
    const scope = column("admin") as HTMLElement;
    await expect(getComputedStyle(scope).getPropertyValue("--radius-xl").trim()).toBe("16px");
    await expect(getComputedStyle(scope).getPropertyValue("--radius-2xl").trim()).toBe("16px");
    await expect(getComputedStyle(scope).getPropertyValue("--text-label-sm").trim()).toBe("11px");

    // The measurement chips settle once fonts are ready.
    await waitFor(async () => {
      await expect(canvas.getAllByText(/on spec|off/).length).toBeGreaterThan(0);
    });
  },
};
