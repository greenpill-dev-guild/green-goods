import { WORK_UPLOAD_POLICY_VERSION } from "@green-goods/shared/modules/work/upload-policy";
import { useIntl } from "react-intl";
import { EditorialHeading, EditorialLede, EditorialLinkArrow } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { publicCuration } from "@/content/publicCuration";

const sections = ["public", "permission", "content", "review", "deletion", "acceptance"] as const;

export default function Terms() {
  const { formatMessage } = useIntl();
  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={publicCuration.heroImagePath}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        kicker={formatMessage({ id: "public.footer.terms" })}
        titleId="public-terms-title"
        title={formatMessage({ id: "public.terms.title" })}
        lede={formatMessage({ id: "public.terms.lede" })}
      />
      <article
        aria-labelledby="public-terms-title"
        className="bg-bg-weak-50 px-6 pt-32 pb-20 sm:px-10 sm:pt-36 md:pt-40 md:pb-28"
      >
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-text-sub-600">
            {formatMessage({ id: "public.terms.version" }, { version: WORK_UPLOAD_POLICY_VERSION })}
          </p>
          {sections.map((section) => (
            <section
              key={section}
              className="mt-10 border-t border-stroke-soft-200 pt-7"
              aria-labelledby={`terms-${section}`}
            >
              <EditorialHeading id={`terms-${section}`} size="sub">
                {formatMessage({ id: `public.terms.${section}.title` })}
              </EditorialHeading>
              <EditorialLede className="mt-4">
                {formatMessage({ id: `public.terms.${section}.body` })}
              </EditorialLede>
            </section>
          ))}
          <div className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
            {(["report", "deletion"] as const).map((kind) => (
              <EditorialLinkArrow
                key={kind}
                to={`/contact#${kind === "report" ? "report-a-concern" : "account-deletion"}`}
              >
                {formatMessage({ id: `public.contact.${kind}.title` })}
              </EditorialLinkArrow>
            ))}
            <EditorialLinkArrow to="/privacy">
              {formatMessage({ id: "public.footer.privacy" })}
            </EditorialLinkArrow>
          </div>
        </div>
      </article>
      <PublicFooter variant="soil" />
    </>
  );
}
