import { getBlockExplorerTxUrl } from "@green-goods/shared/utils/eas/explorers";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";
import { TxStepMarker, type TxStepMarkerState } from "@/components/TxStepMarker";

export type TxProgressTone = "soft" | "active" | "success" | "warning" | "error";

export interface TxProgressRow {
  id: string;
  title: string;
  /** Why the wallet asks for it, in one line; omitted to keep the row short. */
  why?: string;
  /** The row's own status word, carried on the item for tests and styling. */
  status: string;
  marker: TxStepMarkerState;
  /** The words beside the row; a row waiting its turn says nothing. */
  label: string | null;
  tone: TxProgressTone;
  /** The row the wallet or the chain is on now. */
  current: boolean;
  /** The wallet prompt it rides in; rows sharing a number are approved together. */
  prompt: number | null;
  /** The transaction that carried it, linked once the row is done. */
  hash: `0x${string}` | null;
}

const TONE: Record<TxProgressTone, string> = {
  soft: "text-text-soft",
  active: "text-primary-dark",
  success: "text-success-dark",
  warning: "text-warning-dark",
  error: "text-error-dark",
};

/**
 * Writes a steward sends one after another, each with where it stands. The
 * same rows are read before a run and fill in during it, so the steward
 * watches the list they read beforehand rather than a spinner with no words.
 * Callers decide what each row is called and where it stands; this list only
 * lays the rows out.
 */
export function TxProgressList({
  rows,
  chainId,
  label,
  testId,
}: {
  rows: readonly TxProgressRow[];
  chainId: number;
  /** What the list is, for assistive tech. */
  label: string;
  testId?: string;
}) {
  const { formatMessage } = useIntl();
  const currentIndex = rows.findIndex((row) => row.current);
  return (
    <ol className="space-y-1" data-testid={testId} aria-label={label}>
      {rows.map((row, index) => (
        <li
          key={row.id}
          data-status={row.status}
          aria-current={index === currentIndex ? "step" : undefined}
          className={cn(
            "flex items-start gap-3 rounded-lg px-3 py-2 transition-colors",
            row.current && "bg-primary-alpha-10"
          )}
        >
          <TxStepMarker size="sm" state={row.marker} label={row.prompt ?? ""} />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                // Setup titles fit in two lines; a steward's own title stops there.
                "line-clamp-2 break-words text-body-md font-medium",
                row.marker === "complete" ? "text-text-sub" : "text-text-strong"
              )}
              title={row.title}
            >
              {row.title}
            </p>
            {row.why ? <p className="mt-0.5 text-xs text-text-soft">{row.why}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-0.5 text-xs">
            {row.label ? <span className={TONE[row.tone]}>{row.label}</span> : null}
            {row.marker === "complete" && row.hash ? (
              <a
                href={getBlockExplorerTxUrl(chainId, row.hash)}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-primary-dark underline"
                aria-label={formatMessage(
                  {
                    id: "cockpit.garden.pool.setup.viewTxFor",
                    defaultMessage: "View the transaction for “{step}”",
                  },
                  { step: row.title }
                )}
              >
                {formatMessage({ id: "cockpit.garden.pool.setup.viewTx", defaultMessage: "View" })}
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
