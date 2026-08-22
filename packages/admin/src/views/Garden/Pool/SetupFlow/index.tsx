import {
  Alert,
  campaignSteps,
  type CommitmentCycleRecord,
  firstRunSetupSteps,
  isPoolDocumentPinError,
  isValidCycleSplit,
  logger,
  newSeasonSteps,
  openSeasonSteps,
  pinCycleMetadata,
  pinPoolCharter,
  type PoolConsoleController,
  type PoolSetupAction,
  type PoolSetupStep,
  useCommitmentPoolSetupSequence,
  useDirtyClose,
  useStepFocus,
} from "@green-goods/shared";
import { RiRefreshLine, RiShieldCheckLine } from "@remixicon/react";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { AdminTextField } from "@/components/AdminTextField";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import { cycleName } from "../poolPresentation";
import {
  ALLOCATION_PRESETS,
  AllocationEditor,
  type AllocationPercent,
  type AllocationPreset,
  DEFAULT_RECOGNITION_PERCENT,
  type RecognitionPercent,
  toAllocationBps,
  toRecognitionBps,
} from "./AllocationEditor";

export type PoolSetupIntent = "first-run" | "season" | "campaign" | "open-season" | "open-campaign";

export interface PoolSetupFlowProps {
  open: boolean;
  intent: PoolSetupIntent;
  /** The Seeded cycle an `open-*` intent opens. */
  cycle?: CommitmentCycleRecord | null;
  console: PoolConsoleController;
  onClose: () => void;
}

type StepId = "how" | "cycle" | "split" | "open";

const STEPS_BY_INTENT: Record<PoolSetupIntent, StepId[]> = {
  "first-run": ["how", "cycle", "split", "open"],
  season: ["cycle", "split", "open"],
  campaign: ["cycle", "split", "open"],
  "open-season": ["split", "open"],
  "open-campaign": ["split", "open"],
};

const DEFAULT_CAP = "24";
const DAY = 24 * 60 * 60;

function isoDate(seconds: number): string {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function startOfDaySeconds(iso: string): bigint | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const value = Date.parse(`${iso}T00:00:00`);
  return Number.isFinite(value) ? BigInt(Math.floor(value / 1000)) : null;
}

function endOfDaySeconds(iso: string): bigint | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const value = Date.parse(`${iso}T23:59:59`);
  return Number.isFinite(value) ? BigInt(Math.floor(value / 1000)) : null;
}

/**
 * W11: first-run setup, a new season, a campaign, or opening a prepared
 * cycle, in one flow dialog. Nothing is written until the last step, where the
 * ordered writes go out through `useCommitmentPoolSetupSequence`: every
 * failure state names what already landed and the retry repeats only the
 * unlanded call (uiux-spec C.51). The charter and the cycle name are pinned
 * before the chain starts; a pin failure keeps the step open with the words.
 */
export function PoolSetupFlow({ open, intent, cycle, console: pool, onClose }: PoolSetupFlowProps) {
  const { formatMessage } = useIntl();
  const purposeId = useId();
  const steps = STEPS_BY_INTENT[intent];
  const [stepIndex, setStepIndex] = useState(0);
  const [purpose, setPurpose] = useState("");
  const [cap, setCap] = useState(DEFAULT_CAP);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(() => isoDate(Math.floor(Date.now() / 1000)));
  const [endDate, setEndDate] = useState(() => isoDate(Math.floor(Date.now() / 1000) + 30 * DAY));
  const [preset, setPreset] = useState<AllocationPreset>("model1");
  const [allocation, setAllocation] = useState<AllocationPercent>(ALLOCATION_PRESETS.model1);
  const [recognition, setRecognition] = useState<RecognitionPercent>(DEFAULT_RECOGNITION_PERCENT);
  const [pinning, setPinning] = useState(false);
  const [pinFailure, setPinFailure] = useState<"charter" | "cycle" | null>(null);
  const sequence = useCommitmentPoolSetupSequence({ chainId: pool.chainId });
  const stepRef = useStepFocus<HTMLDivElement>(stepIndex);
  const isCampaign = intent === "campaign" || intent === "open-campaign";

  // A fresh open starts at step one with the pool's current words prefilled.
  useEffect(() => {
    if (!open) return;
    setStepIndex(0);
    setPurpose(pool.charter.charter?.purpose ?? "");
    const currentCap = pool.pool?.providerOpenCommitmentCap ?? 0n;
    setCap(currentCap > 0n ? currentCap.toString() : DEFAULT_CAP);
    setName("");
    setPreset("model1");
    setAllocation(ALLOCATION_PRESETS.model1);
    setRecognition(DEFAULT_RECOGNITION_PERCENT);
    setPinFailure(null);
    sequence.reset();
    // `sequence.reset` is stable; re-running on its identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, intent, cycle?.id]);

  const isDirty =
    open &&
    (purpose !== (pool.charter.charter?.purpose ?? "") || name.trim().length > 0 || stepIndex > 0);
  const submitting = pinning || sequence.state.status === "running";
  const dirtyClose = useDirtyClose({
    isDirty: isDirty && sequence.state.status !== "complete",
    onClose,
    blockRouteChange: true,
    preventRouteChange: submitting,
  });

  const model = pool.model;
  const secondSeasonBlocked = intent === "season" && model.season !== null;
  const split = isValidCycleSplit({
    allocation: toAllocationBps(allocation),
    recognitionPolicy: toRecognitionBps(recognition),
  });
  const start = startOfDaySeconds(startDate);
  const end = endOfDaySeconds(endDate);
  const datesValid = start !== null && end !== null && end > start;
  const capValue = /^\d+$/.test(cap.trim()) ? BigInt(cap.trim()) : null;

  const stepValid = (id: StepId): boolean => {
    switch (id) {
      case "how":
        return purpose.trim().length > 0 && capValue !== null && capValue > 0n;
      case "cycle":
        return name.trim().length > 0 && datesValid && !secondSeasonBlocked;
      case "split":
        return split.allocation && split.recognitionPolicy;
      case "open":
        return true;
    }
  };

  const currentStep = steps[stepIndex] ?? "open";
  const isLast = stepIndex === steps.length - 1;
  const canContinue = stepValid(currentStep) && !submitting && pool.isOnline;

  const title =
    intent === "first-run"
      ? formatMessage({
          id: "cockpit.garden.pool.setup.title",
          defaultMessage: "Set up commitments",
        })
      : isCampaign
        ? formatMessage({
            id: "cockpit.garden.pool.setup.campaignTitle",
            defaultMessage: "Start a campaign",
          })
        : formatMessage({
            id: "cockpit.garden.pool.setup.seasonTitle",
            defaultMessage: "Start a season",
          });

  const stepConfigs = useMemo(
    () =>
      steps.map((id) => {
        switch (id) {
          case "how":
            return {
              id,
              title: formatMessage({
                id: "cockpit.garden.pool.setup.step.how",
                defaultMessage: "How it works",
              }),
              description: formatMessage({
                id: "cockpit.garden.pool.setup.step.howHint",
                defaultMessage: "The agreement and the limit",
              }),
            };
          case "cycle":
            return {
              id,
              title: isCampaign
                ? formatMessage({
                    id: "cockpit.garden.pool.setup.step.campaign",
                    defaultMessage: "The campaign",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.setup.step.season",
                    defaultMessage: "The season",
                  }),
              description: formatMessage({
                id: "cockpit.garden.pool.setup.step.cycleHint",
                defaultMessage: "Name and dates",
              }),
            };
          case "split":
            return {
              id,
              title: formatMessage({
                id: "cockpit.garden.pool.setup.step.split",
                defaultMessage: "The split",
              }),
              description: formatMessage({
                id: "cockpit.garden.pool.setup.step.splitHint",
                defaultMessage: "Six roles, one hundred percent",
              }),
            };
          case "open":
            return {
              id,
              title: formatMessage({
                id: "cockpit.garden.pool.setup.step.open",
                defaultMessage: "Open",
              }),
              description: formatMessage({
                id: "cockpit.garden.pool.setup.step.openHint",
                defaultMessage: "Check, then write",
              }),
            };
        }
      }),
    [steps, isCampaign, formatMessage]
  );

  const buildSteps = useCallback(async (): Promise<PoolSetupStep[]> => {
    const poolId = pool.poolId;
    if (poolId === undefined) throw new Error("This garden has no commitment pool");
    const allocationBps = toAllocationBps(allocation);
    const recognitionBps = toRecognitionBps(recognition);
    if (intent === "open-season" || intent === "open-campaign") {
      if (!cycle) throw new Error("No cycle to open");
      return openSeasonSteps({
        poolId,
        cycleId: cycle.cycleId,
        allocation: allocationBps,
        recognitionPolicy: recognitionBps,
      });
    }
    if (start === null || end === null) throw new Error("Dates are not set");
    setPinFailure(null);
    let metadataCID: string;
    try {
      metadataCID = await pinCycleMetadata({ name, gardenAddress: pool.garden });
    } catch (error) {
      if (isPoolDocumentPinError(error)) setPinFailure("cycle");
      throw error;
    }
    const cycleInput = {
      cycleType: isCampaign ? ("CAMPAIGN" as const) : ("SEASON" as const),
      startTime: start,
      endTime: end,
      metadataCID,
    };
    if (intent === "campaign") {
      return campaignSteps({
        poolId,
        cycle: cycleInput,
        allocation: allocationBps,
        recognitionPolicy: recognitionBps,
      });
    }
    if (intent === "season") {
      return newSeasonSteps({
        poolId,
        cycle: cycleInput,
        allocation: allocationBps,
        recognitionPolicy: recognitionBps,
      });
    }
    let charterCID: string;
    try {
      charterCID = await pinPoolCharter({ purpose, gardenAddress: pool.garden });
    } catch (error) {
      if (isPoolDocumentPinError(error)) setPinFailure("charter");
      throw error;
    }
    return firstRunSetupSteps({
      poolId,
      charterCID,
      cap: capValue ?? 0n,
      cycle: cycleInput,
      allocation: allocationBps,
      recognitionPolicy: recognitionBps,
    });
  }, [
    pool.poolId,
    pool.garden,
    allocation,
    recognition,
    intent,
    cycle,
    start,
    end,
    name,
    isCampaign,
    purpose,
    capValue,
  ]);

  const submit = useCallback(async () => {
    setPinning(true);
    let planned: PoolSetupStep[];
    try {
      planned = await buildSteps();
    } catch (error) {
      logger.error("[PoolSetupFlow] could not prepare the writes", {
        intent,
        error: error instanceof Error ? error.message : String(error),
      });
      setPinning(false);
      return;
    }
    setPinning(false);
    const outcome = await sequence.run(planned);
    if (outcome.status === "complete") {
      await pool.refetch();
      onClose();
    }
  }, [buildSteps, intent, sequence, pool, onClose]);

  const retry = useCallback(async () => {
    const outcome = await sequence.retry();
    if (outcome.status === "complete") {
      await pool.refetch();
      onClose();
    }
  }, [sequence, pool, onClose]);

  const actionLabel = (action: PoolSetupAction): string => {
    switch (action) {
      case "setPoolCharter":
        return formatMessage({
          id: "cockpit.garden.pool.setup.write.charter",
          defaultMessage: "Agreement written",
        });
      case "setProviderOpenCommitmentCap":
        return formatMessage({
          id: "cockpit.garden.pool.setup.write.cap",
          defaultMessage: "Commitment limit set",
        });
      case "markPoolReady":
        return formatMessage({
          id: "cockpit.garden.pool.setup.write.ready",
          defaultMessage: "Pool marked ready",
        });
      case "seedCycle":
        return isCampaign
          ? formatMessage({
              id: "cockpit.garden.pool.setup.write.seedCampaign",
              defaultMessage: "Campaign prepared",
            })
          : formatMessage({
              id: "cockpit.garden.pool.setup.write.seedSeason",
              defaultMessage: "Season prepared",
            });
      case "openPool":
        return formatMessage({
          id: "cockpit.garden.pool.setup.write.openPool",
          defaultMessage: "Pool opened",
        });
      case "openCycle":
        return isCampaign
          ? formatMessage({
              id: "cockpit.garden.pool.setup.write.openCampaign",
              defaultMessage: "Campaign opened with its split",
            })
          : formatMessage({
              id: "cockpit.garden.pool.setup.write.openSeason",
              defaultMessage: "Season opened with its split",
            });
    }
  };

  const failed = sequence.state.status === "failed";
  const failure = sequence.state.failure;

  let body: ReactNode;
  switch (currentStep) {
    case "how":
      body = (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={purposeId} className="label-md block text-text-strong">
              {formatMessage({
                id: "cockpit.garden.pool.settings.purpose",
                defaultMessage: "What this pool is for",
              })}
              <span aria-hidden="true" className="ml-0.5 text-[rgb(var(--m3-error))]">
                *
              </span>
            </label>
            <textarea
              id={purposeId}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              rows={4}
              maxLength={2000}
              required
              disabled={submitting}
              placeholder={formatMessage({
                id: "cockpit.garden.pool.setup.purposePlaceholder",
                defaultMessage:
                  "Neighbours offer help and ask for it: rides, tools, workshops, garden work. Commitments are kept in the open and confirmed by the person they were made to.",
              })}
              className="w-full resize-y rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2 text-body-md text-[rgb(var(--m3-on-surface))] ring-1 ring-inset ring-[rgb(var(--m3-outline-variant))] placeholder:text-[rgb(var(--m3-on-surface-variant))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] disabled:opacity-[0.38]"
            />
          </div>
          <AdminTextField
            label={formatMessage({
              id: "cockpit.garden.pool.settings.cap",
              defaultMessage: "How many commitments one person can hold at once",
            })}
            value={cap}
            onChange={(event) => setCap(event.target.value)}
            helperText={formatMessage({
              id: "cockpit.garden.pool.settings.capHelp",
              defaultMessage: "A safety limit so nobody over-commits. 24 suits most gardens.",
            })}
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            disabled={submitting}
            required
          />
          <p className="text-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.setup.baselineNote",
              defaultMessage:
                "A starting assessment from the Hub helps the season's report later; nothing here waits on it.",
            })}
          </p>
        </div>
      );
      break;
    case "cycle":
      body = (
        <div className="space-y-4">
          {secondSeasonBlocked && model.season ? (
            <Alert variant="warning">
              {formatMessage(
                {
                  id: "cockpit.garden.pool.setup.secondSeasonBlocked",
                  defaultMessage:
                    "One season runs at a time. “{name}” is still running; close it first, or start a campaign beside it.",
                },
                { name: cycleName(model.season, pool.cycleNames, formatMessage) }
              )}
            </Alert>
          ) : null}
          <AdminTextField
            label={formatMessage({ id: "cockpit.garden.pool.setup.name", defaultMessage: "Name" })}
            value={name}
            onChange={(event) => setName(event.target.value)}
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
            disabled={submitting}
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
              onChange={(event) => setStartDate(event.target.value)}
              disabled={submitting}
              required
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.garden.pool.setup.runsThrough",
                defaultMessage: "Runs through",
              })}
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              error={
                datesValid || !startDate || !endDate
                  ? undefined
                  : formatMessage({
                      id: "cockpit.garden.pool.setup.datesError",
                      defaultMessage: "The end must come after the start",
                    })
              }
              disabled={submitting}
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
      break;
    case "split":
      body = (
        <AllocationEditor
          preset={preset}
          onPresetChange={setPreset}
          allocation={allocation}
          onAllocationChange={setAllocation}
          recognition={recognition}
          onRecognitionChange={setRecognition}
          disabled={submitting}
        />
      );
      break;
    default: {
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
          ? cycleName(cycle, pool.cycleNames, formatMessage)
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
      body = (
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
                  : model.status === "ready"
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
            <div className="space-y-3" data-testid="pool-setup-failed">
              <Alert variant="error">
                {failure === "existing-cycle"
                  ? formatMessage({
                      id: "cockpit.garden.pool.setup.failure.existingCycle",
                      defaultMessage:
                        "This pool already holds a prepared cycle, so nothing more was written. Open that cycle from the pool tab instead.",
                    })
                  : failure === "pool-paused"
                    ? formatMessage({
                        id: "cockpit.garden.pool.setup.failure.poolPaused",
                        defaultMessage: "The pool is paused. Resume it before opening a cycle.",
                      })
                    : failure === "unavailable"
                      ? formatMessage({
                          id: "cockpit.garden.pool.setup.failure.unavailable",
                          defaultMessage:
                            "Commitment pooling is not available on this chain yet, so nothing was written.",
                        })
                      : failure === "no-sender"
                        ? formatMessage({
                            id: "cockpit.garden.pool.setup.failure.noSender",
                            defaultMessage:
                              "No wallet is ready to sign. Connect one and try again; nothing was written.",
                          })
                        : isCampaign
                          ? formatMessage({
                              id: "cockpit.garden.pool.setup.failure.campaign",
                              defaultMessage:
                                "The campaign did not open. What landed stays landed; the rest was not written.",
                            })
                          : formatMessage({
                              id: "cockpit.garden.pool.setup.failure.season",
                              defaultMessage:
                                "The season did not open. What landed stays landed; the rest was not written.",
                            })}
              </Alert>
              <dl className="space-y-2 text-body-md">
                <div>
                  <dt className="label-xs text-text-soft">
                    {formatMessage({
                      id: "cockpit.garden.pool.setup.landed",
                      defaultMessage: "Landed",
                    })}
                  </dt>
                  <dd className="text-text-strong" data-testid="pool-setup-landed">
                    {sequence.state.landed.length > 0
                      ? sequence.state.landed.map(actionLabel).join(" · ")
                      : formatMessage({
                          id: "cockpit.garden.pool.setup.landedNothing",
                          defaultMessage: "Nothing yet",
                        })}
                  </dd>
                </div>
                <div>
                  <dt className="label-xs text-text-soft">
                    {formatMessage({
                      id: "cockpit.garden.pool.setup.didNot",
                      defaultMessage: "Did not",
                    })}
                  </dt>
                  <dd className="text-text-strong" data-testid="pool-setup-failed-step">
                    {sequence.state.failedStep
                      ? actionLabel(sequence.state.failedStep)
                      : formatMessage({
                          id: "cockpit.garden.pool.setup.didNotStart",
                          defaultMessage: "The first write",
                        })}
                  </dd>
                </div>
              </dl>
              {failure === "send-failed" ||
              failure === "not-confirmed" ||
              failure === "cycle-id-unknown" ? (
                <p className="flex items-center gap-1.5 text-xs text-text-soft">
                  <RiShieldCheckLine className="h-3.5 w-3.5" aria-hidden />
                  {formatMessage({
                    id: "cockpit.garden.pool.setup.retryNote",
                    defaultMessage:
                      "Retrying repeats only the unlanded step. Nothing already recorded is written twice.",
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
          {!pool.isOnline ? (
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
  }

  const retryable =
    failed &&
    (failure === "send-failed" || failure === "not-confirmed" || failure === "cycle-id-unknown");

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:flex-1" aria-live="polite">
        {submitting ? <AdminLinearProgress ariaLabel={title} /> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant={stepIndex === 0 ? "text" : "outlined"}
          onClick={() =>
            stepIndex === 0 ? dirtyClose.onOpenChange(false) : setStepIndex((index) => index - 1)
          }
          disabled={submitting}
          className="self-start sm:self-auto"
        >
          {stepIndex === 0
            ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
            : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
        </AdminButton>
        {isLast ? (
          retryable ? (
            <AdminButton
              type="button"
              variant="filled"
              leadingIcon={<RiRefreshLine className="h-4 w-4" />}
              onClick={() => void retry()}
              disabled={submitting || !pool.isOnline}
              loading={submitting}
              className="w-full sm:w-auto"
            >
              {formatMessage({
                id: "cockpit.garden.pool.setup.retry",
                defaultMessage: "Try again",
              })}
            </AdminButton>
          ) : (
            <AdminButton
              type="button"
              variant="filled"
              onClick={() => void submit()}
              disabled={!canContinue || (failed && !retryable)}
              loading={submitting}
              className="w-full sm:w-auto"
            >
              {intent === "first-run"
                ? formatMessage({
                    id: "cockpit.garden.pool.setup.openAll",
                    defaultMessage: "Open season",
                  })
                : isCampaign
                  ? formatMessage({
                      id: "cockpit.garden.pool.setup.openCampaign",
                      defaultMessage: "Open campaign",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.setup.openSeason",
                      defaultMessage: "Open to the garden",
                    })}
            </AdminButton>
          )
        ) : (
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => setStepIndex((index) => index + 1)}
            disabled={!canContinue}
            className="w-full sm:w-auto"
          >
            {formatMessage({ id: "app.common.next", defaultMessage: "Next" })}
          </AdminButton>
        )}
      </div>
    </div>
  );

  return (
    <>
      <AdminDialog
        open={open}
        size="lg"
        variant="flow"
        tone="garden"
        className={ADMIN_FLOW_DIALOG_CLASS}
        onOpenChange={dirtyClose.onOpenChange}
        preventClose={submitting}
        title={title}
        description={formatMessage({
          id: "cockpit.garden.pool.setup.description",
          defaultMessage: "Write how this pool runs and open it to the garden.",
        })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        <ActionFlowShell
          layout="dialog"
          title={title}
          steps={stepConfigs}
          currentStep={stepIndex + 1}
          onStepClick={(step) => {
            if (!submitting && step - 1 < stepIndex) setStepIndex(step - 1);
          }}
          footer={footer}
        >
          <div ref={stepRef} tabIndex={-1} className="space-y-4 outline-none">
            <FlowStepHeader
              title={stepConfigs[stepIndex]?.title ?? title}
              description={stepConfigs[stepIndex]?.description}
            />
            {body}
          </div>
        </ActionFlowShell>
      </AdminDialog>
      <DiscardChangesDialog
        open={dirtyClose.confirmOpen}
        onKeepEditing={dirtyClose.cancelClose}
        onDiscard={dirtyClose.confirmClose}
        tone="garden"
      />
    </>
  );
}
