import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, fn, userEvent, within } from "storybook/test";
import { FIXTURE_IMAGE_AGROFORESTRY, FIXTURE_IMAGE_BANNER } from "../../../.storybook/fixtures";
import enMessages from "../../i18n/en.json";
import esMessages from "../../i18n/es.json";
import ptMessages from "../../i18n/pt.json";
import { GardenChip } from "./GardenChip";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

// Both surfaces pass the selected garden's banner (DL-124); an empty one draws the
// garden's fallback tile.
const singleGarden = [{ id: "g1", name: "Jardim Botafogo", bannerImage: FIXTURE_IMAGE_BANNER }];

const multipleGardens = [
  { id: "g1", name: "Garden Alpha", bannerImage: FIXTURE_IMAGE_AGROFORESTRY },
  { id: "g2", name: "Jardim Botafogo", bannerImage: FIXTURE_IMAGE_BANNER },
  { id: "g3", name: "Nairobi Greens", bannerImage: "" },
];

const longNameGarden = [
  {
    id: "g-long",
    name: "The Extraordinarily Long-Named Regenerative Community Garden of Greater Metropolitan Area",
    bannerImage: "",
  },
  { id: "g2", name: "Jardim Botafogo", bannerImage: FIXTURE_IMAGE_BANNER },
];

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

const meta = {
  title: "Shared/Canvas/GardenChip",
  component: GardenChip,
  tags: ["autodocs", "storybook-ci"],
  parameters: {
    // The cockpit renders the chip, so its stories take the cockpit's surface;
    // AppDensity shows the app's beside it.
    surface: "admin",
    docs: {
      description: {
        component: [
          "**GardenChip** — garden context selector in the canvas AppBar. Anatomy aligned",
          "to handoff `screens/review.css` `.rv-pill`:",
          "",
          "- Flat `var(--surface-raised)` background, 1px `var(--outline)` border",
          "- No shadow (drops `glass-raised` from earlier rounds — keeps the AppBar quiet)",
          "- The garden's banner as a 22px avatar on both surfaces, its fallback tile when it",
          "  has none (DL-124); a caller that passes no banner keeps the seedling tile",
          "- With `onOpen` (the installed app), the chip opens the caller's switcher, with one",
          "  garden too; the cockpit keeps its popover",
          "",
          "**Accessibility**:",
          "- Leaf icon is decorative (`aria-hidden`) — name is the accessible label",
          "- Multi-garden trigger uses Radix Popover for menu semantics",
          "- Focus ring uses `var(--tone-action, var(--green-800))`",
          "",
          "**Density**: the size, hit area, outline and focus ring read `--gg-garden-chip-*`.",
          "The cockpit renders their fallbacks, a 36px pill; the installed app's scope sets a",
          "32px capsule, the compact icon buttons' height, with a 48px hit area, the control",
          "outline and focus in the app's green (see AppDensity and AppSwitcher).",
        ].join("\n"),
      },
    },
    a11y: {
      config: {
        rules: [
          { id: "color-contrast", enabled: true },
          { id: "button-name", enabled: true },
        ],
      },
    },
  },
  argTypes: {
    gardens: {
      control: "object",
      description: "Array of gardens available for selection.",
    },
    selectedGarden: {
      control: "object",
      description: "The currently selected garden, or null for All Gardens.",
    },
    onSelectGarden: {
      description:
        "Callback when a garden is selected. Receives the garden object or null for All Gardens.",
    },
    onCreateGarden: {
      description:
        "Optional callback for the Create Garden action. When provided, a divider and create button appear in the dropdown.",
    },
  },
} satisfies Meta<typeof GardenChip>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/** Single garden — static label, no dropdown. */
export const SingleGarden: Story = {
  args: {
    gardens: singleGarden,
    selectedGarden: singleGarden[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
};

/** Multiple gardens with dropdown. Garden Alpha is selected. */
export const MultiGarden: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: multipleGardens[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: /garden alpha/i });
    await expect(trigger).toHaveAttribute("data-component", "GardenChip");
    await userEvent.click(trigger);
    // The menu's code arrives with this first press.
    const menu = await within(document.body).findByText("Jardim Botafogo", undefined, {
      timeout: 5_000,
    });
    await userEvent.click(menu);
    await expect(args.onSelectGarden).toHaveBeenCalledWith(multipleGardens[1]);
  },
};

/** No garden selected — shows "All Gardens" label. */
export const AllGardens: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: null,
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
};

/** Garden with a very long name to test truncation behavior. */
export const LongName: Story = {
  args: {
    gardens: longNameGarden,
    selectedGarden: longNameGarden[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
};

/**
 * Tone matrix — the same chip rendered inside each `[data-tone]` scope so the
 * leaf-icon tinting can be verified at a glance. Hub blue, Garden green,
 * Community amber, Actions clay.
 */
export const ToneMatrix: Story = {
  args: {
    gardens: singleGarden,
    selectedGarden: singleGarden[0],
    onSelectGarden: fn(),
  },
  render: () => (
    <div className="grid grid-cols-2 gap-4 p-4">
      {(["hub", "garden", "community", "actions"] as const).map((tone) => (
        <div key={tone} data-tone={tone} className="rounded-2xl bg-bg-white-0 p-4">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-soft">
            [data-tone=&quot;{tone}&quot;]
          </div>
          <GardenChip
            gardens={singleGarden}
            selectedGarden={singleGarden[0]}
            onSelectGarden={fn()}
          />
        </div>
      ))}
    </div>
  ),
};

/** Agent state catalog for the selector states agents most often need before tests. */
export const StateCatalog: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: multipleGardens[0],
    onSelectGarden: fn(),
    onCreateGarden: fn(),
  },
  render: () => (
    <div className="flex flex-col gap-8 p-4">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">Single Garden (static)</h3>
        <GardenChip gardens={singleGarden} selectedGarden={singleGarden[0]} onSelectGarden={fn()} />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">
          Multi Garden - Garden Alpha selected
        </h3>
        <GardenChip
          gardens={multipleGardens}
          selectedGarden={multipleGardens[0]}
          onSelectGarden={fn()}
          onCreateGarden={fn()}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">Multi Garden — All Gardens</h3>
        <GardenChip
          gardens={multipleGardens}
          selectedGarden={null}
          onSelectGarden={fn()}
          onCreateGarden={fn()}
        />
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-text-sub">Long Name (truncation test)</h3>
        <GardenChip
          gardens={longNameGarden}
          selectedGarden={longNameGarden[0]}
          onSelectGarden={fn()}
          onCreateGarden={fn()}
        />
      </section>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// The app's density beside the cockpit's
// ---------------------------------------------------------------------------

const LOCALES = ["en", "es", "pt"] as const;
const catalogs = { en: enMessages, es: esMessages, pt: ptMessages };
const SCOPES = [
  { scope: "app", label: "App" },
  { scope: "admin", label: "Cockpit" },
] as const;

/**
 * The same chip under the installed app's scope and under the cockpit's, in
 * English, Spanish and Portuguese, at a phone app bar's width so the long name
 * truncates: single, multi, nothing selected and the long name. The theme
 * toolbar switches both to dark. The play pins both densities, the long name
 * and the app's focus ring.
 */
export const AppDensity: Story = {
  args: {
    gardens: multipleGardens,
    selectedGarden: multipleGardens[0],
    onSelectGarden: fn(),
  },
  parameters: { surface: "app" },
  render: () => (
    <div className="flex flex-col gap-6 p-4">
      {SCOPES.map(({ scope, label }) => (
        <section
          key={scope}
          aria-label={label}
          data-surface-scope={scope}
          data-testid={`garden-chip-${scope}`}
          className="flex flex-col gap-3"
        >
          <h3 className="type-label-sm text-text-sub">{label}</h3>
          <div className="flex flex-wrap gap-6">
            {LOCALES.map((locale) => (
              <IntlProvider key={locale} locale={locale} messages={catalogs[locale]}>
                <div lang={locale} className="flex w-72 flex-col items-start gap-3">
                  <GardenChip
                    gardens={singleGarden}
                    selectedGarden={singleGarden[0]}
                    onSelectGarden={fn()}
                  />
                  <GardenChip
                    gardens={multipleGardens}
                    selectedGarden={multipleGardens[0]}
                    onSelectGarden={fn()}
                    onCreateGarden={fn()}
                  />
                  <GardenChip
                    gardens={multipleGardens}
                    selectedGarden={null}
                    onSelectGarden={fn()}
                  />
                  <GardenChip
                    gardens={longNameGarden}
                    selectedGarden={longNameGarden[0]}
                    onSelectGarden={fn()}
                  />
                </div>
              </IntlProvider>
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const surface = (scope: "app" | "admin") => {
      const section = canvas.getByTestId(`garden-chip-${scope}`);
      return {
        section,
        chips: Array.from(
          section.querySelectorAll<HTMLElement>(
            '[data-component="GardenChip"]:is([data-slot="root"], [data-slot="trigger"])'
          )
        ),
        avatars: Array.from(section.querySelectorAll<HTMLElement>('[data-slot="avatar"]')),
      };
    };
    const densities = [
      { ...surface("app"), height: 32, avatar: 22, fontSize: "16px" },
      { ...surface("admin"), height: 36, avatar: 22, fontSize: "14px" },
    ];

    for (const { section, chips, avatars, height, avatar, fontSize } of densities) {
      // Four chips in each language, three of them with the garden's avatar.
      await expect(chips).toHaveLength(12);
      await expect(avatars).toHaveLength(9);
      for (const chip of chips) {
        await expect(chip.getBoundingClientRect().height).toBeCloseTo(height, 0);
        await expect(getComputedStyle(chip).fontSize).toBe(fontSize);
      }
      for (const tile of avatars) {
        await expect(tile.getBoundingClientRect().width).toBeCloseTo(avatar, 0);
      }
      // The long name ends in an ellipsis inside its column.
      const longNames = section.querySelectorAll<HTMLElement>('[title^="The Extraordinarily"]');
      await expect(longNames).toHaveLength(3);
      for (const name of longNames) {
        const chip = name.closest<HTMLElement>('[data-component="GardenChip"]');
        const column = chip?.parentElement;
        await expect(name.scrollWidth).toBeGreaterThan(name.clientWidth);
        await expect(chip?.getBoundingClientRect().right ?? Infinity).toBeLessThanOrEqual(
          (column?.getBoundingClientRect().right ?? 0) + 0.5
        );
      }
    }

    // Keyboard focus rings the app's chip in the app's own focus color.
    const [app] = densities;
    const probe = document.createElement("span");
    probe.style.color = "rgb(var(--focus-ring))";
    app.section.append(probe);
    const appFocus = getComputedStyle(probe).color;
    probe.remove();
    await userEvent.tab();
    const focused = document.activeElement as HTMLElement;
    await expect(app.section.contains(focused)).toBe(true);
    await expect(focused).toHaveAttribute("data-slot", "trigger");
    await expect(getComputedStyle(focused).boxShadow).toContain(appFocus);
  },
};

/**
 * The installed app's chip (DL-124): 32px, the height of the compact icon buttons beside it,
 * with a 48px hit area, the garden's banner as its avatar or the fallback tile without one, and
 * a tap that opens the app's switcher with one garden too. The cockpit's chip, beside it, keeps
 * its 36px pill, its own box and its popover.
 */
export const AppSwitcher: Story = {
  args: {
    gardens: singleGarden,
    selectedGarden: singleGarden[0],
    onSelectGarden: fn(),
    onOpen: fn(),
  },
  parameters: { surface: "app" },
  render: (args) => (
    <div className="flex flex-col gap-6 p-4">
      <section
        data-surface-scope="app"
        data-testid="app-switcher"
        className="flex flex-col items-start gap-3"
      >
        <GardenChip {...args} />
        <GardenChip
          gardens={multipleGardens}
          selectedGarden={multipleGardens[2]}
          onSelectGarden={fn()}
          onOpen={fn()}
        />
        <GardenChip
          gardens={multipleGardens}
          selectedGarden={null}
          onSelectGarden={fn()}
          onOpen={fn()}
          emptyLabel="Choose a Garden"
        />
      </section>
      <section data-surface-scope="admin" data-testid="cockpit-chip">
        <GardenChip gardens={singleGarden} selectedGarden={singleGarden[0]} onSelectGarden={fn()} />
      </section>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const app = within(canvas.getByTestId("app-switcher"));
    const [banner, fallback, empty] = app.getAllByRole("button");
    for (const chip of [banner, fallback, empty]) {
      await expect(chip.getBoundingClientRect().height).toBeCloseTo(32, 0);
      // The hit area reaches 48px above and below the chip.
      await expect(parseFloat(getComputedStyle(chip, "::after").height)).toBeCloseTo(48, 0);
    }
    await expect(banner.querySelector("[data-slot='avatar'] img")).not.toBeNull();
    await expect(fallback.querySelector("[data-slot='avatar'] img")).toBeNull();
    await expect(empty).toHaveTextContent("Choose a Garden");
    await userEvent.click(banner);
    await expect(args.onOpen).toHaveBeenCalledOnce();
    // The cockpit's single garden stays a static label at its own 36px, with no hit area added.
    const cockpit = canvas.getByTestId("cockpit-chip");
    await expect(within(cockpit).queryByRole("button")).toBeNull();
    const pill = cockpit.querySelector<HTMLElement>('[data-component="GardenChip"]');
    await expect(pill?.getBoundingClientRect().height).toBeCloseTo(36, 0);
  },
};
