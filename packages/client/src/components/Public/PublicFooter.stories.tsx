import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { MemoryRouter } from "react-router-dom";
import { PublicFooter } from "./PublicFooter";

const messages = {
  "public.nav.gardens": "Gardens",
  "public.nav.impact": "Impact",
  "public.nav.fund": "Fund",
  "public.nav.actions": "Actions",
  "public.footer.wordmark": "Green Goods",
  "public.footer.navLabel": "Footer navigation",
  "public.footer.legal":
    "© {year} Green Goods. A living public record, rooted in regenerative work.",
};

const meta: Meta<typeof PublicFooter> = {
  title: "Client/Public/PublicFooter",
  component: PublicFooter,
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
          "Closing editorial mark for every public-browser page — oversized italic " +
          "Fraunces wordmark, footer nav, hairline rule, and small legal copy on linen.",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof PublicFooter>;

export const Default: Story = {};

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
