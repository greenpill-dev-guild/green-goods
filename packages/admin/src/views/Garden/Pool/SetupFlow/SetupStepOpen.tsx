import { Alert, type CommitmentCycleRecord, type PoolConsoleController } from "@green-goods/shared";
import { useIntl } from "react-intl";
import { cycleName } from "../poolPresentation";
import type { AllocationPercent, RecognitionPercent } from "./AllocationEditor";
import { SetupFailure, type SetupFailureProps } from "./SetupFailure";
import type { PoolSetupIntent } from "./setupFlowModel";

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
  failed: boolean;
  failure: SetupFailureProps["failure"];
  landed: SetupFailureProps["landed"];
  failedStep: SetupFailureProps["failedStep"];
  isOnline: boolean;
}

/** The last step: everything about to be written, then the writes themselves. */
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
  failed,
  failure,
  landed,
  failedStep,
  isOnline,
}: SetupStepOpenProps) {
  const { formatMessage } = useIntl();
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
    cycle
      ? cycleName(cycle, cycleNames, formatMessage)
      : `${name.trim()} · ${startDate} – ${endDate}`,
  ]);
  summaryRows.push([
    formatMessage({ id: "cockpit.garden.pool.setup.step.split", defaultMessage: "The split" }),
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
  return (
    <div className="space-y-4">
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
      {!failed ? (
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
                      "The pool is set up and opens with this season: two ordered writes, the pool first, then the season with its split.",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.setup.openNoteSeason",
                    defaultMessage:
                      "Opening tells the whole garden the season has begun. From that moment neighbours can offer help, ask for it, and take each other up.",
                  })}
        </Alert>
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
      {failed ? (
        <SetupFailure
          failure={failure}
          isCampaign={isCampaign}
          landed={landed}
          failedStep={failedStep}
        />
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
