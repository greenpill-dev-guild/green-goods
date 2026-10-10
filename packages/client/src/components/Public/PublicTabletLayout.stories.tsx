import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { expect, waitFor } from "storybook/test";
import spanish from "@green-goods/shared/i18n/es";
import portuguese from "@green-goods/shared/i18n/pt";
import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import { withSeededQueryClient } from "../../../../shared/.storybook/decorators";
import PublicActions from "../../views/Public/Actions";
import { PublicFooter } from "./PublicFooter";
import { PublicFundingBridge } from "./PublicFundingBridge";
import { PublicProofBand } from "./PublicProofBand";
import { PublicRecordLoop } from "./PublicRecordLoop";

const meta = {
  title: "Client/Public/TabletLayout",
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    layout: "fullscreen",
    viewport: {
      options: {
        landscapeTablet: {
          name: "Landscape tablet (1024)",
          styles: { width: "1024px", height: "768px" },
          type: "tablet",
        },
      },
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div data-site="website">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  render: () => (
    <>
      <PublicFundingBridge />
      <PublicProofBand gardens={13} contributors={48} works={125} assessments={8} />
      <PublicRecordLoop />
      <PublicFooter />
    </>
  ),
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function section(canvas: HTMLElement, headingId: string) {
  const element = canvas.querySelector(`#${headingId}`)?.closest("section");
  if (!element) throw new Error(`Missing public section ${headingId}`);
  return element;
}

async function expectTabletFit(canvas: HTMLElement, width: number) {
  await waitFor(() => expect(window.innerWidth).toBe(width));
  const funding = section(canvas, "public-funding-bridge-title");
  const paths = funding.querySelectorAll("article");
  const title = funding.querySelector("h2")!;
  await waitFor(() => {
    expect(paths[0].getBoundingClientRect().width).toBeGreaterThan(300);
    expect(paths[1].getBoundingClientRect().top).toBeCloseTo(
      paths[0].getBoundingClientRect().top,
      0
    );
    expect(paths[0].getBoundingClientRect().top).toBeGreaterThan(
      title.getBoundingClientRect().bottom
    );
    expect(getComputedStyle(title).fontSize).toBe("36px");
    const step = section(canvas, "public-loop-title").querySelector("ol a")!;
    const heading = step.querySelector("h3")!.getBoundingClientRect();
    const body = step.querySelector("p")!.getBoundingClientRect();
    expect(body.width).toBeGreaterThan(500);
    expect(body.top).toBeGreaterThan(heading.bottom);
    expect(body.left).toBeCloseTo(heading.left, 0);
    const arrows = section(canvas, "public-loop-title").querySelectorAll("h3 > span:last-child");
    for (const arrow of arrows) {
      expect(arrow.getBoundingClientRect().right).toBeCloseTo(heading.right, 0);
    }
    const proof = section(canvas, "public-proof-title");
    const record = proof.querySelector("dl")!;
    expect(record.getBoundingClientRect().left).toBeCloseTo(
      proof.querySelector("h2")!.getBoundingClientRect().left,
      0
    );
    expect(record.children[0].getBoundingClientRect().width).toBeGreaterThan(300);
    const footer = canvas.querySelector("footer")!;
    const brand = footer.querySelector("a")!.getBoundingClientRect();
    const links = footer.querySelector("nav")!.getBoundingClientRect();
    const provenance = footer.querySelector("p")!.getBoundingClientRect();
    expect(links.top).toBeLessThan(brand.bottom);
    expect(provenance.top).toBeGreaterThanOrEqual(Math.max(brand.bottom, links.bottom));
    expect(footer.scrollWidth).toBeLessThanOrEqual(width);
  });
}

export const PortraitTablet: Story = {
  globals: { viewport: { value: "tablet" } },
  play: ({ canvasElement }) => expectTabletFit(canvasElement, 768),
};

export const LandscapeTablet: Story = {
  globals: { viewport: { value: "landscapeTablet" } },
  play: ({ canvasElement }) => expectTabletFit(canvasElement, 1024),
};

export const PortugueseTablet: Story = {
  ...PortraitTablet,
  decorators: [
    (Story) => (
      <IntlProvider locale="pt" messages={portuguese}>
        <Story />
      </IntlProvider>
    ),
  ],
};

export const SpanishTablet: Story = {
  ...PortraitTablet,
  decorators: [
    (Story) => (
      <IntlProvider locale="es" messages={spanish}>
        <Story />
      </IntlProvider>
    ),
  ],
};

export const NarrowDesktopContainer: Story = {
  globals: { viewport: { value: "desktop" } },
  render: () => (
    <div className="w-[520px]">
      <PublicFundingBridge />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const paths = canvasElement.querySelectorAll("article");
    await waitFor(() => {
      expect(window.innerWidth).toBe(1280);
      expect(paths[0].getBoundingClientRect().width).toBeGreaterThan(400);
      expect(paths[1].getBoundingClientRect().top).toBeGreaterThan(
        paths[0].getBoundingClientRect().bottom
      );
    });
  },
};

export const Desktop: Story = {
  globals: { viewport: { value: "desktop" } },
  play: async ({ canvasElement }) => {
    const funding = section(canvasElement, "public-funding-bridge-title");
    const title = funding.querySelector("h2")!;
    const paths = funding.querySelectorAll("article");
    await waitFor(() => {
      expect(window.innerWidth).toBe(1280);
      expect(paths[0].getBoundingClientRect().left).toBeGreaterThan(
        title.getBoundingClientRect().right
      );
      expect(paths[1].getBoundingClientRect().top).toBeCloseTo(
        paths[0].getBoundingClientRect().top,
        0
      );
      const step = section(canvasElement, "public-loop-title").querySelector("ol a")!;
      expect(step.querySelector("p")!.getBoundingClientRect().top).toBeCloseTo(
        step.querySelector("h3")!.getBoundingClientRect().top,
        0
      );
      const footer = canvasElement.querySelector("footer")!;
      const brand = footer.querySelector("a")!.getBoundingClientRect();
      const provenance = footer.querySelector("p")!.getBoundingClientRect();
      expect(provenance.top).toBeLessThan(brand.bottom);
    });
  },
};

export const Mobile: Story = {
  globals: { viewport: { value: "mobile" } },
  play: async ({ canvasElement }) => {
    const paths = canvasElement.querySelectorAll("article");
    await waitFor(() => {
      expect(window.innerWidth).toBe(375);
      expect(paths[1].getBoundingClientRect().top).toBeGreaterThan(
        paths[0].getBoundingClientRect().bottom
      );
      const footer = canvasElement.querySelector("footer")!;
      expect(footer.querySelector("nav")!.getBoundingClientRect().top).toBeGreaterThan(
        footer.querySelector("p")!.getBoundingClientRect().bottom
      );
      expect(canvasElement.scrollWidth).toBeLessThanOrEqual(375);
    });
  },
};

export const ActionsTablet: Story = {
  globals: { viewport: { value: "landscapeTablet" } },
  decorators: [withSeededQueryClient([[queryKeys.actions.byChain(DEFAULT_CHAIN_ID), []]])],
  render: () => <PublicActions />,
  play: async ({ canvasElement }) => {
    const domains = section(canvasElement, "public-actions-domains-title").querySelectorAll("li");
    const heroTitle = canvasElement.querySelector("#public-actions-hero-title")!;
    // A face that arrives late reflows the title, so its lines are counted once fonts settle.
    await document.fonts.ready;
    await waitFor(() => {
      expect(window.innerWidth).toBe(1024);
      // Left to the card's measure this title fits in two lines, so it is authored as three
      // like the other core pages'. A fallback face can wrap further, hence "at least".
      expect(
        Math.round(
          heroTitle.getBoundingClientRect().height /
            Number.parseFloat(getComputedStyle(heroTitle).lineHeight)
        )
      ).toBeGreaterThanOrEqual(3);
      expect(domains).toHaveLength(4);
      expect(domains[0].getBoundingClientRect().width).toBeGreaterThan(400);
      expect(domains[1].getBoundingClientRect().top).toBeCloseTo(
        domains[0].getBoundingClientRect().top,
        0
      );
      expect(domains[2].getBoundingClientRect().top).toBeGreaterThan(
        domains[0].getBoundingClientRect().bottom
      );
      expect(domains[3].getBoundingClientRect().top).toBeCloseTo(
        domains[2].getBoundingClientRect().top,
        0
      );
    });
  },
};
