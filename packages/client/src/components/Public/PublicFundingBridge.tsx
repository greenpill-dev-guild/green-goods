import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { useIntl } from "react-intl";
import {
  EditorialDivider,
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialLinkArrow,
  EditorialNumeral,
  EditorialReadDeeper,
} from "./atoms";

/**
 * PublicFundingBridge - cardless homepage explanation of how public support
 * reaches Gardens. It keeps the homepage trust-first and routes deeper action
 * to `/fund` instead of recreating the funding flow here.
 */
export function PublicFundingBridge() {
  const { formatMessage } = useIntl();
  const { ref: sectionRef, revealed } = useInViewReveal<HTMLElement>();

  return (
    <section
      ref={sectionRef}
      data-revealed={revealed}
      className="editorial-section-reveal @container/funding bg-editorial-warm px-6 py-20 sm:px-10 md:py-28"
      aria-labelledby="public-funding-bridge-title"
    >
      <div className="mx-auto max-w-7xl">
        <div className="editorial-cascade grid gap-12 sm:gap-8 @min-[70rem]:grid-cols-[1fr_1.45fr] @min-[70rem]:gap-24">
          <div>
            <EditorialKicker className="mb-5">
              {formatMessage({
                id: "public.home.funding.kicker",
                defaultMessage: "§ 05: Support Gardens",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-funding-bridge-title">
              {formatMessage({
                id: "public.home.funding.title",
                defaultMessage: "Help communities keep going.",
              })}
            </EditorialHeading>
            <div className="mt-5 max-w-md">
              <EditorialLede>
                {formatMessage({
                  id: "public.home.funding.body",
                  defaultMessage:
                    "Explore a Garden’s work before choosing how to support it. Give to its shared fund today, or explore an endowment for support over time.",
                })}
              </EditorialLede>
            </div>
            <div className="mt-7">
              <EditorialLinkArrow to="/fund">
                {formatMessage({
                  id: "public.home.funding.cta",
                  defaultMessage: "Support Gardens",
                })}
              </EditorialLinkArrow>
            </div>
          </div>

          <div className="@container">
            <div className="grid gap-10 @min-[36rem]:grid-cols-2 @min-[36rem]:gap-8 @min-[70rem]/funding:gap-12">
              <article className="border-t border-stroke-soft-200 pt-6">
                <EditorialNumeral>1.</EditorialNumeral>
                <h3 className="mt-4 font-serif text-2xl font-normal leading-[1.05] tracking-[-0.012em] text-text-strong-950 md:text-3xl">
                  {formatMessage({
                    id: "public.home.funding.donateTitle",
                    defaultMessage: "Donate",
                  })}
                </h3>
                <p className="mt-4 text-base leading-[1.6] text-text-sub-600">
                  {formatMessage({
                    id: "public.home.funding.donateBody",
                    defaultMessage:
                      "Contribute to the Garden’s shared fund to help its community carry out the work.",
                  })}
                </p>
              </article>

              <article className="border-t border-stroke-soft-200 pt-6">
                <EditorialNumeral>2.</EditorialNumeral>
                <h3 className="mt-4 font-serif text-2xl font-normal leading-[1.05] tracking-[-0.012em] text-text-strong-950 md:text-3xl">
                  {formatMessage({
                    id: "public.home.funding.endowTitle",
                    defaultMessage: "Support over time",
                  })}
                </h3>
                <p className="mt-4 text-base leading-[1.6] text-text-sub-600">
                  {formatMessage({
                    id: "public.home.funding.endowBody",
                    defaultMessage:
                      "An endowment is a withdrawable deposit whose investment earnings support the Garden. Read its terms and risks before contributing.",
                  })}
                </p>
              </article>
            </div>

            <div className="mt-10">
              <EditorialDivider />
              <p className="mt-4 max-w-3xl text-xs leading-relaxed text-text-sub-600">
                <span className="mr-1 font-mono uppercase tracking-[0.16em] text-text-soft-400">
                  {formatMessage({
                    id: "public.home.funding.notePrefix",
                    defaultMessage: "note",
                  })}{" "}
                  -
                </span>{" "}
                {formatMessage({
                  id: "public.home.funding.note",
                  defaultMessage:
                    "Both paths support the Garden directly. They are not tax-deductible, charitable, or nonprofit-backed unless separately configured. Deposit value can move with the underlying token, and withdrawals can take time.",
                })}
              </p>
            </div>
          </div>
        </div>

        <EditorialReadDeeper
          className="max-w-3xl"
          community={{
            labelId: "public.home.funding.readDeeper.community",
            defaultLabel: "How funding flows",
            href: "https://docs.greengoods.app/community/funder-guide",
          }}
        />
      </div>
    </section>
  );
}
