import { useInViewReveal } from "@green-goods/shared/hooks/ui/useInViewReveal";
import { useIntl } from "react-intl";
import { EditorialHeading, EditorialKicker, EditorialLinkArrow, EditorialNumeral } from "./atoms";

interface SupportPathProps {
  numeral: string;
  titleId: string;
  defaultTitle: string;
  ledeId: string;
  defaultLede: string;
  routesId: string;
  defaultRoutes: string;
  bestForId: string;
  defaultBestFor: string;
  learnMoreId: string;
  defaultLearnMore: string;
  learnMoreHref: string;
}

function SupportPath({
  numeral,
  titleId,
  defaultTitle,
  ledeId,
  defaultLede,
  routesId,
  defaultRoutes,
  bestForId,
  defaultBestFor,
  learnMoreId,
  defaultLearnMore,
  learnMoreHref,
}: SupportPathProps) {
  const { formatMessage } = useIntl();
  return (
    <article className="flex flex-col gap-5">
      <EditorialNumeral>{numeral}</EditorialNumeral>
      <h3 className="font-serif text-2xl font-normal leading-[1.05] tracking-[-0.012em] text-text-strong-950 md:text-3xl">
        {formatMessage({ id: titleId, defaultMessage: defaultTitle })}
      </h3>
      <p className="text-base leading-[1.6] text-text-sub-600 md:text-lg">
        {formatMessage({ id: ledeId, defaultMessage: defaultLede })}
      </p>
      <dl className="space-y-3 text-sm leading-[1.55] text-text-sub-600">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({ id: "public.fund.support.routes", defaultMessage: "Where it goes" })}
          </dt>
          <dd className="mt-1">{formatMessage({ id: routesId, defaultMessage: defaultRoutes })}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({ id: "public.fund.support.bestFor", defaultMessage: "Best for" })}
          </dt>
          <dd className="mt-1">
            {formatMessage({ id: bestForId, defaultMessage: defaultBestFor })}
          </dd>
        </div>
      </dl>
      <div>
        <EditorialLinkArrow to={learnMoreHref} external>
          {formatMessage({ id: learnMoreId, defaultMessage: defaultLearnMore })}
        </EditorialLinkArrow>
      </div>
    </article>
  );
}

export function FundSupportPaths() {
  const { formatMessage } = useIntl();
  const { ref, revealed } = useInViewReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      data-revealed={revealed}
      className="editorial-section-reveal bg-bg-weak-50 px-6 pb-16 sm:px-10 md:pb-20"
      aria-labelledby="public-fund-paths-title"
    >
      <div className="editorial-cascade mx-auto max-w-7xl">
        <header className="border-b border-stroke-soft-200 pb-6">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.fund.paths.kicker",
              defaultMessage: "§ 02: Ways to support",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-fund-paths-title">
            {formatMessage({
              id: "public.fund.paths.title",
              defaultMessage: "Choose how your support helps.",
            })}
          </EditorialHeading>
        </header>

        <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
          <SupportPath
            numeral="1."
            titleId="public.fund.paths.donateTitle"
            defaultTitle="Donate"
            ledeId="public.fund.paths.donateLede"
            defaultLede="Direct support that reaches a garden's shared fund today and funds the season's most immediate work."
            routesId="public.fund.paths.donateRoutes"
            defaultRoutes="Goes to this garden's shared fund."
            bestForId="public.fund.paths.donateBestFor"
            defaultBestFor="Immediate needs and near-term work."
            learnMoreId="public.fund.paths.donateLearnMore"
            defaultLearnMore="How direct support works"
            learnMoreHref="https://docs.greengoods.app/community/funder-guide"
          />
          <SupportPath
            numeral="2."
            titleId="public.fund.paths.endowTitle"
            defaultTitle="Endow"
            ledeId="public.fund.paths.endowLede"
            defaultLede="Make a withdrawable deposit whose investment earnings support the garden over time. The deposit and withdrawals carry risks; read the terms before contributing."
            routesId="public.fund.paths.endowRoutes"
            defaultRoutes="Goes to this garden's vault endowment."
            bestForId="public.fund.paths.endowBestFor"
            defaultBestFor="Long-term support that keeps working."
            learnMoreId="public.fund.paths.endowLearnMore"
            defaultLearnMore="Learn about Octant V2 vaults"
            learnMoreHref="https://octant.build"
          />
        </div>

        <aside
          className="mt-10 border-t border-stroke-soft-200 pt-6 text-xs leading-[1.6] text-text-soft-400"
          aria-label={formatMessage({
            id: "public.fund.paths.disclosures",
            defaultMessage: "Important disclosures",
          })}
        >
          <p>
            {formatMessage({
              id: "public.fund.dialog.taxDisclaimer",
              defaultMessage:
                "Both paths support the garden directly. Neither is tax-deductible, charitable, or nonprofit-backed unless separately configured.",
            })}
          </p>
          <p className="mt-2">
            <span className="block font-mono uppercase tracking-[0.16em] text-text-soft-400">
              {formatMessage({
                id: "public.fund.paths.endowRiskLabel",
                defaultMessage: "On Endow",
              })}
            </span>
            {formatMessage({
              id: "public.fund.dialog.endow.risk",
              defaultMessage:
                "Heads up: deposit value can move with the underlying token, and withdrawals can take time.",
            })}
          </p>
        </aside>
      </div>
    </section>
  );
}
