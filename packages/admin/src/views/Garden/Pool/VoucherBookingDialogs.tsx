import { Alert } from "@green-goods/shared/components/Alert";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type { VoucherConsoleView } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { VoucherBooking } from "@green-goods/shared/modules/commitment-pooling/pool-console";
import { useIntl } from "react-intl";
import type { AdminDialogProps } from "@/components/AdminDialog";
import { PoolTarget, type PoolWriteTarget } from "./PoolTarget";
import { VoucherActDialog, WithPerson } from "./VoucherActDialog";
import { VoucherProposeReturnDialog } from "./VoucherProposeReturnDialog";
import { dayText, exactTime } from "./poolTime";

export interface VoucherReportVisitDialogProps {
  /** The visit to report; the dialog is open while one is set. */
  booking: VoucherBooking | null;
  /** The offer the booking is for. */
  title: string;
  /** The pool the report is recorded in. */
  target: PoolWriteTarget;
  nowMs: number;
  tone?: AdminDialogProps["tone"];
  onClose: () => void;
  onReport: (booking: VoucherBooking) => Promise<void>;
}

/**
 * Report a visit (`SIssuer` · Report visit): what the steward records about a
 * hub day, as evidence for the final split. It moves no vouchers, and the
 * holder still approves the split, which the dialog says before it sends.
 */
export function VoucherReportVisitDialog({
  booking,
  title,
  target,
  nowMs,
  tone,
  onClose,
  onReport,
}: VoucherReportVisitDialogProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const visit = booking?.service.kind === "visit" ? booking.service : null;
  return (
    <WithPerson address={booking?.holder}>
      {(name) => (
        <VoucherActDialog
          open={booking !== null}
          onClose={onClose}
          tone={tone}
          title={formatMessage(
            {
              id: "cockpit.garden.pool.voucher.report.title",
              defaultMessage: "Report {name}’s Visit",
            },
            { name }
          )}
          description={title}
          target={<PoolTarget target={target} />}
          confirmLabel={formatMessage({
            id: "cockpit.garden.pool.voucher.report.confirm",
            defaultMessage: "Report Visit",
          })}
          act={async () => {
            if (booking) await onReport(booking);
          }}
          note={formatMessage({
            id: "cockpit.garden.pool.voucher.wallet",
            defaultMessage: "Your wallet will ask you to approve.",
          })}
        >
          {visit ? (
            <FactList frame="card">
              <FactRow
                label={formatMessage({
                  id: "cockpit.garden.pool.voucher.fact.date",
                  defaultMessage: "Date",
                })}
                valueTitle={exactTime(intl, visit.startsAt * 1000)}
                value={dayText(intl, visit.startsAt * 1000, nowMs)}
              />
              <FactRow
                label={formatMessage({
                  id: "cockpit.garden.pool.voucher.fact.attendance",
                  defaultMessage: "Attendance",
                })}
                value={
                  visit.report.checkedIn
                    ? formatMessage(
                        {
                          id: "cockpit.garden.pool.voucher.fact.checkedIn",
                          defaultMessage: "{name} checked in",
                        },
                        { name }
                      )
                    : formatMessage(
                        {
                          id: "cockpit.garden.pool.voucher.fact.noCheckIn",
                          defaultMessage: "{name} didn’t check in",
                        },
                        { name }
                      )
                }
              />
              <FactRow
                label={formatMessage({
                  id: "cockpit.garden.pool.voucher.fact.usableTime",
                  defaultMessage: "Usable time",
                })}
                value={formatMessage(
                  {
                    id: "cockpit.garden.pool.voucher.fact.usableHours",
                    defaultMessage: "{used} of {of} hours",
                  },
                  { used: visit.report.usableHours, of: visit.report.ofHours }
                )}
              />
              <FactRow
                label={formatMessage({
                  id: "cockpit.garden.pool.voucher.fact.evidence",
                  defaultMessage: "Evidence",
                })}
                value={formatMessage(
                  {
                    id: "cockpit.garden.pool.voucher.fact.photos",
                    defaultMessage: "{count, plural, one {# photo} other {# photos}}",
                  },
                  { count: visit.report.photos }
                )}
              />
            </FactList>
          ) : null}
          <Alert
            variant="info"
            title={formatMessage({
              id: "cockpit.garden.pool.voucher.report.noteTitle",
              defaultMessage: "Reports are evidence",
            })}
          >
            {formatMessage(
              {
                id: "cockpit.garden.pool.voucher.report.noteBody",
                defaultMessage: "They don’t move vouchers. {name} approves the final split later.",
              },
              { name }
            )}
          </Alert>
        </VoucherActDialog>
      )}
    </WithPerson>
  );
}

/** The act a booking's row opened, and on which booking. */
export type VoucherBookingAct = { kind: "report" | "propose"; booking: VoucherBooking } | null;

/**
 * The dialog a booking's act opens from its row in Offers and Requests: a
 * visit's report, or the return proposed for access that ended early.
 */
export function VoucherBookingDialogs({
  open,
  title,
  vouchers,
  target,
  nowMs,
  tone,
  onClose,
}: {
  open: VoucherBookingAct;
  /** The offer the booking is for. */
  title: string;
  vouchers: Pick<VoucherConsoleView, "acts" | "snapshot">;
  target: PoolWriteTarget;
  nowMs: number;
  tone?: AdminDialogProps["tone"];
  onClose: () => void;
}) {
  return (
    <>
      <VoucherReportVisitDialog
        booking={open?.kind === "report" ? open.booking : null}
        title={title}
        target={target}
        nowMs={nowMs}
        tone={tone}
        onClose={onClose}
        onReport={vouchers.acts.reportVisit}
      />
      <VoucherProposeReturnDialog
        booking={open?.kind === "propose" ? open.booking : null}
        title={title}
        safe={vouchers.snapshot.safe}
        tone={tone}
        onClose={onClose}
        onPropose={vouchers.acts.proposeReturn}
      />
    </>
  );
}
