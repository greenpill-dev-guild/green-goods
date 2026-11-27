import type {
  ServiceIssuerAction,
  ServiceIssuerSnapshot,
} from "@green-goods/shared/commitment-pooling";
import { Button } from "@green-goods/shared/components/Button";
import { useIntl } from "react-intl";
import type { IssuerEntry } from "./ServiceIssuerActSheet";
import type { IssuerIntent } from "./ServiceIssuerReview";
import { issuerAmount, issuerStage } from "./serviceIssuerPresentation";
interface SectionAct {
  id: string;
  label: string;
  run: () => void;
}
/** Only issuer operations: holders use the separate exchange controls. */
export function ServiceIssuerActions({
  snapshot,
  pending,
  busy,
  onCheck,
  onEntry,
  onReview,
}: {
  snapshot: Extract<ServiceIssuerSnapshot, { evidence: "onchain" }>;
  pending: boolean;
  busy: boolean;
  onCheck: () => void;
  onEntry: (entry: IssuerEntry) => void;
  onReview: (action: ServiceIssuerAction, intent?: IssuerIntent) => void;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const ms = (key: string, values?: Record<string, string>) =>
    formatMessage({ id: `app.voucher.ms.${key}` }, values);
  const asset = snapshot.asset;
  const amount = (value: bigint) => issuerAmount(value, asset, intl);
  const allowance = snapshot.reserveAllowance ?? 0n;
  const stage = issuerStage(snapshot, pending).stage;
  const issue: SectionAct = {
    id: "issue",
    label: ms("a.issue"),
    run: () => onEntry({ kind: "issue" }),
  };
  const forRewards: SectionAct = {
    id: "allow",
    label: ms("a.allow"),
    run: () => onEntry({ kind: "allowance" }),
  };
  const pause: SectionAct = {
    id: "pause",
    label: ms("a.pause"),
    run: () => onReview({ kind: "configureReserve", enabled: false }, "pause"),
  };
  const enable = (intent: IssuerIntent): SectionAct => ({
    id: intent,
    label: ms(intent === "resume" ? "a.resume" : "a.enable"),
    run: () => onReview({ kind: "configureReserve", enabled: true }, intent),
  });
  // The section's own acts; a booking's acts sit in its row.
  const acts: SectionAct[] = pending
    ? [{ id: "check", label: ms("a.check"), run: onCheck }]
    : stage === "setup"
      ? allowance === 0n && asset.adapterAllowance !== null
        ? [
            {
              id: "allow",
              label: ms("a.allowN", { count: amount(asset.adapterAllowance) }),
              run: () =>
                onReview(
                  { kind: "approveReserve", amount: asset.adapterAllowance! },
                  "approveReserve"
                ),
            },
          ]
        : [enable("enable")]
      : stage === "paused"
        ? [allowance === 0n ? forRewards : enable("resume")]
        : stage === "short"
          ? [forRewards, pause]
          : stage === "ok"
            ? [issue, pause]
            : [];
  return (
    <>
      {acts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {acts.map((act, index) => (
            <Button
              key={act.id}
              data-act={act.id}
              type="button"
              emphasis={index === 0 ? "primary" : "secondary"}
              loading={busy && index === 0}
              disabled={busy}
              onClick={act.run}
            >
              {act.label}
            </Button>
          ))}
        </div>
      ) : null}
    </>
  );
}
