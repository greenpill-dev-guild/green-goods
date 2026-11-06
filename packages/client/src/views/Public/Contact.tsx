import { useIntl } from "react-intl";
import { EditorialHeading, EditorialLede, EditorialLinkArrow } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { publicCuration } from "@/content/publicCuration";

const contactRequests = [
  {
    anchor: "account-deletion",
    subject: "Delete my Green Goods account",
    title: {
      id: "public.contact.deletion.title",
      defaultMessage: "Request account deletion",
    },
    body: {
      id: "public.contact.deletion.body",
      defaultMessage:
        "Ask us to remove your account information and the off-chain data Green Goods and its providers hold about you. Afolabi and Matt handle requests within 30 days and may ask you to confirm control of the account. Public blockchain records cannot be erased, and independent copies of public files may remain. Review the privacy policy before sending your request. Never send a password, private key or recovery phrase.",
    },
    action: {
      id: "public.contact.deletion.action",
      defaultMessage: "Email an Account Deletion Request",
    },
  },
  {
    anchor: "report-a-concern",
    subject: "Report a Green Goods concern",
    title: {
      id: "public.contact.report.title",
      defaultMessage: "Report a concern",
    },
    body: {
      id: "public.contact.report.body",
      defaultMessage:
        "Email the public work or listing link and describe the concern. Afolabi and Matt monitor this mailbox and will reply to acknowledge your report and explain the next step. Avoid sending sensitive information about other people. Sending an email does not automatically hide a public record.",
    },
    action: {
      id: "public.contact.report.action",
      defaultMessage: "Email a Report",
    },
  },
];

export default function Contact() {
  const { formatMessage } = useIntl();
  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        kicker={formatMessage({
          id: "public.contact.people.title",
          defaultMessage: "Contact Green Goods",
        })}
        titleId="public-contact-title"
        title={formatMessage({ id: "public.contact.title", defaultMessage: "A person to talk to" })}
        lede={formatMessage({
          id: "public.contact.lede",
          defaultMessage:
            "Questions, partnership ideas, or help with your information: reach the people tending Green Goods.",
        })}
      />
      <section
        className="bg-bg-weak-50 px-6 pt-32 pb-20 sm:px-10 sm:pt-36 md:pt-40 md:pb-28"
        aria-labelledby="contact-people"
      >
        <div className="mx-auto max-w-3xl">
          <EditorialHeading id="contact-people">
            {formatMessage({
              id: "public.contact.people.title",
              defaultMessage: "Contact Green Goods",
            })}
          </EditorialHeading>
          <EditorialLede className="mt-4">
            {formatMessage({
              id: "public.contact.people.body",
              defaultMessage:
                "Green Goods operates this service. Afolabi and Matt monitor this mailbox. Email contact@greengoods.app for human support with the app, messaging reports, partnerships and privacy. Tell us what you need; never send passwords, private keys or recovery phrases.",
            })}
          </EditorialLede>
          <div className="mt-6">
            <EditorialLinkArrow
              className="border-primary-on-surface/35 text-primary-on-surface hover:border-primary-on-surface hover:text-primary-on-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-on-surface"
              to="mailto:contact@greengoods.app"
            >
              contact@greengoods.app
            </EditorialLinkArrow>
          </div>
          <div className="mt-10 border-t border-stroke-soft-200 pt-7">
            <EditorialHeading size="sub">
              {formatMessage({
                id: "public.contact.privacy.title",
                defaultMessage: "Your information and choices",
              })}
            </EditorialHeading>
            <EditorialLede className="mt-4">
              {formatMessage({
                id: "public.contact.privacy.body",
                defaultMessage:
                  "Use the same email for privacy and deletion requests. We handle deletion requests within 30 days. The privacy policy explains messaging consent, private drafts, public records, providers and the limits of deletion.",
              })}
            </EditorialLede>
            <div className="mt-6">
              <EditorialLinkArrow
                className="border-primary-on-surface/35 text-primary-on-surface hover:border-primary-on-surface hover:text-primary-on-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-on-surface"
                to="/privacy"
              >
                {formatMessage({
                  id: "public.contact.privacy.link",
                  defaultMessage: "Read the Privacy Policy",
                })}
              </EditorialLinkArrow>
            </div>
          </div>
          {contactRequests.map(({ anchor, subject, title, body, action }) => (
            <div
              key={anchor}
              id={anchor}
              className="mt-10 scroll-mt-24 border-t border-stroke-soft-200 pt-7"
            >
              <EditorialHeading size="sub">{formatMessage(title)}</EditorialHeading>
              <EditorialLede className="mt-4">{formatMessage(body)}</EditorialLede>
              <div className="mt-6">
                <EditorialLinkArrow
                  to={`mailto:contact@greengoods.app?subject=${encodeURIComponent(subject)}`}
                >
                  {formatMessage(action)}
                </EditorialLinkArrow>
              </div>
            </div>
          ))}
        </div>
      </section>
      <PublicFooter variant="soil" />
    </>
  );
}
