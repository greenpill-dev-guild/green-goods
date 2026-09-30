import en from "@green-goods/shared/i18n/en";
import es from "@green-goods/shared/i18n/es";
import pt from "@green-goods/shared/i18n/pt";
import type { Work } from "@green-goods/shared/types/domain";
import type { Decorator, Meta, StoryObj } from "@storybook/react";
import { IntlProvider } from "react-intl";
import { fn } from "storybook/test";
import { JOURNEY_GARDEN_RECORD } from "../../../../../shared/.storybook/clientJourneyFixtures";
import { withAppPage, withRouter } from "../../../../../shared/.storybook/decorators";
import { FIXTURE_WORK_MEDIA } from "../../../../../shared/.storybook/fixtures";
import { QUEUED_WORK_PAGES } from "../../../../../shared/.storybook/pendingWorkFixtures";
import { TopNav } from "@/components/Navigation";
import { WorkStatusNotice } from "./WorkStatusNotice";
import { WorkUploadFooter } from "./WorkUploadFooter";
import { WorkViewSection } from "./WorkViewSection";

const MESSAGES = { en, es, pt } as const;
type Locale = keyof typeof MESSAGES;

/** Stories pick a language through `parameters.locale`; the global decorator stays English. */
const withLocale: Decorator = (Story, context) => {
  const locale = (context.parameters.locale as Locale | undefined) ?? "en";
  return (
    <IntlProvider locale={locale} messages={MESSAGES[locale]}>
      <Story />
    </IntlProvider>
  );
};

/** The work, with the time it took, as the queue keeps it on this phone. */
function page(work: Work): Work {
  const metadata = JSON.parse(work.metadata) as Record<string, unknown>;
  return {
    ...work,
    media: [FIXTURE_WORK_MEDIA[0], FIXTURE_WORK_MEDIA[1]],
    metadata: JSON.stringify({ ...metadata, timeSpentMinutes: 90 }),
  };
}

interface QueuedWorkPageProps {
  work: Work;
  isOnline?: boolean;
}

/**
 * The gardener's own queued work, as its page draws it (D24, D30): why it's
 * still on this phone in a notice under the heading, and only the acts in the
 * fixed bar, Discard and the primary as two equal halves, or one full-width act.
 */
function QueuedWorkPage({ work, isOnline = true }: QueuedWorkPageProps) {
  return (
    <article>
      <TopNav onBackClick={fn()} overlay />
      <div className="padded pt-20">
        <WorkViewSection
          garden={JOURNEY_GARDEN_RECORD}
          work={work}
          workMetadata={null}
          metadataStatus="success"
          viewingMode="gardener"
          actionTitle={work.title}
          effectiveStatus={work.status}
          onDownloadData={fn()}
          onShare={fn()}
          notice={<WorkStatusNotice work={work} isOnline={isOnline} />}
          footer={
            <WorkUploadFooter
              work={work}
              isOnline={isOnline}
              pausedForDataSaver={false}
              onPrepareNow={fn()}
              onRetry={fn()}
              isRetrying={false}
              onTryAgain={fn()}
              isTryingAgain={false}
              onDiscard={fn()}
              isDiscarding={false}
            />
          }
          reserveFooterSpace
          footerSpacerClassName="h-[calc(112px+env(safe-area-inset-bottom))]"
        />
      </div>
    </article>
  );
}

const meta: Meta<typeof QueuedWorkPage> = {
  title: "Client/Work/WorkStatusNotice",
  component: QueuedWorkPage,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "mobile" } },
  decorators: [withLocale, withAppPage, withRouter(["/home"])],
};

export default meta;
type Story = StoryObj<typeof QueuedWorkPage>;

/** Frame `work-ready`: saved on this phone, not sent; Discard and Upload now. */
export const Ready: Story = { args: { work: page(QUEUED_WORK_PAGES.ready) } };

/** Frame `work-attention`: the full sentence stays here; Discard and Try Again. */
export const Attention: Story = { args: { work: page(QUEUED_WORK_PAGES.attention) } };

/** Frame `work-checking`: may already be sent, so only Check again. */
export const Checking: Story = { args: { work: page(QUEUED_WORK_PAGES.checking) } };

export const ReadyOffline: Story = {
  args: { work: page(QUEUED_WORK_PAGES.ready), isOnline: false },
};

/** The longest labels: every act still fits its half on one line at 360px (D24). */
export const AttentionPortuguese: Story = {
  args: { work: page(QUEUED_WORK_PAGES.attention) },
  parameters: { locale: "pt" },
};

export const AttentionSpanish: Story = {
  args: { work: page(QUEUED_WORK_PAGES.attention) },
  parameters: { locale: "es" },
};

/** Every notice keeps its reason to two lines in each language (D30). */
export const ReadySpanish: Story = {
  args: { work: page(QUEUED_WORK_PAGES.ready) },
  parameters: { locale: "es" },
};

export const ReadyPortuguese: Story = {
  args: { work: page(QUEUED_WORK_PAGES.ready) },
  parameters: { locale: "pt" },
};

export const CheckingSpanish: Story = {
  args: { work: page(QUEUED_WORK_PAGES.checking) },
  parameters: { locale: "es" },
};

export const CheckingPortuguese: Story = {
  args: { work: page(QUEUED_WORK_PAGES.checking) },
  parameters: { locale: "pt" },
};
