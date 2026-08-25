import { Alert } from "@green-goods/shared/components/Alert";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useIntl } from "react-intl";
import { AdminTextField } from "@/components/AdminTextField";
import { cycleName } from "../poolPresentation";

export interface SetupStepCycleProps {
  isCampaign: boolean;
  /** The season already running, when a second one is blocked. */
  runningSeason: PoolConsoleController["model"]["season"];
  secondSeasonBlocked: boolean;
  cycleNames: PoolConsoleController["cycleNames"];
  name: string;
  onNameChange: (value: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  datesValid: boolean;
  disabled: boolean;
}

/** The cycle step: what this season or campaign is called and when it runs. */
export function SetupStepCycle({
  isCampaign,
  runningSeason,
  secondSeasonBlocked,
  cycleNames,
  name,
  onNameChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  datesValid,
  disabled,
}: SetupStepCycleProps) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-4">
      {secondSeasonBlocked && runningSeason ? (
        <Alert variant="warning">
          {formatMessage(
            {
              id: "cockpit.garden.pool.setup.secondSeasonBlocked",
              defaultMessage:
                "One season runs at a time. “{name}” is still running; close it first, or start a campaign beside it.",
            },
            { name: cycleName(runningSeason, cycleNames, formatMessage) }
          )}
        </Alert>
      ) : null}
      <AdminTextField
        label={formatMessage({ id: "cockpit.garden.pool.setup.name", defaultMessage: "Name" })}
        value={name}
        onChange={(event) => onNameChange(event.target.value)}
        placeholder={
          isCampaign
            ? formatMessage({
                id: "cockpit.garden.pool.setup.namePlaceholderCampaign",
                defaultMessage: "Seedling swap",
              })
            : formatMessage({
                id: "cockpit.garden.pool.setup.namePlaceholderSeason",
                defaultMessage: "Season of First Rains",
              })
        }
        disabled={disabled}
        required
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AdminTextField
          label={formatMessage({
            id: "cockpit.garden.pool.setup.starts",
            defaultMessage: "Starts",
          })}
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          disabled={disabled}
          required
        />
        <AdminTextField
          label={formatMessage({
            id: "cockpit.garden.pool.setup.runsThrough",
            defaultMessage: "Runs through",
          })}
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
          error={
            datesValid || !startDate || !endDate
              ? undefined
              : formatMessage({
                  id: "cockpit.garden.pool.setup.datesError",
                  defaultMessage: "The end must come after the start",
                })
          }
          disabled={disabled}
          required
        />
      </div>
      <p className="text-xs text-text-soft">
        {isCampaign
          ? formatMessage({
              id: "cockpit.garden.pool.setup.campaignNote",
              defaultMessage:
                "Campaigns are shorter pushes that run beside the season, any number at once.",
            })
          : formatMessage({
              id: "cockpit.garden.pool.setup.seasonNote",
              defaultMessage:
                "One season runs at a time. Shorter campaigns can run beside it whenever you need them.",
            })}
      </p>
    </div>
  );
}
