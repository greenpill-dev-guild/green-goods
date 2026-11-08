import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { expect, within } from "storybook/test";
import { PublicFooter } from "./PublicFooter";

const messages = {
  "public.footer.wordmark": "Green Goods",
  "public.footer.navLabel": "Footer links",
  "public.footer.legal":
    "© {year} Green Goods. A living public record, rooted in regenerative work.",
};

const meta: Meta<typeof PublicFooter> = {
  title: "Client/Public/PublicFooter",
  component: PublicFooter,
  tags: ["storybook-ci"],
  play: async ({ canvasElement }) => {
    const footer = within(canvasElement).getByRole("navigation", { name: "Footer links" });
    for (const label of [
      "Twitter",
      "LinkedIn",
      "GitHub",
      "Docs",
      "Privacy",
      "Contact",
      "Terms of Use",
    ]) {
      await expect(within(footer).getByRole("link", { name: label })).toBeVisible();
    }
    await expect(within(footer).getAllByRole("link")).toHaveLength(7);
    await expect(within(footer).getByRole("link", { name: "Terms of Use" })).toHaveAttribute(
      "href",
      "/terms"
    );
    const document = canvasElement.ownerDocument;
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <IntlProvider locale="en" messages={messages}>
          <Story />
        </IntlProvider>
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Compact utility footer for every public-browser page: small Fraunces " +
          "wordmark, provenance message, and two rows of links: Twitter, LinkedIn, " +
          "GitHub and Docs, then Privacy, Contact and Terms of Use. On mobile everything " +
          "stacks and the provenance message comes last. Schedule-a-Call lives in " +
          "PublicGetInTouch above the footer.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicFooter>;

export const Default: Story = { globals: { viewport: { value: "desktop" } } };

export const Mobile: Story = { globals: { viewport: { value: "mobile" } } };

export const InContext: Story = {
  render: () => (
    <div className="flex flex-col">
      <section className="bg-editorial-deep px-6 py-16 text-editorial-deep-fg sm:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-editorial-deep-fg/72">
            § Get In Touch (preview)
          </p>
          <h2 className="mt-3 font-serif text-3xl text-editorial-deep-fg md:text-4xl">
            A letter, once a season.
          </h2>
        </div>
      </section>
      <PublicFooter />
    </div>
  ),
};
