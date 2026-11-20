import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { VoucherStartProgress } from "@green-goods/shared/hooks/admin-ui/pool/usePoolConsoleController";
import {
  type IssuerSafeThreshold,
  selectVoucherAcceptanceChecks,
  VOUCHER_START_FALLBACK_SECONDS,
  type VoucherAsk,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useIntl } from "react-intl";
import type { AdminDialogProps } from "@/components/AdminDialog";
import { PoolTarget, type PoolWriteTarget } from "./PoolTarget";
import { VoucherAcceptanceChecks } from "./VoucherAcceptanceChecks";
import { FactValue, VoucherActDialog, WithPerson } from "./VoucherActDialog";
import { VoucherStartList } from "./VoucherStartList";
import { dueDateText, exactTime } from "./poolTime";
import { shortAddress } from "./poolPresentation";
import { voucherCount, voucherSafeNote } from "./voucherPresentation";

const DAY_SECONDS = 86_400;

export interface VoucherApproveDialogProps {
  /** The booking to approve; the dialog is open while one is set. */
  ask: VoucherAsk | null;
  /** The offer the booking is for. */
  title: string;
  /** The issuer Safe's signature rule, read from the Safe. */
  safe: IssuerSafeThreshold | undefined;
  nowMs: number;
  /** Offline, or another act is with the wallet or the chain: the row's state, live while open. */
  disabled: boolean;
  tone?: AdminDialogProps["tone"];
  onClose: () => void;
  onApprove: (ask: VoucherAsk) => Promise<void>;
}

/**
 * Approve a booking (`SIssuer` · Approve booking): the issuer's Safe approves
 * this exact authorization so the member can deposit. It writes to the
 * voucher escrow, not the pool, so it carries a plain description rather than
 * the pool's target line, and it says plainly that approving isn't accepting.
 * The Safe's signature count comes from the Safe.
 */
export function VoucherApproveDialog({
  ask,
  title,
  safe,
  nowMs,
  disabled,
  tone,
  onClose,
  onApprove,
}: VoucherApproveDialogProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const setup = ask?.setup ?? null;
  return (
    <WithPerson address={ask?.buyer}>
      {(name) => (
        <VoucherActDialog
          open={ask !== null}
          onClose={onClose}
          tone={tone}
          title={formatMessage(
            {
              id: "hub.garden.pool.voucher.approve.title",
              defaultMessage: "Approve {name}’s Booking?",
            },
            { name }
          )}
          description={title}
          confirmLabel={
            ask?.issuer.execution === "safe-file"
              ? formatMessage({
                  id: "hub.garden.pool.voucher.live.download",
                  defaultMessage: "Download Safe File",
                })
              : formatMessage({
                  id: "hub.garden.pool.voucher.approve.confirm",
                  defaultMessage: "Approve Booking",
                })
          }
          confirmDisabled={disabled}
          act={async () => {
            if (ask) await onApprove(ask);
          }}
          note={voucherSafeNote(safe, formatMessage, ask?.issuer.execution)}
        >
          {ask && setup ? (
            <FactList frame="card">
              <FactRow
                label={formatMessage({
                  id: "hub.garden.pool.voucher.fact.vouchers",
                  defaultMessage: "Vouchers",
                })}
                value={formatMessage(
                  {
                    id: "hub.garden.pool.voucher.vouchers",
                    defaultMessage:
                      "{count, plural, one {# {issuer} voucher} other {# {issuer} vouchers}}",
                  },
                  {
                    count: voucherCount(setup.voucherUnits, ask.issuer.decimals),
                    issuer: ask.issuer.name,
                  }
                )}
              />
              <FactRow
                label={formatMessage({
                  id: "hub.garden.pool.voucher.fact.from",
                  defaultMessage: "From",
                })}
                valueTitle={ask.buyer}
                value={
                  <FactValue
                    value={formatMessage(
                      {
                        id: "hub.garden.pool.voucher.fact.fromValue",
                        defaultMessage: "{name}’s account",
                      },
                      { name }
                    )}
                    note={formatMessage(
                      {
                        id: "hub.garden.pool.voucher.fact.fromNote",
                        defaultMessage: "{address}, the same address on every network",
                      },
                      { address: shortAddress(ask.buyer) }
                    )}
                  />
                }
              />
              <FactRow
                label={formatMessage({
                  id: "hub.garden.pool.voucher.fact.acceptBy",
                  defaultMessage: "Accept by",
                })}
                valueTitle={exactTime(intl, setup.acceptBy * 1000)}
                value={
                  <FactValue
                    value={dueDateText(intl, setup.acceptBy * 1000, nowMs)}
                    note={
                      ask.agreedAt === null
                        ? undefined
                        : formatMessage(
                            {
                              id: "hub.garden.pool.voucher.fact.acceptByNote",
                              defaultMessage:
                                "{days, plural, one {# day} other {# days}} from agreeing, under your terms",
                            },
                            { days: Math.round((setup.acceptBy - ask.agreedAt) / DAY_SECONDS) }
                          )
                    }
                  />
                }
              />
              <FactRow
                label={formatMessage({
                  id: "hub.garden.pool.voucher.fact.terms",
                  defaultMessage: "Terms",
                })}
                value={formatMessage(
                  {
                    id: "hub.garden.pool.voucher.version",
                    defaultMessage: "Version {version}",
                  },
                  { version: ask.agreed.revision.toString() }
                )}
              />
            </FactList>
          ) : null}
          <Alert
            variant="info"
            title={formatMessage(
              {
                id: "hub.garden.pool.voucher.approve.noteTitle",
                defaultMessage: "Approving lets {name} deposit",
              },
              { name }
            )}
          >
            {formatMessage({
              id: "hub.garden.pool.voucher.approve.noteBody",
              defaultMessage:
                "It isn’t acceptance. You accept after the deposit is confirmed on Green Goods.",
            })}
          </Alert>
        </VoucherActDialog>
      )}
    </WithPerson>
  );
}

export interface VoucherAcceptDialogProps {
  /** The booking to accept; the dialog is open while one is set. */
  ask: VoucherAsk | null;
  /** The offer the booking is for. */
  title: string;
  /** The pool the acceptance writes to. */
  target: PoolWriteTarget;
  /** The clock the checks read against, in seconds. */
  now: number;
  /** Where this ask's acceptance stands, from here or its row. */
  phase: TxActPhase;
  /** Where this ask's start stands once its acceptance lands; null while no ask is open. */
  start: VoucherStartProgress | null;
  /** The pool's chain, where all three sends land. */
  chainId: number;
  /** Offline, or another act is with the wallet or the chain. */
  disabled: boolean;
  tone?: AdminDialogProps["tone"];
  onClose: () => void;
  onAccept: (ask: VoucherAsk, now: number) => Promise<unknown>;
}

/**
 * Accept and Start a booking (`SIssuer` · Accept, DL-193): the pool's steward
 * accepts through `acceptServiceClaim`, which needs the member's current
 * consent, the issuer's approval, the confirmed deposit and an unexpired
 * deadline, then sends the booking's start from their own wallet. The dialog
 * lists those four checks, and Accept and Start stays off while any fails (V5).
 * It names the pool it writes to, says up front that the wallet asks three
 * times and what the start's network fee is, and fills in each send as it
 * lands. A member issuer's booking (`SIssuer` · Accept member booking) names
 * the member's own terms and approval, and says the steward couldn't have
 * given that approval.
 */
export function VoucherAcceptDialog({
  ask,
  title,
  target,
  now,
  phase,
  start,
  chainId,
  disabled,
  tone,
  onClose,
  onAccept,
}: VoucherAcceptDialogProps) {
  const { formatMessage } = useIntl();
  const checks = ask ? selectVoucherAcceptanceChecks(ask, now) : null;
  return (
    <WithPerson address={ask?.buyer}>
      {(name) => (
        <VoucherActDialog
          open={ask !== null}
          onClose={onClose}
          tone={tone}
          title={formatMessage(
            { id: "hub.garden.pool.voucher.accept.title", defaultMessage: "Accept {name}?" },
            { name }
          )}
          description={title}
          target={<PoolTarget target={target} />}
          confirmLabel={formatMessage({
            id: "hub.garden.pool.voucher.acceptStart.confirm",
            defaultMessage: "Accept and Start",
          })}
          confirmDisabled={disabled || !checks?.ready}
          act={async () => {
            if (ask) await onAccept(ask, now);
          }}
          note={formatMessage({
            id: "hub.garden.pool.voucher.acceptStart.wallet",
            defaultMessage: "Your wallet will ask you to approve up to three times.",
          })}
          progress={null}
        >
          {ask && checks ? (
            <VoucherAcceptanceChecks ask={ask} name={name} checks={checks} nowMs={now * 1000} />
          ) : null}
          {ask && start ? (
            <VoucherStartList
              accept={phase}
              start={start}
              estimatedFee={ask.setup?.startFee ?? null}
              name={name}
              chainId={chainId}
            />
          ) : null}
          <Alert
            variant="info"
            title={formatMessage({
              id: "hub.garden.pool.voucher.acceptStart.noteTitle",
              defaultMessage: "Starting doesn’t mean the service was delivered",
            })}
          >
            {ask?.issuer.kind === "individual"
              ? formatMessage(
                  {
                    id: "hub.garden.pool.voucher.accept.noteBodyMember",
                    defaultMessage:
                      "You accept as the pool’s steward. {issuer}’s approval was required first; you couldn’t give it for them.",
                  },
                  { issuer: ask.issuer.name }
                )
              : formatMessage(
                  {
                    id: "hub.garden.pool.voucher.acceptStart.noteBody",
                    defaultMessage:
                      "If the start doesn’t go, the booking stays accepted, and {name} can start it from the app {minutes} minutes after you accept.",
                  },
                  { name, minutes: VOUCHER_START_FALLBACK_SECONDS / 60 }
                )}
          </Alert>
        </VoucherActDialog>
      )}
    </WithPerson>
  );
}
