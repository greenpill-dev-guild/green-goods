import type { GardenSettingsChange } from "@green-goods/shared/hooks/garden/useUpdateGarden";
import type { TxProgressRow, TxProgressTone } from "@/components/TxProgressList";
import type { TxStepMarkerState } from "@/components/TxStepMarker";
import { DOMAIN_OPTIONS, type GardenSettingsField } from "./gardenSettingsDraft";

type FormatMessage = (
  descriptor: { id: string; defaultMessage?: string },
  values?: Record<string, string | number>
) => string;

/**
 * Where one field's write stands during a save. `proposed` is a write a Safe
 * accepted as a proposal: it lands only once the Safe executes it. `unconfirmed`
 * is a write that may have landed: nobody can say yet, so it is not sent again.
 */
export type GardenSettingsFieldState =
  | "queued"
  | "uploading"
  | "waiting"
  | "saved"
  | "proposed"
  | "unconfirmed"
  | "failed";

export interface GardenSettingsFieldProgress {
  state: GardenSettingsFieldState;
  /** The transaction that saved the field, once it has. */
  hash: `0x${string}` | null;
}

/** One press of Save or Try Again: the fields it writes and where each stands. */
export interface GardenSettingsSaveRun {
  status: "running" | "stopped" | "unconfirmed" | "complete";
  /** Written in this order, one wallet confirmation each, unless `oneSignature`. */
  fields: readonly GardenSettingsField[];
  progress: Readonly<Partial<Record<GardenSettingsField, GardenSettingsFieldProgress>>>;
  /** The fields go as one batch, so they land or fail together. */
  oneSignature?: boolean;
}

/** Each row is named after the field the steward edited. */
const FIELD_TITLES: Record<GardenSettingsField, { id: string; defaultMessage: string }> = {
  name: { id: "app.garden.settings.name", defaultMessage: "Name" },
  description: { id: "app.garden.settings.descriptionLabel", defaultMessage: "Description" },
  location: { id: "app.garden.settings.location", defaultMessage: "Location" },
  openJoining: { id: "app.garden.settings.openJoining", defaultMessage: "Open joining" },
  maxGardeners: { id: "app.garden.settings.limitGardeners", defaultMessage: "Limit gardeners" },
  domains: { id: "app.garden.detail.domains", defaultMessage: "Domains" },
  banner: { id: "app.garden.create.bannerImageLabel", defaultMessage: "Banner image" },
};

const MARKER: Record<GardenSettingsFieldState, TxStepMarkerState> = {
  queued: "pending",
  uploading: "active",
  waiting: "active",
  saved: "complete",
  proposed: "warning",
  // A clock, not the warning's cross: nobody can say yet that it failed.
  unconfirmed: "queued",
  failed: "failed",
};

const TONE: Record<GardenSettingsFieldState, TxProgressTone> = {
  queued: "soft",
  uploading: "active",
  waiting: "active",
  saved: "success",
  proposed: "warning",
  unconfirmed: "warning",
  failed: "error",
};

function stateLabel(
  state: GardenSettingsFieldState,
  oneSignature: boolean,
  formatMessage: FormatMessage
) {
  switch (state) {
    case "queued":
      return null;
    case "uploading":
      return formatMessage({
        id: "app.garden.settings.save.uploading",
        defaultMessage: "Uploading the image…",
      });
    case "waiting":
      return oneSignature
        ? formatMessage({
            id: "app.garden.settings.save.waitingSignature",
            defaultMessage: "Waiting for your signature",
          })
        : formatMessage({
            id: "app.garden.settings.save.waiting",
            defaultMessage: "Waiting for your wallet",
          });
    case "saved":
      return oneSignature
        ? formatMessage({ id: "app.garden.settings.save.savedTogether", defaultMessage: "Saved" })
        : formatMessage({ id: "app.garden.settings.save.saved", defaultMessage: "Confirmed" });
    case "proposed":
      return formatMessage({
        id: "app.garden.settings.save.proposed",
        defaultMessage: "Sent to your Safe",
      });
    case "unconfirmed":
      return formatMessage({
        id: "app.garden.settings.save.unconfirmed",
        defaultMessage: "Not confirmed yet",
      });
    case "failed":
      return formatMessage({
        id: "app.garden.settings.save.failed",
        defaultMessage: "Didn’t go through",
      });
  }
}

/** A field's name, as its row and the unknown-save alert call it. */
export function gardenSettingsFieldTitle(field: GardenSettingsField, formatMessage: FormatMessage) {
  return formatMessage(FIELD_TITLES[field]);
}

/** A value the chain holds, in the words the settings form uses for it. */
export function gardenSettingsValueText(
  change: GardenSettingsChange,
  formatMessage: FormatMessage
): string {
  switch (change.field) {
    case "openJoining":
      return change.value
        ? formatMessage({ id: "app.garden.settings.hold.on", defaultMessage: "On" })
        : formatMessage({ id: "app.garden.settings.hold.off", defaultMessage: "Off" });
    case "maxGardeners":
      return change.value > 0
        ? String(change.value)
        : formatMessage({ id: "app.garden.settings.hold.noLimit", defaultMessage: "No limit" });
    case "domains":
      return (
        DOMAIN_OPTIONS.filter(({ value }) => change.value.includes(value))
          .map(({ labelId, defaultLabel }) =>
            formatMessage({ id: labelId, defaultMessage: defaultLabel })
          )
          .join(", ") ||
        formatMessage({ id: "app.garden.settings.hold.none", defaultMessage: "None" })
      );
    case "banner":
      return change.value
        ? formatMessage({ id: "app.garden.settings.hold.hasImage", defaultMessage: "An image" })
        : formatMessage({ id: "app.garden.settings.hold.noImage", defaultMessage: "No image" });
    default:
      return (
        change.value ||
        formatMessage({ id: "app.garden.settings.hold.empty", defaultMessage: "Empty" })
      );
  }
}

/**
 * Where a run stands after its unknown outcome has been read again: fields that
 * landed read saved, a run with nothing left held is done, and a run whose
 * person moved on gives way to the form.
 */
export function settleGardenSettingsRun(
  run: GardenSettingsSaveRun | null,
  saved: readonly GardenSettingsField[],
  held: readonly GardenSettingsField[]
): GardenSettingsSaveRun | null {
  if (run?.status !== "unconfirmed") return run;
  const progress = { ...run.progress };
  for (const field of saved) progress[field] = { state: "saved", hash: null };
  if (run.fields.some((field) => held.includes(field))) return { ...run, progress };
  return run.fields.every((field) => progress[field]?.state === "saved")
    ? { ...run, status: "complete", progress }
    : null;
}

/** One row per field the run writes, numbered by the wallet prompt it takes. */
export function buildGardenSettingsSaveRows(
  run: GardenSettingsSaveRun,
  formatMessage: FormatMessage
): TxProgressRow[] {
  return run.fields.map((field, index) => {
    const { state, hash } = run.progress[field] ?? { state: "queued", hash: null };
    return {
      id: field,
      title: formatMessage(FIELD_TITLES[field]),
      status: state,
      marker: MARKER[state],
      label: stateLabel(state, Boolean(run.oneSignature), formatMessage),
      tone: TONE[state],
      current: state === "uploading" || state === "waiting",
      prompt: run.oneSignature ? 1 : index + 1,
      hash: state === "saved" ? hash : null,
    };
  });
}

/**
 * The line beside the dialog's Save: how many wallet confirmations a save
 * takes before it starts, then where it stands, where it stopped, or that
 * everything landed.
 */
export function gardenSettingsSaveLine(
  run: GardenSettingsSaveRun | null,
  pendingCount: number,
  formatMessage: FormatMessage,
  oneSignature = false
): string {
  if (run?.status === "running") {
    return formatMessage({ id: "app.garden.settings.saving", defaultMessage: "Saving changes…" });
  }
  if (run?.status === "unconfirmed") {
    return formatMessage({
      id: "app.garden.settings.save.unconfirmedLine",
      defaultMessage: "We couldn’t confirm this save. Your edits are still here.",
    });
  }
  if (run?.status === "stopped" && run.oneSignature) {
    return formatMessage({
      id: "app.garden.settings.save.nothingSaved",
      defaultMessage: "Nothing was saved. Your edits are still here.",
    });
  }
  if (run?.status === "stopped") {
    const stoppedAt = run.fields.find((field) => run.progress[field]?.state === "failed");
    return formatMessage(
      {
        id: "app.garden.settings.save.stopped",
        defaultMessage:
          "Stopped at {field}. {saved} of {total} saved. Your other edits are still here.",
      },
      {
        field: stoppedAt ? formatMessage(FIELD_TITLES[stoppedAt]) : "",
        saved: run.fields.filter((field) => run.progress[field]?.state === "saved").length,
        total: run.fields.length,
      }
    );
  }
  if (run?.status !== "complete" && pendingCount > 0 && oneSignature) {
    return formatMessage(
      {
        id: "app.garden.settings.save.planOneSignature",
        defaultMessage: "{count} changes · 1 signature",
      },
      { count: pendingCount }
    );
  }
  if (run?.status !== "complete" && pendingCount > 0) {
    return formatMessage(
      {
        id: "app.garden.settings.save.plan",
        defaultMessage:
          "{count, plural, one {# change · # wallet confirmation} other {# changes · # wallet confirmations}}",
      },
      { count: pendingCount }
    );
  }
  if (run?.status === "complete" && run.fields.some((f) => run.progress[f]?.state === "proposed")) {
    return formatMessage({
      id: "app.garden.settings.save.proposedAll",
      defaultMessage: "Sent to your Safe. The changes apply once the Safe executes them.",
    });
  }
  return formatMessage({ id: "app.garden.settings.allSaved", defaultMessage: "All changes saved" });
}
