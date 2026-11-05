import { useIntl } from "react-intl";
import { EditorialHeading, EditorialLede, EditorialLinkArrow } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { publicCuration } from "@/content/publicCuration";

const SECTIONS = [
  {
    key: "service",
    title: "Who runs Green Goods",
    body: "Green Goods runs this service. For human support and privacy requests, email contact@greengoods.app.",
  },
  {
    key: "collection",
    title: "What messaging collects",
    body: "When you use the reporting assistant, the service receives message text, files and photos you send, chat and sender identifiers, delivery metadata, and your choices and consent records. Linking a Green Goods account also records the account address and proof of control. We use this information to prepare and review your report, link the right account, deliver replies, prevent misuse, and resolve support or publication problems.",
  },
  {
    key: "consent",
    title: "Your choice to use the assistant",
    body: "The assistant asks for explicit agreement before processing a report. Limited intake information is held to deliver that notice and enforce your choices. Send STOP to withdraw processing consent and stop the assistant. Send START to return to the consent step. Send DELETE to request removal of unpublished private content. These commands do not automatically delete your Green Goods account or public records.",
  },
  {
    key: "publication",
    title: "Private drafts and public records",
    body: "A messaging draft stays private within the reporting service until you separately confirm the exact report for publication. Account linking and agreement to processing are not permission to publish. A confirmed report can publish selected text, photos, account information and work records to a public blockchain and IPFS. Public records may be permanent and copied by others. Green Goods cannot erase blockchain records or guarantee removal of IPFS or third-party copies. Check the summary and avoid including personal information you do not want public.",
  },
  {
    key: "providers",
    title: "Services that help process information",
    body: "Your messaging platform handles delivery under its own privacy terms. Depending on the enabled configuration, Green Goods may send relevant message or file content to OpenAI for extraction or transcription and to Typesafe/Jev for interpretation. Voice processing requires a separate choice when offered. Public uploads may use Pinata and IPFS after publication confirmation. Provider availability varies by deployment; contact us to ask which processors apply to your report.",
  },
  {
    key: "retention",
    title: "Retention and deletion",
    body: "The reporting service has scheduled cleanup for pre-consent intake and inactive drafts, and queues private-content removal after cancellation, publication or a deletion request. Removal keeps limited identifiers, digests, consent and operation receipts, and records needed to reconcile an uncertain publication. It does not erase public copies or the messaging platform’s own records. We handle deletion requests within 30 days and explain any information that must remain. For account-related requests, email contact@greengoods.app; we may need to confirm that you control the affected chat or account.",
  },
  {
    key: "analytics",
    title: "Website and app analytics",
    body: "When configured, Green Goods uses PostHog for page views, usage events, browser and device information, error reports, and session recordings. A signed-in account may be identified by its account address. Sentry may collect error reports and masked recordings after an error. Reporting, review and account-recovery link pages block session recordings and element-level capture, and hide private link identifiers from analytics. Messaging analytics use message metadata and hashed user identifiers rather than raw message text. The app also uses local browser storage for sessions, settings and drafts; clearing app data can remove unpublished work stored on that device.",
  },
  {
    key: "subscriptions",
    title: "If you subscribe to updates",
    body: "When you choose to subscribe, the service sends your email address, signup source, language and consent time to Resend to manage email updates. This is separate from messaging-report consent. Contact us if you want to stop receiving updates or ask about your subscription information.",
  },
  {
    key: "choices",
    title: "Ask for help or exercise your choices",
    body: "Email contact@greengoods.app to ask about your information, request access or correction, withdraw consent, or request deletion. Say which service and chat or account the request concerns. Never send a private key, recovery phrase or password. A person will handle your request; STOP and DELETE remain available in the reporting chat.",
  },
  {
    key: "successor",
    title: "If responsibility changes",
    body: "If responsibility moves to a successor Green Goods entity, relevant service information may transfer with it so the service can continue. We will give notice and require the successor to maintain privacy protections and honor existing choices. We will explain material changes before using information for a new purpose.",
  },
] as const;

export default function Privacy() {
  const { formatMessage, formatDate } = useIntl();
  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        kicker={formatMessage({ id: "public.privacy.kicker", defaultMessage: "Privacy Policy" })}
        titleId="public-privacy-title"
        title={formatMessage({
          id: "public.privacy.title",
          defaultMessage: "Your information, with care",
        })}
        lede={formatMessage({
          id: "public.privacy.lede",
          defaultMessage:
            "How Green Goods handles information on the website, in the app, and when you report work through messaging.",
        })}
      />
      <article
        className="bg-bg-weak-50 px-6 pt-32 pb-20 sm:px-10 sm:pt-36 md:pt-40 md:pb-28"
        aria-labelledby="public-privacy-title"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-text-sub-600">
            {formatMessage(
              { id: "public.privacy.updated", defaultMessage: "Privacy policy updated: {date}" },
              {
                date: (
                  <time dateTime="2026-11-04">
                    {formatDate("2026-11-04T12:00:00Z", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </time>
                ),
              }
            )}
          </p>
          {SECTIONS.map((section) => (
            <section
              key={section.key}
              className="mt-10 border-t border-stroke-soft-200 pt-7"
              aria-labelledby={`privacy-${section.key}`}
            >
              <EditorialHeading id={`privacy-${section.key}`} size="sub">
                {formatMessage({
                  id: `public.privacy.${section.key}.title`,
                  defaultMessage: section.title,
                })}
              </EditorialHeading>
              <EditorialLede className="mt-4">
                {formatMessage({
                  id: `public.privacy.${section.key}.body`,
                  defaultMessage: section.body,
                })}
              </EditorialLede>
            </section>
          ))}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            <EditorialLinkArrow
              className="border-primary-on-surface/35 text-primary-on-surface hover:border-primary-on-surface hover:text-primary-on-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-on-surface"
              to="mailto:contact@greengoods.app"
            >
              contact@greengoods.app
            </EditorialLinkArrow>
            <EditorialLinkArrow
              className="border-primary-on-surface/35 text-primary-on-surface hover:border-primary-on-surface hover:text-primary-on-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-on-surface"
              to="/contact"
            >
              {formatMessage({
                id: "public.privacy.contact",
                defaultMessage: "Contact Green Goods",
              })}
            </EditorialLinkArrow>
          </div>
        </div>
      </article>
      <PublicFooter variant="soil" />
    </>
  );
}
