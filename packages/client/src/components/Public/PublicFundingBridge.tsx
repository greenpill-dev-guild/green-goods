import { useIntl } from "react-intl";
import {
  EditorialDivider,
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialLinkArrow,
  EditorialNumeral,
} from "./atoms";

/**
 * PublicFundingBridge - cardless homepage explanation of how public support
 * reaches Gardens. It keeps the homepage trust-first and routes deeper action
 * to `/fund` instead of recreating the funding flow here.
 */
export function PublicFundingBridge() {
  const { formatMessage } = useIntl();

  return (
    <section
      className="bg-editorial-warm px-6 py-20 sm:px-10 md:py-28"
      aria-labelledby="public-funding-bridge-title"
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.45fr] lg:gap-24">
          <div>
            <EditorialKicker className="mb-5">
              {formatMessage({
                id: "public.home.funding.kicker",
                defaultMessage: "§ 04: Support Gardens",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-funding-bridge-title">
              {formatMessage({
                id: "public.home.funding.title",
                defaultMessage: "Direct support today. Endowment support over time.",
              })}
            </EditorialHeading>
            <div className="mt-5 max-w-md">
              <EditorialLede>
                {formatMessage({
                  id: "public.home.funding.body",
                  defaultMessage:
                    "Green Goods gives funders two protocol paths: direct support for verified Work, or a Vault position designed so yield can keep supporting a Garden over time.",
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

          <div>
            <div className="grid gap-10 md:grid-cols-2 md:gap-12">
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
                      "Send direct support through a Garden's Cookie Jar for verified regenerative Work.",
                  })}
                </p>
              </article>

              <article className="border-t border-stroke-soft-200 pt-6">
                <EditorialNumeral>2.</EditorialNumeral>
                <h3 className="mt-4 font-serif text-2xl font-normal leading-[1.05] tracking-[-0.012em] text-text-strong-950 md:text-3xl">
                  {formatMessage({
                    id: "public.home.funding.endowTitle",
                    defaultMessage: "Endow",
                  })}
                </h3>
                <p className="mt-4 text-base leading-[1.6] text-text-sub-600">
                  {formatMessage({
                    id: "public.home.funding.endowBody",
                    defaultMessage:
                      "Deposit into a Garden Vault designed to preserve principal while yield supports the Garden.",
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
                    "Donate and Endow support the Garden directly. They are not tax-deductible, charitable, or nonprofit-backed unless separately configured. Vaults also carry smart contract, token, yield, provider, and wallet recovery risk.",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
