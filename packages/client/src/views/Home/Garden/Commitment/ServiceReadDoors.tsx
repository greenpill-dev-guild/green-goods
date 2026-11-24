import { RiRefreshLine } from "@remixicon/react";
import { JoinToActDoor } from "./JoinToAct";
import { HOLDINGS_MATTER } from "./serviceBookingStage";
import type { ServiceBookingStage } from "./serviceBookingTypes";

/**
 * The promise page's recovery doors, in the shortfall card's place: a wallet read that failed
 * before the deposit, with the last good holdings still shown or none to show, and an exchange
 * sent to the pool whose result isn't known yet. Each offers the read again and nothing else, so
 * a page that can't see the reader's vouchers never looks bookable.
 */
export function ServiceReadDoors({
  stage,
  walletUnavailable,
  walletKnown,
  exchangePending,
  text,
  onCheckWallet,
  onCheckExchange,
}: {
  /** The booking's stage; the wallet door shows only while the reader's own vouchers matter. */
  stage: ServiceBookingStage | null;
  walletUnavailable: boolean;
  /** A good earlier read is still on the page, so the door says "refresh", not "read". */
  walletKnown: boolean;
  exchangePending: boolean;
  text: (id: string) => string;
  onCheckWallet: () => void;
  onCheckExchange: () => void;
}) {
  const icon = <RiRefreshLine className="h-4 w-4" aria-hidden="true" />;
  return (
    <>
      {stage && walletUnavailable && HOLDINGS_MATTER.has(stage) ? (
        <JoinToActDoor
          title={text(walletKnown ? "of.w.stale.t" : "of.w.unread.t")}
          line={text(walletKnown ? "of.w.stale.b" : "of.w.unread.b")}
          door={{ label: text("wait.check"), emphasis: "secondary", icon, onAct: onCheckWallet }}
        />
      ) : null}
      {exchangePending ? (
        <JoinToActDoor
          title={text("of.x.sent.t")}
          line={text("of.x.sent.b")}
          door={{ label: text("wait.check"), emphasis: "secondary", icon, onAct: onCheckExchange }}
        />
      ) : null}
    </>
  );
}
