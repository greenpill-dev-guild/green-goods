import type { SeedRowProgress } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import { useIntl } from "react-intl";
import { TxProgressList } from "@/components/TxProgressList";
import { seedPassCounts, seedPassLine, seedPassRows } from "./seedPass";

/**
 * A seeding pass while it runs: one line saying which prompt the wallet is on
 * and of how many, over every row with where it stands.
 */
export function SeedStepSending({
  pass,
  chainId,
}: {
  pass: readonly SeedRowProgress[];
  chainId: number;
}) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-2" data-testid="seed-sending">
      <p className="text-body-md font-medium text-text-strong" aria-live="polite">
        {seedPassLine(pass, chainId, formatMessage)}
      </p>
      <TxProgressList
        rows={seedPassRows(pass, formatMessage)}
        chainId={chainId}
        testId="seed-pass"
        label={formatMessage({
          id: "cockpit.garden.pool.seed.passList",
          defaultMessage: "Each commitment and where it stands",
        })}
      />
    </div>
  );
}

/**
 * How a seeding pass ended (hub decision 28), row by row: created (with its
 * transaction), sends later (its row waits on the pool tab with Send Now), or
 * not sent (still in the review, to change or try again). The wizard ends here
 * rather than vanishing, so the steward reads what the chain now holds.
 */
export function SeedStepDone({
  pass,
  chainId,
}: {
  pass: readonly SeedRowProgress[];
  chainId: number;
}) {
  const { formatMessage } = useIntl();
  const counts = seedPassCounts(pass);
  return (
    <div className="space-y-3" data-testid="seed-done">
      <div className="space-y-1" aria-live="polite">
        <p className="text-body-md font-medium text-text-strong">
          {formatMessage(
            {
              id: "cockpit.garden.pool.seed.done.created",
              defaultMessage:
                "{count, plural, =0 {Nothing was created.} one {# commitment created.} other {# commitments created.}}",
            },
            { count: counts.created }
          )}
        </p>
        {counts.later > 0 ? (
          <p className="text-xs text-text-soft">
            {formatMessage(
              {
                id: "cockpit.garden.pool.seed.done.later",
                defaultMessage:
                  "{count, plural, one {# sends later: its row waits on the pool tab with Send Now.} other {# send later: their rows wait on the pool tab with Send Now.}}",
              },
              { count: counts.later }
            )}
          </p>
        ) : null}
        {counts.notSent > 0 ? (
          <p className="text-xs text-error-dark">
            {formatMessage(
              {
                id: "cockpit.garden.pool.seed.done.notSent",
                defaultMessage:
                  "{count, plural, one {# was not sent, so nothing was created for it.} other {# were not sent, so nothing was created for them.}}",
              },
              { count: counts.notSent }
            )}
          </p>
        ) : null}
      </div>
      <TxProgressList
        rows={seedPassRows(pass, formatMessage)}
        chainId={chainId}
        testId="seed-pass"
        label={formatMessage({
          id: "cockpit.garden.pool.seed.passList",
          defaultMessage: "Each commitment and where it stands",
        })}
      />
    </div>
  );
}
