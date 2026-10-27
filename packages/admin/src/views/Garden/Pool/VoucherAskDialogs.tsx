import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { TxActPhase } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import {
  type IssuerSafeThreshold,
  selectVoucherAcceptanceChecks,
  type VoucherAsk,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useIntl } from "react-intl";
import { ActPhaseLine } from "@/components/ActPhaseLine";
import type { AdminDialogProps } from "@/components/AdminDialog";
import { PoolTarget, type PoolWriteTarget } from "./PoolTarget";
import { VoucherAcceptanceChecks } from "./VoucherAcceptanceChecks";
import { FactValue, VoucherActDialog, WithPerson } from "./VoucherActDialog";
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
              id: "cockpit.garden.pool.voucher.approve.title",
              defaultMessage: "Approve {name}’s Booking?",
            },
            { name }
          )}
          description={title}
          confirmLabel={
            ask?.issuer.execution === "safe-file"
              ? formatMessage({
                  id: "cockpit.garden.pool.voucher.live.download",
                  defaultMessage: "Download Safe File",
                })
              : formatMessage({
                  id: "cockpit.garden.pool.voucher.approve.confirm",
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
                  id: "cockpit.garden.pool.voucher.fact.vouchers",
                  defaultMessage: "Vouchers",
                })}
                value={formatMessage(
                  {
                    id: "cockpit.garden.pool.voucher.vouchers",
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
                  id: "cockpit.garden.pool.voucher.fact.from",
                  defaultMessage: "From",
                })}
                valueTitle={ask.buyer}
                value={
                  <FactValue
                    value={formatMessage(
                      {
                        id: "cockpit.garden.pool.voucher.fact.fromValue",
                        defaultMessage: "{name}’s account",
                      },
                      { name }
                    )}
                    note={formatMessage(
                      {
                        id: "cockpit.garden.pool.voucher.fact.fromNote",
                        defaultMessage: "{address}, the same address on every network",
                      },
                      { address: shortAddress(ask.buyer) }
                    )}
                  />
                }
              />
              <FactRow
                label={formatMessage({
                  id: "cockpit.garden.pool.voucher.fact.acceptBy",
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
                              id: "cockpit.garden.pool.voucher.fact.acceptByNote",
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
                  id: "cockpit.garden.pool.voucher.fact.terms",
                  defaultMessage: "Terms",
                })}
                value={formatMessage(
                  {
                    id: "cockpit.garden.pool.voucher.version",
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
                id: "cockpit.garden.pool.voucher.approve.noteTitle",
                defaultMessage: "Approving lets {name} deposit",
              },
              { name }
            )}
          >
            {formatMessage({
              id: "cockpit.garden.pool.voucher.approve.noteBody",
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
  chainId: number;
  /** The clock the checks read against, in seconds. */
  now: number;
  /** Where this ask's acceptance stands, from here or its row. */
  phase: TxActPhase;
  /** Offline, or another act is with the wallet or the chain. */
  disabled: boolean;
  tone?: AdminDialogProps["tone"];
  onClose: () => void;
  onAccept: (ask: VoucherAsk, now: number) => Promise<unknown>;
}

/**
 * Accept a booking (`SIssuer` · Accept): the pool's steward accepts through
 * `acceptServiceClaim`, which needs the member's current consent, the issuer's
 * approval, the confirmed deposit and an unexpired deadline. The dialog lists
 * those four checks, and Accept stays off while any fails (V5). It names the
 * pool it writes to and follows the act from the wallet to the chain. A member
 * issuer's booking (`SIssuer` · Accept member booking) names the member's own
 * terms and approval, and says the steward couldn't have given that approval.
 */
export function VoucherAcceptDialog({
  ask,
  title,
  target,
  chainId,
  now,
  phase,
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
            { id: "cockpit.garden.pool.voucher.accept.title", defaultMessage: "Accept {name}?" },
            { name }
          )}
          description={title}
          target={<PoolTarget target={target} />}
          confirmLabel={formatMessage(
            { id: "cockpit.garden.pool.voucher.accept.confirm", defaultMessage: "Accept {name}" },
            { name }
          )}
          confirmDisabled={disabled || !checks?.ready}
          act={async () => {
            if (ask) await onAccept(ask, now);
          }}
          note={formatMessage({
            id: "cockpit.garden.pool.voucher.wallet",
            defaultMessage: "Your wallet will ask you to approve.",
          })}
          progress={
            <ActPhaseLine
              phase={phase}
              chainId={chainId}
              confirmed={formatMessage({
                id: "cockpit.garden.pool.voucher.accepted",
                defaultMessage: "Accepted",
              })}
            />
          }
        >
          {ask && checks ? (
            <VoucherAcceptanceChecks ask={ask} name={name} checks={checks} nowMs={now * 1000} />
          ) : null}
          <Alert
            variant="info"
            title={formatMessage({
              id: "cockpit.garden.pool.voucher.accept.noteTitle",
              defaultMessage: "Accepting starts the booking",
            })}
          >
            {ask?.issuer.kind === "individual"
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.voucher.accept.noteBodyMember",
                    defaultMessage:
                      "You accept as the pool’s steward. {issuer}’s approval was required first; you couldn’t give it for them.",
                  },
                  { issuer: ask.issuer.name }
                )
              : formatMessage({
                  id: "cockpit.garden.pool.voucher.accept.noteBody",
                  defaultMessage:
                    "Starting follows on the voucher network. It doesn’t mean the visit happened.",
                })}
          </Alert>
        </VoucherActDialog>
      )}
    </WithPerson>
  );
}
