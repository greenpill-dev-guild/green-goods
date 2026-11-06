import { useIntl } from "react-intl";
import { EditorialHeading, EditorialLede, EditorialLinkArrow } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { publicCuration } from "@/content/publicCuration";

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
          {(["deletion", "report"] as const).map((kind) => (
            <div
              key={kind}
              id={kind === "deletion" ? "account-deletion" : "report-a-concern"}
              className="mt-10 scroll-mt-24 border-t border-stroke-soft-200 pt-7"
            >
              <EditorialHeading size="sub">
                {formatMessage({ id: `public.contact.${kind}.title` })}
              </EditorialHeading>
              <EditorialLede className="mt-4">
                {formatMessage({ id: `public.contact.${kind}.body` })}
              </EditorialLede>
              <div className="mt-6">
                <EditorialLinkArrow
                  to={`mailto:contact@greengoods.app?subject=${encodeURIComponent(kind === "deletion" ? "Delete my Green Goods account" : "Report a Green Goods concern")}`}
                >
                  {formatMessage({ id: `public.contact.${kind}.action` })}
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
