import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Address, Work } from "@green-goods/shared/types/domain";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { fn } from "storybook/test";
import { hoursAgo } from "../../../../../shared/.storybook/fixtures";
import { WorkUploadFooter } from "./WorkUploadFooter";

const PHONE_VIEWPORT = {
  workUploadFooterPhone360x780: {
    name: "Phone 360 x 780",
    styles: { width: "360px", height: "780px" },
    type: "mobile",
  },
} as const;

const MESSAGES = { en, es, pt } as const;
type Locale = keyof typeof MESSAGES;

/** The gardener's own work, saved on this device in the state preparation left it. */
function queuedWork(submissionState: string, blockedReason?: string): Work {
  return {
    id: "job-planting",
    title: "Planting Event",
    actionUID: 44,
    gardenerAddress: "0x2aa64e6d80390f5c017f0313cb908051be2fd35e" as Address,
    gardenAddress: "0xf401f34378384713222d1d21f63359cc4e8a858a" as Address,
    feedback: "",
    metadata: JSON.stringify({ submissionState, blockedReason }),
    media: [],
    createdAt: hoursAgo(3),
    status: "offline",
  };
}

/** Stories pick a language through `parameters.locale`; the global decorator stays English. */
const withLocale: Decorator = (Story, context) => {
  const locale = (context.parameters.locale as Locale | undefined) ?? "en";
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </IntlProvider>
  );
};

/**
 * The work detail footer for queued work at phone width: waiting work points to Your Work,
 * work that needs attention can be tried again or discarded, a failed upload keeps Upload now,
 * and a sent work can be checked again.
 */
const meta: Meta<typeof WorkUploadFooter> = {
  title: "Client/Work/WorkUploadFooter",
  component: WorkUploadFooter,
  parameters: { layout: "fullscreen", viewport: { options: PHONE_VIEWPORT } },
  globals: { viewport: { value: "workUploadFooterPhone360x780" } },
  decorators: [withLocale],
  args: {
    isOnline: true,
    onRetry: fn(),
    isRetrying: false,
    onOpenUploads: fn(),
    onTryAgain: fn(),
    isTryingAgain: false,
    onDiscard: fn(),
    isDiscarding: false,
  },
};

export default meta;
type Story = StoryObj<typeof WorkUploadFooter>;

export const Waiting: Story = {
  args: { work: queuedWork("ready") },
};

export const WaitingOffline: Story = {
  args: { work: queuedWork("ready"), isOnline: false },
};

export const PhotoConverting: Story = {
  args: { work: queuedWork("photo-pending") },
};

/** The longest refusal, in the language where it runs longest. */
export const BlockedSpanish: Story = {
  args: { work: queuedWork("blocked", "NotInWorkRegistry") },
  parameters: { locale: "es" },
};

export const BlockedPortuguese: Story = {
  args: { work: queuedWork("blocked", "NotActiveAction") },
  parameters: { locale: "pt" },
};

export const SendFailed: Story = {
  args: { work: queuedWork("retry-required") },
};

export const Sent: Story = {
  args: { work: queuedWork("awaiting-confirmation") },
};
