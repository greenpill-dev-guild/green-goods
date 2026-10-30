import enMessages from "@green-goods/shared/i18n/en.json";
import esMessages from "@green-goods/shared/i18n/es.json";
import ptMessages from "@green-goods/shared/i18n/pt.json";
import type { Address } from "@green-goods/shared/types/domain";
import type { DraftWithImages } from "@green-goods/shared/hooks/work/useDrafts";
import type { Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { expect, userEvent, within } from "storybook/test";
import { FIXTURE_IMAGE_WASTE, FIXTURE_WORK_MEDIA } from "../../../../../shared/.storybook/fixtures";
import { expectItemRowsFit } from "../../../../../shared/.storybook/itemRowFit";
import { DraftCard } from "./DraftCard";

const now = Date.now();

function makeDraft(overrides: Partial<DraftWithImages> = {}): DraftWithImages {
  return {
    id: "draft-1",
    userAddress: "0xabcdef1234567890abcdef1234567890abcdef12" as Address,
    chainId: 11155111,
    gardenAddress: "0x1234567890abcdef1234567890abcdef12345678" as Address,
    actionUID: 1,
    feedback: "Looking good so far",
    timeSpentMinutes: 45,
    currentStep: "media",
    firstIncompleteStep: "media",
    createdAt: now - 86400000,
    updatedAt: now - 3600000,
    images: [],
    thumbnailUrl: null,
    ...overrides,
  };
}

const draftNoImages = makeDraft();

const draftWithImages = makeDraft({
  id: "draft-2",
  firstIncompleteStep: "details",
  currentStep: "details",
  images: [
    { id: "img-1", file: new File([""], "photo1.jpg"), url: FIXTURE_WORK_MEDIA[0] },
    { id: "img-2", file: new File([""], "photo2.jpg"), url: FIXTURE_WORK_MEDIA[1] },
    { id: "img-3", file: new File([""], "photo3.jpg"), url: FIXTURE_WORK_MEDIA[2] },
  ],
  thumbnailUrl: FIXTURE_WORK_MEDIA[0],
});

const draftReviewStep = makeDraft({
  id: "draft-3",
  firstIncompleteStep: "review",
  currentStep: "review",
  images: [{ id: "img-1", file: new File([""], "photo1.jpg"), url: FIXTURE_IMAGE_WASTE }],
  thumbnailUrl: FIXTURE_IMAGE_WASTE,
  updatedAt: now - 60000,
});

const draftIntroStep = makeDraft({
  id: "draft-4",
  firstIncompleteStep: "intro",
  currentStep: "intro",
  gardenAddress: null,
  actionUID: null,
  feedback: "",
  updatedAt: now - 86400000 * 3,
});

const meta: Meta<typeof DraftCard> = {
  title: "Client/Cards/DraftCard",
  component: DraftCard,
  tags: ["autodocs"],
  globals: { viewport: { value: "mobile" } },
  argTypes: {
    draft: {
      control: "object",
      description: "Draft record with images array and thumbnail URL",
    },
    actionTitle: {
      control: "text",
      description: "Title of the action this draft belongs to. Falls back to 'Untitled Draft'.",
    },
    className: {
      control: "text",
      description: "Additional CSS classes for the root card element",
    },
    onResume: {
      description: "Callback when the card body is clicked to resume editing the draft",
    },
    onDelete: {
      description: "Callback when the delete button is clicked (event propagation is stopped)",
    },
  },
};

export default meta;
type Story = StoryObj<typeof DraftCard>;

export const Default: Story = {
  args: {
    draft: draftWithImages,
    actionTitle: "Plant Native Trees",
    onResume: () => {},
    onDelete: () => {},
  },
};

export const NoImages: Story = {
  args: {
    draft: draftNoImages,
    actionTitle: "Soil Sampling",
    onResume: () => {},
    onDelete: () => {},
  },
};

export const UntitledDraft: Story = {
  args: {
    draft: draftIntroStep,
    onResume: () => {},
    onDelete: () => {},
  },
};

export const ReviewStep: Story = {
  args: {
    draft: draftReviewStep,
    actionTitle: "Compost Workshop",
    onResume: () => {},
    onDelete: () => {},
  },
};

export const DarkMode: Story = {
  args: {
    draft: draftWithImages,
    actionTitle: "Plant Native Trees",
    onResume: () => {},
    onDelete: () => {},
  },
  decorators: [
    (Story) => (
      <div data-theme="dark" className="bg-bg-white-0 p-4">
        <Story />
      </div>
    ),
  ],
};

export const Gallery: Story = {
  render: () => (
    <div className="flex flex-col gap-3 max-w-sm">
      <p className="text-xs text-text-sub-600 font-medium">With images (Step 3 of 4)</p>
      <DraftCard
        draft={draftWithImages}
        actionTitle="Plant Native Trees"
        onResume={() => {}}
        onDelete={() => {}}
      />

      <p className="text-xs text-text-sub-600 font-medium">No images (Step 2 of 4)</p>
      <DraftCard
        draft={draftNoImages}
        actionTitle="Soil Sampling"
        onResume={() => {}}
        onDelete={() => {}}
      />

      <p className="text-xs text-text-sub-600 font-medium">Untitled (Step 1 of 4)</p>
      <DraftCard draft={draftIntroStep} onResume={() => {}} onDelete={() => {}} />

      <p className="text-xs text-text-sub-600 font-medium">Review step (Step 4 of 4)</p>
      <DraftCard
        draft={draftReviewStep}
        actionTitle="Compost Workshop"
        onResume={() => {}}
        onDelete={() => {}}
      />
    </div>
  ),
};

export const Interactive: Story = {
  args: {
    draft: draftWithImages,
    actionTitle: "Plant Native Trees",
    onResume: () => {},
    onDelete: () => {},
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify draft badge is present
    await expect(canvas.getByText("Draft")).toBeVisible();

    // The step and the photos on one line
    await expect(canvas.getByText("Step 3 of 4 · 3 photos")).toBeVisible();

    // Verify delete button exists with accessible label
    const deleteButton = canvas.getByRole("button", { name: /delete draft/i });
    await expect(deleteButton).toBeVisible();

    // Click delete button
    await userEvent.click(deleteButton);
  },
};

/** The promise a draft keeps (DL-062): the hub's Weeding promise, for Planting Event work. */
const weedingLink = {
  commitmentId: "7",
  requirementIndex: 0,
  actionUID: 1,
  garden: "0x1234567890abcdef1234567890abcdef12345678" as Address,
  commitmentTitle: "Weeding",
  requirementLabel: "1",
  returnTo: "/home/0x1234567890abcdef1234567890abcdef12345678/commitments/7",
};
const promiseDraft = (id: string, takesUp: boolean) =>
  makeDraft({
    id,
    firstIncompleteStep: "details",
    currentStep: "details",
    images: [{ id: `${id}-photo`, file: new File([""], "weeds.jpg"), url: FIXTURE_WORK_MEDIA[0] }],
    thumbnailUrl: FIXTURE_WORK_MEDIA[0],
    updatedAt: now - 120000,
    linkIntent: takesUp ? { ...weedingLink, takesUp: true } : weedingLink,
  });

/**
 * Drafts for a promise as Home's Continue lists them (Your Work › Pending adds Delete): one for a
 * promise of the member's own, and one for an Open ask, whose line says it takes the ask up first.
 */
export const ForAPromiseOrAnAsk: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <DraftCard
        draft={promiseDraft("draft-own", false)}
        actionTitle="Planting Event"
        onResume={() => {}}
      />
      <DraftCard
        draft={promiseDraft("draft-ask", true)}
        actionTitle="Planting Event"
        onResume={() => {}}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Step 3 of 4 · 1 photo")).toBeVisible();
    await expect(canvas.getByText("Takes up an ask · Step 3 of 4 · 1 photo")).toBeVisible();
  },
};

export const ForAPromiseOrAnAskSpanish: Story = {
  render: ForAPromiseOrAnAsk.render,
  globals: { locale: "es", viewport: { value: "mobileSmall" } },
};

export const ForAPromiseOrAnAskPortuguese: Story = {
  render: ForAPromiseOrAnAsk.render,
  globals: { locale: "pt", viewport: { value: "mobileSmall" } },
};

/** The take-up phrase each language leads an Open ask's draft line with. */
const TAKE_UP_PHRASE = {
  en: { messages: enMessages, phrase: "Takes up an ask" },
  es: { messages: esMessages, phrase: "Acepta un pedido" },
  pt: { messages: ptMessages, phrase: "Aceita um pedido" },
} as const;

/**
 * An Open ask's draft in Your Work › Pending on a 320px phone: the list's 16px gutter, Delete in
 * the right slot, in each language. The take-up phrase leads the line, so it stays whole beside
 * Delete; the step and photo count after it give way first, as the row's one-line detail rule
 * allows (CodeRabbit on #1334).
 */
export const TakesUpAnAskBesideDeleteAt320: Story = {
  tags: ["storybook-ci"],
  render: () => (
    <div className="flex flex-col gap-4">
      {Object.entries(TAKE_UP_PHRASE).map(([locale, { messages }]) => (
        <IntlProvider key={locale} locale={locale} messages={messages}>
          <div data-locale={locale} className="w-[320px] px-4">
            <DraftCard
              draft={promiseDraft(`draft-ask-${locale}`, true)}
              actionTitle="Planting Event"
              onResume={() => {}}
              onDelete={() => {}}
            />
          </div>
        </IntlProvider>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    await document.fonts.ready;
    const frames = [...canvasElement.querySelectorAll<HTMLElement>("[data-locale]")];
    await expect(frames).toHaveLength(3);
    for (const frame of frames) {
      const { phrase } = TAKE_UP_PHRASE[frame.dataset.locale as keyof typeof TAKE_UP_PHRASE];
      const remove = frame.querySelector<HTMLElement>(".gg-item-row-action button");
      await expect(remove).toBeVisible();
      const line = frame.querySelector<HTMLElement>(".gg-item-row-detail-text");
      const words = line?.firstChild;
      await expect(line?.textContent?.startsWith(`${phrase} · `)).toBe(true);
      if (!line || !words) return;
      // The phrase's own glyphs end inside the line, short of where an ellipsis would start.
      const glyphs = document.createRange();
      glyphs.setStart(words, 0);
      glyphs.setEnd(words, phrase.length);
      const context = document.createElement("canvas").getContext("2d");
      if (!context) return;
      context.font = getComputedStyle(line).font;
      const ellipsis = context.measureText("…").width;
      await expect(glyphs.getBoundingClientRect().right).toBeLessThanOrEqual(
        line.getBoundingClientRect().right - ellipsis
      );
      // And the row keeps its one height and its one detail line.
      await expectItemRowsFit(frame);
    }
  },
};

export const Mobile: Story = {
  args: {
    draft: draftWithImages,
    actionTitle: "Plant Native Trees",
    onResume: () => {},
    onDelete: () => {},
  },
  globals: { viewport: { value: "mobile" } },
};
