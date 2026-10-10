import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { HelmetProvider } from "react-helmet-async";
import { IntlProvider } from "react-intl";
import { expect, within } from "storybook/test";
import ceremonyMeta, * as ceremony from "./CeremonyView.stories";
import { CeremonyView } from "./CeremonyView";
import permissionsMeta, * as permissions from "./PermissionsView.stories";
import { PermissionsView } from "./PermissionsView";
import recoveryMeta, * as recovery from "./RecoveryView.stories";
import { RecoveryView } from "./RecoveryView";

const MESSAGES = { en, es, pt } as const;
const LOCALES = ["en", "es", "pt"] as const;

/**
 * One screen at a small phone's width. The transform makes the panel the frame its fixed bar is
 * laid out in, so the bar is as wide as the panel and its buttons wrap as they would on that phone.
 */
function Panel({
  id,
  locale,
  children,
}: {
  id: string;
  locale: keyof typeof MESSAGES;
  children: ReactNode;
}) {
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <div
        data-testid={id}
        data-panel=""
        // `flex: none` holds the width when the canvas is narrower than the panel plus its margins.
        style={{
          width: 320,
          minHeight: 420,
          flex: "none",
          position: "relative",
          transform: "translateZ(0)",
        }}
      >
        {children}
      </div>
    </IntlProvider>
  );
}

type Args = { args?: object };

/** Every named story of a file, in every language, each in its own panel. */
function panels<Props extends object>(
  View: (props: Props) => ReactNode,
  base: object | undefined,
  stories: Record<string, Args>,
  names: readonly string[]
) {
  return LOCALES.flatMap((locale) =>
    names.map((name) => (
      <Panel key={`${name}-${locale}`} id={`${name}-${locale}`} locale={locale}>
        <View {...({ ...base, ...stories[name].args } as Props)} />
      </Panel>
    ))
  );
}

const meta: Meta = {
  title: "Client/Public/AgentReporting/Layout",
  tags: ["!autodocs"],
  decorators: [
    (Story) => (
      <HelmetProvider>
        <Story />
      </HelmetProvider>
    ),
  ],
  parameters: {
    surface: "app",
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Layout-stability proof for the reporting pages (CI-enforced through the storybook-ci " +
          "tag). Every screen of every flow is drawn at a 320px phone's width in English, Spanish " +
          "and Portuguese, and the play function asserts the rule the pages are built on: the " +
          "heading card, the status card and the bottom bar are each one height on every screen, " +
          "so the report or permission under them starts in one place and never moves. The " +
          "structure and natural wrapping are checked on every platform, in the shipped font " +
          "and an Arial fallback. No platform skips the text-fit check.",
      },
    },
  },
};
export default meta;

type Story = StoryObj;

/** A phone-width viewport, so the pages take their phone styles as well as the panels their width. */
const PHONE = { viewport: { value: "mobile" } };

interface Bands {
  heading: number | null;
  status: number | null;
  /** Where the first thing after the cards starts, from the panel's top. */
  record: number | null;
  bar: number | null;
}

function measure(panel: HTMLElement): Bands {
  const height = (element: Element | null | undefined) =>
    element ? Math.round(element.getBoundingClientRect().height) : null;
  const heading = panel.querySelector('[data-component="CeremonyHeading"]');
  const status =
    panel.querySelector('[data-component="CeremonyStageNotice"]')?.closest("[role]") ?? null;
  const last = status ?? heading;
  const record = last?.nextElementSibling ?? null;
  return {
    heading: height(heading),
    status: height(status),
    record: record
      ? Math.round(record.getBoundingClientRect().top - panel.getBoundingClientRect().top)
      : null,
    bar: height(panel.querySelector('[data-component="FlowBar"]')),
  };
}

/**
 * Held on the canvas while the structure is measured. Each band is then held to the room the
 * design gives it, whatever the typeface: a title and a row of buttons to one line, a card's
 * reserved body to its two lines. A band can still differ in height between screens only if a
 * screen is built differently, or if the two-line reservation is lost: an unreserved body is left
 * to wrap as its words need.
 */
const STRUCTURE = "data-layout-structure";
const PANEL = `[${STRUCTURE}] [data-panel]`;
const STATUS_CARD = `${PANEL} [role]:has(> * > [data-component="CeremonyStageNotice"])`;
const STRUCTURE_RULES = [
  `${PANEL} [data-component="CeremonyHeading"] h1,
   ${STATUS_CARD} > :first-child,
   ${STATUS_CARD} > :first-child *,
   ${PANEL} [data-component="FlowBar"],
   ${PANEL} [data-component="FlowBar"] * { white-space: nowrap !important; flex-wrap: nowrap !important; }`,
  `${PANEL} [class*="min-h-[2lh]"] { max-height: 2lh !important; overflow: hidden !important; }`,
].join("\n");

/** The panels of one page, with the rules the structural measurement switches on. */
function Screens({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-4 p-4">
      <style>{STRUCTURE_RULES}</style>
      {children}
    </div>
  );
}

/**
 * Check structural reservations first, then natural wrapping in each font profile.
 * A green Linux run must prove readable copy as well as the shape of the page.
 */
async function expectOneSize(canvasElement: HTMLElement) {
  try {
    canvasElement.setAttribute(STRUCTURE, "");
    await expectBands(canvasElement);
  } finally {
    canvasElement.removeAttribute(STRUCTURE);
  }
  const frames = Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-panel] > section"));
  const previous = frames.map((frame) => frame.style.fontFamily);
  const previousSans = canvasElement.style.getPropertyValue("--font-sans");
  let bands: ReturnType<typeof measure>[] = [];
  try {
    for (const font of [null, "Arial, sans-serif"]) {
      if (font) {
        canvasElement.style.setProperty("--font-sans", font);
        frames.forEach((frame) => {
          frame.style.fontFamily = font;
        });
      }
      // Native font changes are flushed by the geometry reads; unrelated web-font loads
      // and background-tab animation frames must not delay this check.
      bands = await expectBands(canvasElement);
      const text = Array.from(
        canvasElement.querySelectorAll<HTMLElement>(
          '[data-component="CeremonyHeading"] h1, [data-component="CeremonyStageNotice"], [data-component="FlowBar"] button'
        )
      );
      await expect(text.length).toBeGreaterThan(0);
      const clipped = text
        .filter(
          (element) =>
            element.scrollWidth > element.clientWidth + 1 ||
            element.scrollHeight > element.clientHeight + 1
        )
        .map((element) => ({
          panel: element.closest<HTMLElement>("[data-panel]")?.dataset.testid,
          text: element.textContent,
          width: [element.scrollWidth, element.clientWidth],
          height: [element.scrollHeight, element.clientHeight],
        }));
      await expect({ font: font ?? "shipped", clipped }).toEqual({
        font: font ?? "shipped",
        clipped: [],
      });
    }
    return bands;
  } finally {
    frames.forEach((frame, index) => {
      frame.style.fontFamily = previous[index] ?? "";
    });
    if (previousSans) canvasElement.style.setProperty("--font-sans", previousSans);
    else canvasElement.style.removeProperty("--font-sans");
  }
}

async function expectBands(canvasElement: HTMLElement) {
  const all = Array.from(canvasElement.querySelectorAll<HTMLElement>("[data-panel]"));
  await expect(all.length).toBeGreaterThan(0);
  const bands = all.map((panel) => ({ id: panel.dataset.testid ?? "", ...measure(panel) }));
  const steps = bands.filter((band) => band.heading !== null);
  // Real browser geometry, not a vacuous all-zero pass.
  await expect(steps.length).toBeGreaterThan(0);
  await expect(steps[0].heading).toBeGreaterThan(0);
  const one = async (key: keyof Bands, among = steps) => {
    const sized = among.filter((band) => band[key] !== null);
    const sizes = [...new Set(sized.map((band) => band[key]))];
    const odd = sized.filter((band) => band[key] !== sized[0]?.[key]).map((band) => band.id);
    await expect({ key, sizes, odd }).toEqual({ key, sizes: sizes.slice(0, 1), odd: [] });
  };
  await one("heading");
  await one("status");
  await one("bar");
  // With a status card the record starts in one place; without one, in another.
  await one(
    "record",
    steps.filter((band) => band.status !== null)
  );
  await one(
    "record",
    steps.filter((band) => band.status === null)
  );
  return bands;
}

const CEREMONY = [
  "Intro",
  "Connect",
  "ProveConnected",
  "Proving",
  "ConnectDeclined",
  "LinkConnect",
  "ConnectFailed",
  "LinkConnected",
  "CreateAccount",
  "FindAccount",
  "Join",
  "JoinLinked",
  "JoinWrongAccount",
  "JoinDisconnected",
  "InAppStart",
  "Pairing",
  "Linked",
  "Loading",
  "Review",
  "ReviewDisconnected",
  "ReviewOffline",
  "ReviewWrongAccount",
  "ReviewDisabled",
  "Signing",
  "Submitted",
  "OutcomeUnknown",
  "Published",
  "NotSent",
  "Failed",
  "ReviewDecision",
  "DecisionRecorded",
  "GrantConnect",
  "GrantPrepare",
  "GrantPreparing",
  "GrantReady",
  "GrantSigning",
  "GrantSubmitted",
  "GrantOutcomeUnknown",
  "GrantActive",
  "GrantWrongAccount",
  "GrantReview",
] as const;

/** The chat report, review, link and permission flows. */
export const Ceremony: Story = {
  tags: ["storybook-ci"],
  globals: PHONE,
  render: () => (
    <Screens>
      {panels(CeremonyView, ceremonyMeta.args, ceremony as Record<string, Args>, CEREMONY)}
    </Screens>
  ),
  play: async ({ canvasElement }) => {
    const bands = await expectOneSize(canvasElement);
    // A screen that says something went wrong says it in a card that was already there.
    const canvas = within(canvasElement);
    for (const locale of LOCALES) {
      const declined = canvas.getByTestId(`ConnectDeclined-${locale}`);
      await expect(within(declined).getByRole("alert")).toBeVisible();
    }
    await expect(bands.length).toBe(CEREMONY.length * LOCALES.length);
  },
};

const RECOVERY = [
  "Intro",
  "Connect",
  "Connected",
  "ConnectDeclined",
  "Code",
  "Confirm",
  "Applying",
  "Applied",
] as const;

/** Moving an account to a new chat. */
export const Recovery: Story = {
  tags: ["storybook-ci"],
  globals: PHONE,
  render: () => (
    <Screens>
      {panels(RecoveryView, recoveryMeta.args, recovery as Record<string, Args>, RECOVERY)}
    </Screens>
  ),
  play: async ({ canvasElement }) => {
    await expectOneSize(canvasElement);
  },
};

const PERMISSIONS = [
  "NotConnected",
  "Connected",
  "Checking",
  "Active",
  "Empty",
  "Removing",
  "Submitted",
  "Removed",
  "Unsupported",
  "Declined",
] as const;

/** The permissions page: its status card is there from the start. */
export const Permissions: Story = {
  tags: ["storybook-ci"],
  globals: PHONE,
  render: () => (
    <Screens>
      {panels(
        PermissionsView,
        permissionsMeta.args,
        permissions as Record<string, Args>,
        PERMISSIONS
      )}
    </Screens>
  ),
  play: async ({ canvasElement }) => {
    await expectOneSize(canvasElement);
  },
};
