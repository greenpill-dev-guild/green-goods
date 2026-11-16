import { WORK_UPLOAD_POLICY_VERSION } from "@green-goods/shared/modules/work/upload-policy";
import { useIntl } from "react-intl";
import { EditorialHeading, EditorialLede, EditorialLinkArrow } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { publicCuration } from "@/content/publicCuration";
import { CONTACT_ANCHORS } from "./contactAnchors";

// The page renders before its locale catalogue loads, so every message carries its English
// text as the fallback. The locale-coverage test keeps each fallback equal to en.json.
const SECTIONS = [
  {
    key: "public",
    title: { id: "public.terms.public.title", defaultMessage: "Know what becomes public" },
    body: {
      id: "public.terms.public.body",
      defaultMessage:
        "Files uploaded from the Green Goods App or the Green Goods Hub go to public IPFS, and submitted work records go to a public blockchain. Steward approval controls the website listing; it does not make an uploaded file private. Messaging drafts stay private in the reporting service until you separately confirm the exact report for publication. Public records and files may be copied and may remain permanently.",
    },
  },
  {
    key: "permission",
    title: {
      id: "public.terms.permission.title",
      defaultMessage: "Share only what you have permission to share",
    },
    body: {
      id: "public.terms.permission.body",
      defaultMessage:
        "Describe real work truthfully. Share only material you own or have permission to publish, and obtain permission from every identifiable adult shown. Do not upload identifiable children or sensitive personal information, including private home addresses, identity documents, passwords, private keys or recovery phrases. Crop or obscure people and private details before choosing a file.",
    },
  },
  {
    key: "content",
    title: { id: "public.terms.content.title", defaultMessage: "Content that is not allowed" },
    body: {
      id: "public.terms.content.body",
      defaultMessage:
        "Do not post abuse, harassment, hate, threats, sexual content or exploitation, unlawful content, fraud, spam, or material that infringes another person’s rights. Do not impersonate someone or submit misleading evidence of work.",
    },
  },
  {
    key: "review",
    title: { id: "public.terms.review.title", defaultMessage: "Review and concerns" },
    body: {
      id: "public.terms.review.body",
      defaultMessage:
        "Garden stewards review submitted work and may decline it. To report harmful content or behavior, use Report a Concern in Profile Help or on the Contact page. Include the public record link and describe the concern. Afolabi and Matt monitor contact@greengoods.app, acknowledge reports and explain the next step. Reporting does not automatically hide or erase a public record.",
    },
  },
  {
    key: "deletion",
    title: { id: "public.terms.deletion.title", defaultMessage: "Removal and its limits" },
    body: {
      id: "public.terms.deletion.body",
      defaultMessage:
        "Use Request Account Deletion in Profile Help or on the Contact page to ask for removal of information Green Goods and its providers hold off chain. Afolabi and Matt handle deletion requests within 30 days and explain what must remain. Blockchain history cannot be erased. Removing a Green Goods listing or its own files or IPFS pins cannot remove independent copies. The privacy policy explains these limits.",
    },
  },
  {
    key: "acceptance",
    title: { id: "public.terms.acceptance.title", defaultMessage: "Your agreement" },
    body: {
      id: "public.terms.acceptance.body",
      defaultMessage:
        "Review these rules the first time you sign in after a new version is published. You can skip and keep browsing. Before you upload, agree to the current rules. The app remembers the agreement for this account in this browser. Submitted work keeps the version and acceptance time in its metadata.",
    },
  },
];

const RELATED_LINKS = [
  {
    to: `/contact#${CONTACT_ANCHORS.report}`,
    label: { id: "public.contact.report.title", defaultMessage: "Report a concern" },
  },
  {
    to: `/contact#${CONTACT_ANCHORS.deletion}`,
    label: { id: "public.contact.deletion.title", defaultMessage: "Request account deletion" },
  },
  { to: "/privacy", label: { id: "public.footer.privacy", defaultMessage: "Privacy" } },
];

export default function Terms() {
  const { formatMessage } = useIntl();
  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        kicker={formatMessage({ id: "public.footer.terms", defaultMessage: "Terms of Use" })}
        titleId="public-terms-title"
        title={formatMessage({ id: "public.terms.title", defaultMessage: "Share work with care" })}
        lede={formatMessage({
          id: "public.terms.lede",
          defaultMessage: "The rules for contributing work, photos, audio and text to Green Goods.",
        })}
      />
      <article
        aria-labelledby="public-terms-title"
        className="bg-bg-weak-50 px-6 pt-32 pb-20 sm:px-10 sm:pt-36 md:pt-40 md:pb-28"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-text-sub-600">
            {formatMessage(
              { id: "public.terms.version", defaultMessage: "Policy version: {version}" },
              { version: WORK_UPLOAD_POLICY_VERSION }
            )}
          </p>
          {SECTIONS.map(({ key, title, body }) => (
            <section
              key={key}
              className="mt-10 border-t border-stroke-soft-200 pt-7"
              aria-labelledby={`terms-${key}`}
            >
              <EditorialHeading id={`terms-${key}`} size="sub">
                {formatMessage(title)}
              </EditorialHeading>
              <EditorialLede className="mt-4">{formatMessage(body)}</EditorialLede>
            </section>
          ))}
          {/* One link per line, so no label wraps beside another in any language. */}
          <div className="mt-8 flex flex-col items-start gap-4">
            {RELATED_LINKS.map(({ to, label }) => (
              <EditorialLinkArrow key={to} to={to}>
                {formatMessage(label)}
              </EditorialLinkArrow>
            ))}
          </div>
        </div>
      </article>
      <PublicFooter variant="soil" />
    </>
  );
}
