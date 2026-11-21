import type { PublicGardenPassportRecord } from "@green-goods/shared/commitment-pooling/public";
import { useIntl } from "react-intl";
import { EditorialGhostLink, EditorialPrimaryLink } from "@/components/Public/atoms";
import { PassportLedger } from "./GardenPassportLedger";
import { PassportSentence } from "./GardenPassportSentence";
import { PassportMoneySection, PassportReadingSection } from "./GardenPassportMoney";
import { PassportVouchersSection } from "./GardenPassportVouchers";

/**
 * A published passport, top to bottom: the sentence, the four-line ledger, vouchers, G$, how to
 * read it, then the way on. It draws what it is handed and reads nothing itself, so the page
 * decides whether there is a passport to draw at all.
 */
export function GardenPassportRecord({
  passport,
  onRetry,
  gardenHref,
  fundHref,
}: {
  passport: PublicGardenPassportRecord;
  /** Asks the whole passport again; a line whose source failed offers it. */
  onRetry: () => void;
  gardenHref: string;
  /** Left out for a garden the funding list does not carry, where the link would find nothing. */
  fundHref?: string;
}) {
  const { formatMessage } = useIntl();
  return (
    <>
      <div className="flex flex-col gap-10">
        <PassportSentence passport={passport} />
        <PassportLedger passport={passport} onRetry={onRetry} />
      </div>
      <PassportVouchersSection vouchers={passport.vouchers} onRetry={onRetry} />
      <PassportMoneySection settlement={passport.settlement} onRetry={onRetry} />
      <PassportReadingSection />
      <div className="flex flex-wrap items-center gap-3 border-t border-stroke-soft-200 pt-10">
        {fundHref ? (
          <EditorialPrimaryLink to={fundHref}>
            {formatMessage({
              id: "public.gardenDetail.support",
              defaultMessage: "Support This Garden",
            })}
          </EditorialPrimaryLink>
        ) : null}
        <EditorialGhostLink to={gardenHref}>
          {formatMessage({ id: "public.passport.viewGarden", defaultMessage: "View the Garden" })}
        </EditorialGhostLink>
      </div>
    </>
  );
}
