import {
  type Address,
  Alert,
  buildCommitmentCreationPayload,
  type CommitmentComposerValues,
  commitmentComposerSchema,
  logger,
  useActions,
  useCommitmentComposerForm,
  useCommitmentJobs,
  useDirtyClose,
  usePoolConsoleController,
  useProtocolPool,
  useSettlementAccount,
  useStepFocus,
} from "@green-goods/shared";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { type ReactNode, useCallback, useId, useMemo, useState } from "react";
import { Controller, useFieldArray } from "react-hook-form";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { AdminDialog, ADMIN_FLOW_DIALOG_CLASS } from "@/components/AdminDialog";
import { AdminLinearProgress } from "@/components/AdminLinearProgress";
import { AdminSettingRow } from "@/components/AdminSettingRow";
import { AdminTextField } from "@/components/AdminTextField";
import { DiscardChangesDialog } from "@/components/DiscardChangesDialog";
import { ActionFlowShell } from "@/components/Layout/ActionFlowShell";
import { FlowStepHeader } from "@/components/Layout/FlowStepHeader";
import { cycleName } from "../poolPresentation";

export interface SeedCommitmentDialogProps {
  open: boolean;
  chainId: number;
  garden: Address;
  onClose: () => void;
  /**
   * Seeding in protocol context (the root garden's pool): requests default to
   * steward review. A garden campaign defaults to open claims.
   */
  protocolContext?: boolean;
}

type StepId = "what" | "howMuch" | "proof" | "review";
const STEPS: StepId[] = ["what", "howMuch", "proof", "review"];

const STEP_FIELDS: Record<StepId, Array<keyof CommitmentComposerValues>> = {
  what: ["kind", "direction", "cycleId", "title", "note"],
  howMuch: ["unitLabel", "targetUnits", "dueInDays", "requirements", "openTeam"],
  proof: [
    "confirmers",
    "confirmationThreshold",
    "protocolFallbackEnabled",
    "claimMode",
    "considerationRail",
    "considerationSource",
    "considerationToken",
    "considerationAmount",
  ],
  review: [],
};

const SELECT_CLASS =
  "w-full rounded-[var(--m3-shape-sm)] bg-[rgb(var(--m3-surface-container-highest))] px-3 py-2 text-body-md text-[rgb(var(--m3-on-surface))] ring-1 ring-inset ring-[rgb(var(--m3-outline-variant))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--tone-focus-ring,var(--m3-primary)))] disabled:opacity-[0.38]";

function actionUIDOf(actionId: string, chainId: number): string | null {
  const prefix = `${chainId}-`;
  if (!actionId.startsWith(prefix)) return null;
  const uid = actionId.slice(prefix.length);
  return /^\d+$/.test(uid) ? uid : null;
}

/**
 * W8, the steward's seeding console (uiux-spec §6.3): a cast of the member
 * composer over the same shared form, with the steward's extras. What → how
 * much → proof & confirmation → sectioned review, then one queued creation
 * through useCommitmentJobs; the queued row appears on the pool tab before
 * the indexer has it. The cycle selector groups the one season, then the
 * campaigns, then cycle-less; claim mode is prefilled by context; the
 * consideration rail defaults to none, names the external rail's fields,
 * and shows Celo settlement disabled with its readiness explanation unless
 * the garden's settlement account is active; the Green Goods team fallback is
 * on by default and disabled with a repair path when no protocol pool is
 * registered.
 */
export function SeedCommitmentDialog({
  open,
  chainId,
  garden,
  onClose,
  protocolContext = false,
}: SeedCommitmentDialogProps) {
  const { formatMessage } = useIntl();
  const noteId = useId();
  const pool = usePoolConsoleController({ chainId, garden });
  const protocolPool = useProtocolPool({ chainId });
  const settlement = useSettlementAccount({ chainId, garden });
  const { data: actions = [] } = useActions(chainId);
  const jobs = useCommitmentJobs({ chainId });
  const [stepIndex, setStepIndex] = useState(0);
  const [confirmerDraft, setConfirmerDraft] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const stepRef = useStepFocus<HTMLDivElement>(stepIndex);

  const form = useCommitmentComposerForm({
    kind: "SEASON_CAMPAIGN",
    direction: "OFFER",
    cycleId: pool.model.season ? pool.model.season.cycleId.toString() : "0",
    claimMode: protocolContext ? "APPROVAL_GATED" : "OPEN",
    protocolFallbackEnabled: protocolPool.isRegistered,
  });
  const requirements = useFieldArray({ control: form.control, name: "requirements" });
  const values = form.watch();
  const protocolRegistered = protocolPool.isRegistered;
  const settlementActive = Boolean(settlement.detail?.account?.active);

  const dirtyClose = useDirtyClose({
    isDirty: open && form.formState.isDirty,
    onClose,
    blockRouteChange: true,
    preventRouteChange: jobs.isPending,
  });

  const cycleOptions = useMemo(() => {
    const season = pool.model.season;
    const campaigns = pool.model.campaigns;
    return [
      ...(season
        ? [
            {
              value: season.cycleId.toString(),
              label: `${formatMessage({ id: "cockpit.garden.pool.cycle.season", defaultMessage: "Season" })} · ${cycleName(season, pool.cycleNames, formatMessage)}`,
            },
          ]
        : []),
      ...campaigns.map((campaign) => ({
        value: campaign.cycleId.toString(),
        label: `${formatMessage({ id: "cockpit.garden.pool.cycle.campaign", defaultMessage: "Campaign" })} · ${cycleName(campaign, pool.cycleNames, formatMessage)}`,
      })),
      {
        value: "0",
        label: formatMessage({
          id: "cockpit.garden.pool.seed.cycleless",
          defaultMessage: "No cycle (runs on its own)",
        }),
      },
    ];
  }, [pool.model.season, pool.model.campaigns, pool.cycleNames, formatMessage]);

  const stepConfigs = useMemo(
    () => [
      {
        id: "what",
        title: formatMessage({ id: "cockpit.garden.pool.seed.step.what", defaultMessage: "What" }),
        description: formatMessage({
          id: "cockpit.garden.pool.seed.step.whatHint",
          defaultMessage: "The kind of commitment, in its words",
        }),
      },
      {
        id: "howMuch",
        title: formatMessage({
          id: "cockpit.garden.pool.seed.step.howMuch",
          defaultMessage: "How much",
        }),
        description: formatMessage({
          id: "cockpit.garden.pool.seed.step.howMuchHint",
          defaultMessage: "Units, target, due, and the team",
        }),
      },
      {
        id: "proof",
        title: formatMessage({
          id: "cockpit.garden.pool.seed.step.proof",
          defaultMessage: "Proof & confirmation",
        }),
        description: formatMessage({
          id: "cockpit.garden.pool.seed.step.proofHint",
          defaultMessage: "Who confirms, how it's claimed",
        }),
      },
      {
        id: "review",
        title: formatMessage({
          id: "cockpit.garden.pool.seed.step.review",
          defaultMessage: "Review",
        }),
        description: formatMessage({
          id: "cockpit.garden.pool.seed.step.reviewHint",
          defaultMessage: "Sectioned check, then seed",
        }),
      },
    ],
    [formatMessage]
  );

  const currentStep = STEPS[stepIndex] ?? "review";
  const isLast = stepIndex === STEPS.length - 1;
  const busy = jobs.isPending;
  const title = formatMessage({
    id: "cockpit.garden.pool.seed.title",
    defaultMessage: "Seed a commitment",
  });

  const goNext = useCallback(async () => {
    const valid = await form.trigger(STEP_FIELDS[currentStep]);
    if (valid) setStepIndex((index) => index + 1);
  }, [form, currentStep]);

  const seed = useCallback(async () => {
    setSubmitError(null);
    const parsed = commitmentComposerSchema.safeParse(form.getValues());
    if (!parsed.success) {
      await form.trigger();
      setStepIndex(0);
      return;
    }
    if (pool.poolId === undefined || !jobs.viewer) {
      setSubmitError(
        formatMessage({
          id: "cockpit.garden.pool.seed.noPoolOrViewer",
          defaultMessage: "Sign in and choose a garden with a pool before seeding.",
        })
      );
      return;
    }
    // The fallback choice cannot stand without a registered protocol pool.
    const valuesToSend = protocolRegistered
      ? parsed.data
      : { ...parsed.data, protocolFallbackEnabled: false };
    const payload = buildCommitmentCreationPayload({
      values: valuesToSend,
      clientCommitmentId: crypto.randomUUID(),
      poolId: pool.poolId,
      creator: jobs.viewer,
      gardenAddress: garden,
      nowSeconds: Math.floor(Date.now() / 1000),
      allowGatedOffers: true,
    });
    try {
      await jobs.enqueue({ act: "create", payload });
      onClose();
    } catch (error) {
      logger.error("[SeedCommitmentDialog] enqueue failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      setSubmitError(
        formatMessage({
          id: "cockpit.garden.pool.seed.enqueueFailed",
          defaultMessage: "The commitment could not be queued. Nothing was sent; try again.",
        })
      );
    }
  }, [form, pool.poolId, jobs, protocolRegistered, garden, onClose, formatMessage]);

  const addConfirmer = () => {
    const candidate = confirmerDraft.trim();
    if (!/^0x[0-9a-fA-F]{40}$/.test(candidate)) return;
    const current = form.getValues("confirmers");
    if (current.some((address) => address.toLowerCase() === candidate.toLowerCase())) {
      setConfirmerDraft("");
      return;
    }
    form.setValue("confirmers", [...current, candidate], {
      shouldDirty: true,
      shouldValidate: true,
    });
    setConfirmerDraft("");
  };

  const errorOf = (field: keyof CommitmentComposerValues) =>
    form.formState.errors[field]?.message as string | undefined;

  let body: ReactNode;
  switch (currentStep) {
    case "what":
      body = (
        <div className="space-y-4">
          <Controller
            control={form.control}
            name="kind"
            render={({ field }) => (
              <AdminChoiceGroup
                ariaLabel={formatMessage({
                  id: "cockpit.garden.pool.seed.kind",
                  defaultMessage: "Type",
                })}
                value={field.value}
                onChange={field.onChange}
                options={[
                  {
                    value: "SEASON_CAMPAIGN",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.kind.seasonCampaign",
                      defaultMessage: "Season / campaign commitment",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.seed.kind.seasonCampaignHint",
                      defaultMessage: "The pool offers or requests",
                    }),
                  },
                  {
                    value: "SERVICE",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.kind.service",
                      defaultMessage: "Support / service",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.seed.kind.serviceHint",
                      defaultMessage: "Kept by proof",
                    }),
                  },
                  {
                    value: "GARDEN_WORK",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.kind.gardenWork",
                      defaultMessage: "Garden work (impact)",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.seed.kind.gardenWorkHint",
                      defaultMessage: "Kept by approved actions",
                    }),
                  },
                ]}
              />
            )}
          />
          <Controller
            control={form.control}
            name="direction"
            render={({ field }) => (
              <AdminChoiceGroup
                ariaLabel={formatMessage({
                  id: "cockpit.garden.pool.seed.direction",
                  defaultMessage: "Direction",
                })}
                value={field.value}
                onChange={field.onChange}
                columns={2}
                options={[
                  {
                    value: "OFFER",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.direction.offer",
                      defaultMessage: "The pool offers",
                    }),
                  },
                  {
                    value: "REQUEST",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.direction.request",
                      defaultMessage: "The pool requests",
                    }),
                  },
                ]}
              />
            )}
          />
          <div className="space-y-1.5">
            <label htmlFor={`${noteId}-cycle`} className="label-md block text-text-strong">
              {formatMessage({ id: "cockpit.garden.pool.seed.cycle", defaultMessage: "Cycle" })}
            </label>
            <select
              id={`${noteId}-cycle`}
              className={SELECT_CLASS}
              value={values.cycleId}
              onChange={(event) =>
                form.setValue("cycleId", event.target.value, { shouldDirty: true })
              }
              disabled={busy}
            >
              {cycleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {errorOf("cycleId") ? (
              <p className="text-xs text-[rgb(var(--m3-error))]">{errorOf("cycleId")}</p>
            ) : null}
          </div>
          <AdminTextField
            label={formatMessage({
              id: "cockpit.garden.pool.seed.titleField",
              defaultMessage: "Title",
            })}
            value={values.title}
            onChange={(event) =>
              form.setValue("title", event.target.value, {
                shouldDirty: true,
                shouldValidate: true,
              })
            }
            error={errorOf("title")}
            disabled={busy}
            required
          />
          <div className="space-y-1.5">
            <label htmlFor={noteId} className="label-md block text-text-strong">
              {formatMessage({ id: "cockpit.garden.pool.seed.note", defaultMessage: "Note" })}
            </label>
            <textarea
              id={noteId}
              value={values.note ?? ""}
              onChange={(event) => form.setValue("note", event.target.value, { shouldDirty: true })}
              rows={3}
              maxLength={2000}
              disabled={busy}
              className={`${SELECT_CLASS} resize-y`}
            />
          </div>
        </div>
      );
      break;
    case "howMuch":
      body = (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AdminTextField
              label={formatMessage({ id: "cockpit.garden.pool.seed.unit", defaultMessage: "Unit" })}
              value={values.unitLabel}
              onChange={(event) =>
                form.setValue("unitLabel", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              error={errorOf("unitLabel")}
              placeholder={formatMessage({
                id: "cockpit.garden.pool.seed.unitPlaceholder",
                defaultMessage: "rides",
              })}
              disabled={busy}
              required
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.garden.pool.seed.target",
                defaultMessage: "Target",
              })}
              value={String(values.targetUnits)}
              onChange={(event) =>
                form.setValue("targetUnits", Number(event.target.value), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              error={errorOf("targetUnits")}
              inputProps={{ inputMode: "numeric" }}
              disabled={busy}
              required
            />
            <AdminTextField
              label={formatMessage({
                id: "cockpit.garden.pool.seed.dueInDays",
                defaultMessage: "Due in (days)",
              })}
              value={String(values.dueInDays)}
              onChange={(event) =>
                form.setValue("dueInDays", Number(event.target.value), {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              error={errorOf("dueInDays")}
              inputProps={{ inputMode: "numeric" }}
              disabled={busy}
              required
            />
          </div>
          <Controller
            control={form.control}
            name="openTeam"
            render={({ field }) => (
              <AdminChoiceGroup
                ariaLabel={formatMessage({
                  id: "cockpit.garden.pool.seed.contributorPolicy",
                  defaultMessage: "Contributor policy",
                })}
                value={field.value ? "open" : "lead"}
                onChange={(value) => field.onChange(value === "open")}
                columns={2}
                options={[
                  {
                    value: "open",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.team.open",
                      defaultMessage: "Open team",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.seed.team.openHint",
                      defaultMessage: "Eligible garden members may join",
                    }),
                  },
                  {
                    value: "lead",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.team.lead",
                      defaultMessage: "Lead-managed team",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.seed.team.leadHint",
                      defaultMessage: "The lead or a steward manages the roster",
                    }),
                  },
                ]}
              />
            )}
          />
          {values.kind === "GARDEN_WORK" ? (
            <div className="space-y-2" data-testid="seed-requirements">
              <p className="label-md text-text-strong">
                {formatMessage({
                  id: "cockpit.garden.pool.seed.requirements",
                  defaultMessage: "Actions this needs",
                })}
              </p>
              <p className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.seed.requirementsHint",
                  defaultMessage:
                    "Each row names a garden action and how many approved works it takes. Add as many as the work needs.",
                })}
              </p>
              {requirements.fields.map((row, index) => (
                <div key={row.id} className="flex items-end gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <label
                      htmlFor={`${noteId}-req-${index}`}
                      className="label-md block text-text-strong"
                    >
                      {formatMessage({
                        id: "cockpit.garden.pool.seed.requirementAction",
                        defaultMessage: "Action",
                      })}
                    </label>
                    <select
                      id={`${noteId}-req-${index}`}
                      className={SELECT_CLASS}
                      value={values.requirements[index]?.actionUID ?? ""}
                      onChange={(event) =>
                        form.setValue(`requirements.${index}.actionUID`, event.target.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      disabled={busy}
                    >
                      <option value="">
                        {formatMessage({
                          id: "cockpit.garden.pool.seed.requirementChoose",
                          defaultMessage: "Choose an action",
                        })}
                      </option>
                      {actions.map((action) => {
                        const uid = actionUIDOf(action.id, chainId);
                        return uid === null ? null : (
                          <option key={action.id} value={uid}>
                            {action.title}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <AdminTextField
                    label={formatMessage({
                      id: "cockpit.garden.pool.seed.requirementCount",
                      defaultMessage: "Count",
                    })}
                    value={String(values.requirements[index]?.requiredCount ?? 1)}
                    onChange={(event) =>
                      form.setValue(
                        `requirements.${index}.requiredCount`,
                        Number(event.target.value),
                        { shouldDirty: true, shouldValidate: true }
                      )
                    }
                    inputProps={{ inputMode: "numeric" }}
                    className="w-24"
                    disabled={busy}
                  />
                  <AdminButton
                    type="button"
                    variant="text"
                    size="sm"
                    aria-label={formatMessage({
                      id: "app.common.remove",
                      defaultMessage: "Remove",
                    })}
                    onClick={() => requirements.remove(index)}
                    disabled={busy}
                  >
                    <RiCloseLine className="h-4 w-4" />
                  </AdminButton>
                </div>
              ))}
              <AdminButton
                type="button"
                variant="outlined"
                size="sm"
                leadingIcon={<RiAddLine className="h-4 w-4" />}
                onClick={() => requirements.append({ actionUID: "", requiredCount: 1 })}
                disabled={busy}
              >
                {formatMessage({
                  id: "cockpit.garden.pool.seed.requirementAdd",
                  defaultMessage: "Add action",
                })}
              </AdminButton>
              {form.formState.errors.requirements?.message ? (
                <p className="text-xs text-[rgb(var(--m3-error))]">
                  {String(form.formState.errors.requirements.message)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-text-soft">
              {formatMessage({
                id: "cockpit.garden.pool.seed.proofOnly",
                defaultMessage:
                  "This commitment is confirmed by proof, so it has no garden-work action requirements.",
              })}
            </p>
          )}
        </div>
      );
      break;
    case "proof":
      body = (
        <div className="space-y-4">
          <div className="space-y-2" data-testid="seed-confirmers">
            <p className="label-md text-text-strong">
              {formatMessage({
                id: "cockpit.garden.pool.seed.confirmers",
                defaultMessage: "Confirmers",
              })}
            </p>
            <p className="text-xs text-text-soft">
              {values.confirmers.length === 0
                ? values.direction === "REQUEST"
                  ? formatMessage({
                      id: "cockpit.garden.pool.seed.confirmersDefaultRequest",
                      defaultMessage:
                        "Nobody named: the pool, as the asker, confirms through its stewards.",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.seed.confirmersDefaultOffer",
                      defaultMessage: "Nobody named: whoever takes this up confirms it.",
                    })
                : formatMessage({
                    id: "cockpit.garden.pool.seed.confirmersNamed",
                    defaultMessage:
                      "A named group. The lead and every contributor are excluded by the contract.",
                  })}
            </p>
            {values.confirmers.length > 0 ? (
              <ul className="divide-y divide-[rgb(var(--m3-outline-variant))]">
                {values.confirmers.map((address) => (
                  <li key={address} className="flex items-center justify-between gap-2 py-1.5">
                    <span className="truncate font-mono text-xs text-text-strong" title={address}>
                      {address}
                    </span>
                    <AdminButton
                      type="button"
                      variant="text"
                      size="sm"
                      aria-label={formatMessage({
                        id: "app.common.remove",
                        defaultMessage: "Remove",
                      })}
                      onClick={() =>
                        form.setValue(
                          "confirmers",
                          values.confirmers.filter((entry) => entry !== address),
                          { shouldDirty: true, shouldValidate: true }
                        )
                      }
                      disabled={busy}
                    >
                      <RiCloseLine className="h-4 w-4" />
                    </AdminButton>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex items-end gap-2">
              <AdminTextField
                label={formatMessage({
                  id: "cockpit.garden.pool.seed.confirmerAddress",
                  defaultMessage: "Add an address",
                })}
                value={confirmerDraft}
                onChange={(event) => setConfirmerDraft(event.target.value)}
                placeholder="0x…"
                className="flex-1"
                disabled={busy}
              />
              <AdminButton
                type="button"
                variant="outlined"
                size="sm"
                leadingIcon={<RiAddLine className="h-4 w-4" />}
                onClick={addConfirmer}
                disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(confirmerDraft.trim())}
              >
                {formatMessage({
                  id: "cockpit.garden.pool.seed.confirmerAdd",
                  defaultMessage: "Add",
                })}
              </AdminButton>
            </div>
            {values.confirmers.length > 0 ? (
              <AdminTextField
                label={formatMessage({
                  id: "cockpit.garden.pool.seed.threshold",
                  defaultMessage: "How many must confirm",
                })}
                value={String(values.confirmationThreshold)}
                onChange={(event) =>
                  form.setValue("confirmationThreshold", Number(event.target.value), {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                error={errorOf("confirmationThreshold")}
                helperText={formatMessage(
                  {
                    id: "cockpit.garden.pool.seed.thresholdHint",
                    defaultMessage: "Of {count} named",
                  },
                  { count: values.confirmers.length }
                )}
                inputProps={{ inputMode: "numeric" }}
                className="w-40"
                disabled={busy}
              />
            ) : null}
          </div>

          <AdminSettingRow
            labelId={`${noteId}-fallback`}
            label={formatMessage({
              id: "cockpit.garden.pool.seed.protocolFallback",
              defaultMessage: "Let the Green Goods team confirm if nobody local is eligible",
            })}
            description={
              protocolRegistered
                ? formatMessage({
                    id: "cockpit.garden.pool.seed.protocolFallbackHint",
                    defaultMessage:
                      "On for this pilot. Usable only while nobody local can confirm, always with a recorded reason; every contributor stays excluded.",
                  })
                : formatMessage({
                    id: "cockpit.garden.pool.seed.protocolFallbackUnavailable",
                    defaultMessage:
                      "Unavailable on this deployment: no Green Goods protocol pool is registered yet. The fallback is stored off.",
                  })
            }
          >
            <input
              type="checkbox"
              aria-labelledby={`${noteId}-fallback`}
              checked={protocolRegistered && values.protocolFallbackEnabled}
              disabled={busy || !protocolRegistered}
              onChange={(event) =>
                form.setValue("protocolFallbackEnabled", event.target.checked, {
                  shouldDirty: true,
                })
              }
              className="h-5 w-5 accent-[rgb(var(--tone-action))]"
            />
          </AdminSettingRow>
          {!protocolRegistered ? (
            <Alert variant="warning">
              {formatMessage({
                id: "cockpit.garden.pool.seed.protocolFallbackRepair",
                defaultMessage:
                  "Repair path: register the protocol pool (a deployment operation), or name a reachable local confirmer group before seeding.",
              })}
            </Alert>
          ) : null}

          <Controller
            control={form.control}
            name="claimMode"
            render={({ field }) => (
              <AdminChoiceGroup
                ariaLabel={formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode",
                  defaultMessage: "Claim mode",
                })}
                value={field.value}
                onChange={field.onChange}
                columns={2}
                options={[
                  {
                    value: "OPEN",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.claimMode.open",
                      defaultMessage: "Open",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.seed.claimMode.openHint",
                      defaultMessage: "Anyone in the garden may take it up",
                    }),
                  },
                  {
                    value: "APPROVAL_GATED",
                    label: formatMessage({
                      id: "cockpit.garden.pool.seed.claimMode.gated",
                      defaultMessage: "Steward-reviewed",
                    }),
                    description: formatMessage({
                      id: "cockpit.garden.pool.seed.claimMode.gatedHint",
                      defaultMessage: "Requests wait for review",
                    }),
                  },
                ]}
              />
            )}
          />

          <details className="rounded-[var(--m3-shape-md)] bg-[rgb(var(--m3-surface-container-highest))] p-3">
            <summary className="label-md cursor-pointer text-text-strong">
              {formatMessage({
                id: "cockpit.garden.pool.seed.reward",
                defaultMessage: "Advanced: declared reward",
              })}
            </summary>
            <div className="mt-3 space-y-3" data-testid="seed-consideration">
              <Controller
                control={form.control}
                name="considerationRail"
                render={({ field }) => (
                  <AdminChoiceGroup
                    ariaLabel={formatMessage({
                      id: "cockpit.garden.pool.seed.rail",
                      defaultMessage: "Reward rail",
                    })}
                    value={field.value}
                    onChange={field.onChange}
                    options={[
                      {
                        value: "NONE",
                        label: formatMessage({
                          id: "cockpit.garden.pool.seed.rail.none",
                          defaultMessage: "None",
                        }),
                        description: formatMessage({
                          id: "cockpit.garden.pool.seed.rail.noneHint",
                          defaultMessage: "No declared reward",
                        }),
                      },
                      {
                        value: "ARBITRUM_EXTERNAL",
                        label: formatMessage({
                          id: "cockpit.garden.pool.seed.rail.external",
                          defaultMessage: "External payout record",
                        }),
                        description: formatMessage({
                          id: "cockpit.garden.pool.seed.rail.externalHint",
                          defaultMessage:
                            "Record a jar or treasury payout after the fact; no value moves here",
                        }),
                      },
                      {
                        value: "CELO_SETTLEMENT",
                        label: formatMessage({
                          id: "cockpit.garden.pool.seed.rail.celo",
                          defaultMessage: "Celo G$ settlement",
                        }),
                        description: settlementActive
                          ? formatMessage({
                              id: "cockpit.garden.pool.seed.rail.celoHint",
                              defaultMessage: "A conserved payout plan after fulfilment",
                            })
                          : formatMessage({
                              id: "cockpit.garden.pool.seed.rail.celoUnavailable",
                              defaultMessage:
                                "Needs this garden's settlement account to be active first",
                            }),
                        disabled: !settlementActive,
                      },
                    ]}
                  />
                )}
              />
              {values.considerationRail === "ARBITRUM_EXTERNAL" ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <AdminTextField
                    label={formatMessage({
                      id: "cockpit.garden.pool.seed.rewardSource",
                      defaultMessage: "Paid from (address)",
                    })}
                    value={values.considerationSource}
                    onChange={(event) =>
                      form.setValue("considerationSource", event.target.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    error={errorOf("considerationSource")}
                    placeholder="0x…"
                    disabled={busy}
                  />
                  <AdminTextField
                    label={formatMessage({
                      id: "cockpit.garden.pool.seed.rewardToken",
                      defaultMessage: "Token (address)",
                    })}
                    value={values.considerationToken}
                    onChange={(event) =>
                      form.setValue("considerationToken", event.target.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    error={errorOf("considerationToken")}
                    placeholder="0x…"
                    disabled={busy}
                  />
                  <AdminTextField
                    label={formatMessage({
                      id: "cockpit.garden.pool.seed.rewardAmount",
                      defaultMessage: "Amount (base units)",
                    })}
                    value={values.considerationAmount}
                    onChange={(event) =>
                      form.setValue("considerationAmount", event.target.value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                    error={errorOf("considerationAmount")}
                    inputProps={{ inputMode: "numeric" }}
                    disabled={busy}
                  />
                </div>
              ) : values.considerationRail === "CELO_SETTLEMENT" ? (
                <AdminTextField
                  label={formatMessage({
                    id: "cockpit.garden.pool.seed.rewardAmountCelo",
                    defaultMessage: "Amount in G$ base units",
                  })}
                  value={values.considerationAmount}
                  onChange={(event) =>
                    form.setValue("considerationAmount", event.target.value, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  error={errorOf("considerationAmount")}
                  inputProps={{ inputMode: "numeric" }}
                  disabled={busy}
                />
              ) : null}
              <p className="text-xs text-text-soft">
                {formatMessage({
                  id: "cockpit.garden.pool.seed.rewardNote",
                  defaultMessage:
                    "One rail only. External payouts are recorded after the fact; Celo G$ becomes a conserved payout plan after fulfilment. Nothing here pays anyone.",
                })}
              </p>
            </div>
          </details>
        </div>
      );
      break;
    default: {
      const cycleLabel =
        cycleOptions.find((option) => option.value === values.cycleId)?.label ?? "—";
      const section = (heading: string, rows: Array<[string, string]>) => (
        <div className="space-y-1.5">
          <p className="label-xs text-text-soft">{heading}</p>
          <dl className="space-y-1">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3 text-body-md">
                <dt className="text-text-soft">{label}</dt>
                <dd className="truncate text-right text-text-strong" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      );
      const kindLabel =
        values.kind === "GARDEN_WORK"
          ? formatMessage({
              id: "cockpit.garden.pool.seed.kind.gardenWork",
              defaultMessage: "Garden work (impact)",
            })
          : values.kind === "SERVICE"
            ? formatMessage({
                id: "cockpit.garden.pool.seed.kind.service",
                defaultMessage: "Support / service",
              })
            : formatMessage({
                id: "cockpit.garden.pool.seed.kind.seasonCampaign",
                defaultMessage: "Season / campaign commitment",
              });
      body = (
        <div className="space-y-4" data-testid="seed-review">
          {section(
            formatMessage({ id: "cockpit.garden.pool.seed.step.what", defaultMessage: "What" }),
            [
              [
                formatMessage({ id: "cockpit.garden.pool.seed.kind", defaultMessage: "Type" }),
                `${kindLabel} · ${
                  values.direction === "REQUEST"
                    ? formatMessage({
                        id: "cockpit.garden.pool.seed.direction.request",
                        defaultMessage: "The pool requests",
                      })
                    : formatMessage({
                        id: "cockpit.garden.pool.seed.direction.offer",
                        defaultMessage: "The pool offers",
                      })
                }`,
              ],
              [
                formatMessage({
                  id: "cockpit.garden.pool.seed.titleField",
                  defaultMessage: "Title",
                }),
                values.title,
              ],
              [
                formatMessage({ id: "cockpit.garden.pool.seed.cycle", defaultMessage: "Cycle" }),
                cycleLabel,
              ],
            ]
          )}
          {section(
            formatMessage({
              id: "cockpit.garden.pool.seed.step.howMuch",
              defaultMessage: "How much",
            }),
            [
              [
                formatMessage({
                  id: "cockpit.garden.pool.seed.unitTarget",
                  defaultMessage: "Unit · target",
                }),
                `${values.unitLabel} · ${values.targetUnits}`,
              ],
              [
                formatMessage({
                  id: "cockpit.garden.pool.seed.dueInDays",
                  defaultMessage: "Due in (days)",
                }),
                String(values.dueInDays),
              ],
              [
                formatMessage({
                  id: "cockpit.garden.pool.seed.contributorPolicy",
                  defaultMessage: "Contributor policy",
                }),
                values.openTeam
                  ? formatMessage({
                      id: "cockpit.garden.pool.seed.team.open",
                      defaultMessage: "Open team",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.seed.team.lead",
                      defaultMessage: "Lead-managed team",
                    }),
              ],
              ...(values.kind === "GARDEN_WORK"
                ? [
                    [
                      formatMessage({
                        id: "cockpit.garden.pool.seed.requirements",
                        defaultMessage: "Actions this needs",
                      }),
                      values.requirements
                        .map((row) => {
                          const action = actions.find(
                            (entry) => actionUIDOf(entry.id, chainId) === row.actionUID
                          );
                          return `${action?.title ?? `#${row.actionUID}`} × ${row.requiredCount}`;
                        })
                        .join(" · "),
                    ] as [string, string],
                  ]
                : []),
            ]
          )}
          {section(
            formatMessage({
              id: "cockpit.garden.pool.seed.step.proof",
              defaultMessage: "Proof & confirmation",
            }),
            [
              [
                formatMessage({
                  id: "cockpit.garden.pool.seed.confirmers",
                  defaultMessage: "Confirmers",
                }),
                values.confirmers.length === 0
                  ? formatMessage({
                      id: "cockpit.garden.pool.seed.review.ordinary",
                      defaultMessage: "Ordinary rule",
                    })
                  : formatMessage(
                      {
                        id: "cockpit.garden.pool.seed.review.named",
                        defaultMessage: "Named group · {threshold} of {count}",
                      },
                      { threshold: values.confirmationThreshold, count: values.confirmers.length }
                    ),
              ],
              [
                formatMessage({
                  id: "cockpit.garden.pool.seed.review.fallback",
                  defaultMessage: "Green Goods team fallback",
                }),
                protocolRegistered && values.protocolFallbackEnabled
                  ? formatMessage({
                      id: "cockpit.garden.pool.seed.review.fallbackOn",
                      defaultMessage: "On · reason required if used",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.seed.review.fallbackOff",
                      defaultMessage: "Off",
                    }),
              ],
              [
                formatMessage({
                  id: "cockpit.garden.pool.seed.claimMode",
                  defaultMessage: "Claim mode",
                }),
                values.claimMode === "APPROVAL_GATED"
                  ? formatMessage({
                      id: "cockpit.garden.pool.seed.claimMode.gated",
                      defaultMessage: "Steward-reviewed",
                    })
                  : formatMessage({
                      id: "cockpit.garden.pool.seed.claimMode.open",
                      defaultMessage: "Open",
                    }),
              ],
            ]
          )}
          {section(
            formatMessage({
              id: "cockpit.garden.pool.seed.reward",
              defaultMessage: "Advanced: declared reward",
            }),
            [
              [
                formatMessage({
                  id: "cockpit.garden.pool.seed.rail",
                  defaultMessage: "Reward rail",
                }),
                values.considerationRail === "ARBITRUM_EXTERNAL"
                  ? `${formatMessage({ id: "cockpit.garden.pool.seed.rail.external", defaultMessage: "External payout record" })} · ${values.considerationAmount}`
                  : values.considerationRail === "CELO_SETTLEMENT"
                    ? `${formatMessage({ id: "cockpit.garden.pool.seed.rail.celo", defaultMessage: "Celo G$ settlement" })} · ${values.considerationAmount}`
                    : formatMessage({
                        id: "cockpit.garden.pool.seed.rail.none",
                        defaultMessage: "None",
                      }),
              ],
            ]
          )}
          {submitError ? <Alert variant="error">{submitError}</Alert> : null}
          {pool.queueUnavailable ? (
            <Alert variant="warning">
              {formatMessage({
                id: "cockpit.garden.pool.seed.queueUnavailable",
                defaultMessage:
                  "The queue on this device could not be read; seeding will still try.",
              })}
            </Alert>
          ) : null}
          <p className="text-xs text-text-soft">
            {formatMessage({
              id: "cockpit.garden.pool.seed.queueNote",
              defaultMessage:
                "Seeding queues the creation on this device and sends it when it can; the row shows on the pool tab right away.",
            })}
          </p>
        </div>
      );
    }
  }

  const footer = (
    <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
      <div className="min-w-0 sm:flex-1" aria-live="polite">
        {busy ? <AdminLinearProgress ariaLabel={title} /> : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <AdminButton
          type="button"
          variant={stepIndex === 0 ? "text" : "outlined"}
          onClick={() =>
            stepIndex === 0 ? dirtyClose.onOpenChange(false) : setStepIndex((index) => index - 1)
          }
          disabled={busy}
          className="self-start sm:self-auto"
        >
          {stepIndex === 0
            ? formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })
            : formatMessage({ id: "app.common.back", defaultMessage: "Back" })}
        </AdminButton>
        {isLast ? (
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => void seed()}
            disabled={busy || pool.poolId === undefined || pool.model.status !== "open"}
            loading={busy}
            className="w-full sm:w-auto"
          >
            {formatMessage({
              id: "cockpit.garden.pool.seed.submit",
              defaultMessage: "Seed this commitment",
            })}
          </AdminButton>
        ) : (
          <AdminButton
            type="button"
            variant="filled"
            onClick={() => void goNext()}
            disabled={busy}
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
        preventClose={busy}
        title={title}
        description={formatMessage({
          id: "cockpit.garden.pool.seed.description",
          defaultMessage: "Offer or ask for something on the pool's behalf.",
        })}
        bodyClassName="flex min-h-0 flex-col !overflow-hidden"
      >
        <ActionFlowShell
          layout="dialog"
          title={title}
          context={
            pool.model.season
              ? cycleName(pool.model.season, pool.cycleNames, formatMessage)
              : undefined
          }
          steps={stepConfigs}
          currentStep={stepIndex + 1}
          onStepClick={(step) => {
            if (!busy && step - 1 < stepIndex) setStepIndex(step - 1);
          }}
          footer={footer}
        >
          <div ref={stepRef} tabIndex={-1} className="space-y-4 outline-none">
            <FlowStepHeader
              title={stepConfigs[stepIndex]?.title ?? title}
              description={stepConfigs[stepIndex]?.description}
            />
            {pool.model.status !== "open" && pool.poolId !== undefined ? (
              <Alert variant="warning">
                {formatMessage({
                  id: "cockpit.garden.pool.seed.poolNotOpen",
                  defaultMessage: "The pool is not open, so nothing can be seeded into it yet.",
                })}
              </Alert>
            ) : null}
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
