import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { RiArchiveLine, RiCoinsLine, RiCoupon3Line, RiGitBranchLine } from "@remixicon/react";
import { useId } from "react";
import { useIntl } from "react-intl";
import { detailed } from "./ServiceRedeemSheet";
import type { ServiceRewardsView } from "./serviceRewards";

/**
 * A request's rewards on its promise page: one item row per reward, each with its own pill and
 * one short detail, so vouchers and G$ arrive and read on their own. A short reserve reads as
 * waiting, never lost. Where each reward comes from and its receipt stay under Transaction details.
 */
export function ServiceRewardsSection({ view }: { view: ServiceRewardsView }) {
  const { formatMessage, locale } = useIntl();
  const headingId = useId();
  const text = (id: string) => formatMessage({ id: `app.voucher.${id}` });
  return (
    // A word of ten letters or more hyphenates in the facts' narrow label column instead of
    // breaking anywhere ("Acceptance" at 360px); shorter words move to the next line.
    <section
      lang={locale}
      className="hyphens-auto [hyphenate-limit-chars:10_4_4] rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
      aria-labelledby={headingId}
      data-component="ServiceRewardsSection"
    >
      <h2 id={headingId} className="text-sm font-semibold leading-5 text-text-strong-950">
        {text("rw.rewards")}
      </h2>
      <ul className="mt-3 space-y-3" data-component="ServiceRewardRows">
        {view.rows.map((row) => (
          <li key={row.id}>
            <ItemRow
              lead={{
                kind: "icon",
                icon:
                  row.kind === "voucher" ? (
                    <RiCoupon3Line className="h-6 w-6" aria-hidden="true" />
                  ) : (
                    <RiCoinsLine className="h-6 w-6" aria-hidden="true" />
                  ),
              }}
              title={row.title}
              status={row.status}
              edge={row.status.tone}
              details={[row.detail]}
            />
          </li>
        ))}
      </ul>
      <FactList frame="inset" className="mt-2">
        {view.facts.map((fact) => (
          <FactRow
            key={fact.id}
            icon={fact.id === "arrive" ? <RiGitBranchLine /> : <RiArchiveLine />}
            label={fact.label}
            value={detailed(fact.value, fact.detail)}
          />
        ))}
      </FactList>
      {view.details.length > 0 ? (
        <details className="mt-3 text-xs text-text-sub-600" data-component="ServiceRewardDetails">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium">
            {text("c.tech")}
          </summary>
          <ul className="space-y-1.5 break-all pb-1">
            {view.details.map((line) => (
              <li key={line}>{line}</li>
            ))}
            {view.messageLinks.map((link) => (
              <li key={link.href}>
                <a
                  className="underline underline-offset-2"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
