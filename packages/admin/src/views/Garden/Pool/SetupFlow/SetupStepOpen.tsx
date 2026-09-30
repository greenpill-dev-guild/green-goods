import { Alert } from "@green-goods/shared/components/Alert";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import type { PoolSetupStepState } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPoolSetupSequence";
import type { CommitmentCycleRecord } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { useIntl } from "react-intl";
import { cycleName } from "../poolPresentation";
import type { AllocationPercent, RecognitionPercent } from "./AllocationEditor";
import { SetupFailure, type SetupFailureProps } from "./SetupFailure";
import { SetupProgressList } from "./SetupProgressList";
import type { PoolSetupIntent } from "./setupFlowModel";
import { promptCount, runningStatus } from "./setupWrites";

/** Where the run stands: before it, during it, stopped part way, or finished. */
export type SetupPhase = "ready" | "running" | "stopped" | "done";

export interface SetupStepOpenProps {
  intent: PoolSetupIntent;
  isCampaign: boolean;
  purpose: string;
  cap: string;
  cycle?: CommitmentCycleRecord | null;
  cycleNames: PoolConsoleController["cycleNames"];
  name: string;
  startDate: string;
  endDate: string;
  allocation: AllocationPercent;
  recognition: RecognitionPercent;
  poolStatus: PoolConsoleController["model"]["status"];
  pinFailure: "charter" | "cycle" | null;
  phase: SetupPhase;
  failure: SetupFailureProps["failure"];
  /** Every write, as the checklist shows it: previewed before the run, live after. */
  rows: readonly PoolSetupStepState[];
  /** The wallet prompt each row rides in; rows sharing a number are approved together. */
  promptNumbers: readonly (number | null)[];
  promptTotal: number;
  /** The garden whose pool this is, for the done screen. */
  gardenName: string;
  chainId: number;
  isOnline: boolean;
}

/**
 * The last step: what is about to be written, how many times the wallet will
 * ask, and then each write landing in place. A steward reads the checklist
 * before pressing the button and watches the same rows fill in afterwards, so
 * the wallet prompts are never a surprise and a pause is never mistaken for a
 * loop.
 */
export function SetupStepOpen({
  intent,
  isCampaign,
  purpose,
  cap,
  cycle,
  cycleNames,
  name,
  startDate,
  endDate,
  allocation,
  recognition,
  poolStatus,
  pinFailure,
  phase,
  failure,
  rows,
  promptNumbers,
  promptTotal,
  gardenName,
  chainId,
  isOnline,
}: SetupStepOpenProps) {
  const { formatMessage } = useIntl();
  const cycleLabel = cycle ? cycleName(cycle, cycleNames, formatMessage) : name.trim();

  if (phase === "done") {
    return (
      <div className="space-y-4" data-testid="pool-setup-done">
        <Alert
          variant="success"
          title={
            intent === "first-run"
              ? formatMessage(
                  {
                    id: "cockpit.garden.pool.setup.done.firstRun",
                    defaultMessage: "{garden} is taking commitments",
                  },
                  { garden: gardenName }
                )
              : isCampaign
                ? formatMessage({
                    id: "cockpit.garden.pool.setup.done.campaign",
                    defaultMessage: "The campaign is open",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.setup.done.season",
                    defaultMessage: "The season is open",
                  })
          }
        >
          {formatMessage(
            {
              id: "cockpit.garden.pool.setup.done.body",
              defaultMessage:
                "“{name}” is open. Neighbours can offer help, ask for it, and take each other up.",
            },
            { name: cycleLabel }
          )}
        </Alert>
        <SetupProgressList
          rows={rows}
          numbers={promptNumbers}
          isCampaign={isCampaign}
          chainId={chainId}
          showWhy="none"
        />
      </div>
    );
  }

  const summaryRows: Array<[string, string]> = [];
  if (intent === "first-run") {
    summaryRows.push([
      formatMessage({
        id: "cockpit.garden.pool.settings.purpose",
        defaultMessage: "What this pool is for",
      }),
      purpose.trim(),
    ]);
    summaryRows.push([
      formatMessage({
        id: "cockpit.garden.pool.status.cap",
        defaultMessage: "Commitment limit",
      }),
      formatMessage(
        {
          id: "cockpit.garden.pool.status.capValue",
          defaultMessage: "{count} per person at once",
        },
        { count: cap.trim() }
      ),
    ]);
  }
  summaryRows.push([
    isCampaign
      ? formatMessage({ id: "cockpit.garden.pool.cycle.campaign", defaultMessage: "Campaign" })
      : formatMessage({ id: "cockpit.garden.pool.cycle.season", defaultMessage: "Season" }),
    cycle ? cycleLabel : `${cycleLabel} · ${startDate} – ${endDate}`,
  ]);
  summaryRows.push([
    formatMessage({ id: "cockpit.garden.pool.setup.step.split", defaultMessage: "The Split" }),
    `${formatMessage({ id: "cockpit.garden.pool.split.gardeners", defaultMessage: "Gardeners" })} ${allocation.gardeners} · ${formatMessage({ id: "cockpit.garden.pool.split.treasury", defaultMessage: "Treasury" })} ${allocation.treasury} · ${formatMessage({ id: "cockpit.garden.pool.split.steward", defaultMessage: "Steward" })} ${allocation.steward} · ${formatMessage({ id: "cockpit.garden.pool.split.evaluator", defaultMessage: "Evaluator" })} ${allocation.evaluator} · ${formatMessage({ id: "cockpit.garden.pool.split.community", defaultMessage: "Community" })} ${allocation.community} · ${formatMessage({ id: "cockpit.garden.pool.split.funder", defaultMessage: "Funder" })} ${allocation.funder}`,
  ]);
  summaryRows.push([
    formatMessage({
      id: "cockpit.garden.pool.split.recognition",
      defaultMessage: "Gardeners' part",
    }),
    formatMessage(
      {
        id: "cockpit.garden.pool.setup.recognitionSummary",
        defaultMessage: "{equal} % taking part · {verified} % proven contribution",
      },
      { equal: recognition.equal, verified: recognition.verified }
    ),
  ]);

  const batched =
    promptTotal > 0 && promptTotal < rows.filter((row) => row.status !== "already").length;
  const doneCount = rows.filter(
    (row) => row.status === "landed" || row.status === "already"
  ).length;
  const statusLine = (): string => {
    if (phase === "running") {
      return runningStatus(rows, promptNumbers, promptTotal, chainId, formatMessage);
    }
    if (phase === "stopped") {
      return formatMessage(
        {
          id: "cockpit.garden.pool.setup.live.stopped",
          defaultMessage: "Stopped with {done} of {total} changes done.",
        },
        { done: doneCount, total: rows.length }
      );
    }
    return promptCount(promptTotal, formatMessage);
  };

  return (
    <div className="space-y-4">
      {phase === "ready" ? (
        <dl className="space-y-2">
          {summaryRows.map(([label, value]) => (
            <div key={label}>
              <dt className="label-xs text-text-soft">{label}</dt>
              <dd className="text-body-md text-text-strong" title={value}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <div className="space-y-2">
        <p className="text-body-md font-medium text-text-strong" aria-live="polite">
          {statusLine()}
        </p>
        {batched && phase === "ready" ? (
          <p className="body-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.setup.promptBatched",
              defaultMessage:
                "Changes with the same number are approved together, in one transaction.",
            })}
          </p>
        ) : null}
        <SetupProgressList
          rows={rows}
          numbers={promptNumbers}
          isCampaign={isCampaign}
          chainId={chainId}
          showWhy={phase === "ready" ? "all" : "current"}
        />
      </div>

      {phase === "ready" ? (
        <Alert variant="info">
          {intent === "first-run"
            ? formatMessage({
                id: "cockpit.garden.pool.setup.openNoteFirstRun",
                defaultMessage:
                  "Opening records how this pool works, then opens the pool and its first season together. Neighbours can make and take up commitments straight away.",
              })
            : isCampaign
              ? formatMessage({
                  id: "cockpit.garden.pool.setup.openNoteCampaign",
                  defaultMessage:
                    "The pool is already open, so this only starts the campaign. It runs alongside the season.",
                })
              : poolStatus === "ready"
                ? formatMessage({
                    id: "cockpit.garden.pool.setup.openNoteGuard",
                    defaultMessage:
                      "The pool is set up and opens with this season: two changes in order, the pool first, then the season with its split.",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.setup.openNoteSeason",
                    defaultMessage:
                      "Opening tells the whole garden the season has begun. From that moment neighbours can offer help, ask for it, and take each other up.",
                  })}
        </Alert>
      ) : null}
      {phase === "running" ? (
        <p className="body-xs text-text-soft">
          {formatMessage({
            id: "cockpit.garden.pool.setup.keepOpen",
            defaultMessage:
              "Keep this open until every change is done. If you leave, what is done stays done, and you can finish from the pool tab.",
          })}
        </p>
      ) : null}
      {pinFailure ? (
        <Alert variant="error">
          {pinFailure === "charter"
            ? formatMessage({
                id: "cockpit.garden.pool.setup.pinFailedCharter",
                defaultMessage:
                  "The agreement could not be stored, so nothing was sent. Your words are still here; try again.",
              })
            : formatMessage({
                id: "cockpit.garden.pool.setup.pinFailedCycle",
                defaultMessage:
                  "The name could not be stored, so nothing was sent. It is still here; try again.",
              })}
        </Alert>
      ) : null}
      {phase === "stopped" ? (
        <SetupFailure failure={failure} isCampaign={isCampaign} remainingPrompts={promptTotal} />
      ) : null}
      {!isOnline ? (
        <Alert variant="warning">
          {formatMessage({
            id: "cockpit.garden.pool.offline",
            defaultMessage: "Needs a connection. Pool changes are sent straight to the chain.",
          })}
        </Alert>
      ) : null}
    </div>
  );
}
