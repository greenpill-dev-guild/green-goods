import type { TxProgressRow, TxProgressTone } from "@/components/TxProgressList";
import type { TxStepMarkerState } from "@/components/TxStepMarker";
import type { GardenSettingsField } from "./gardenSettingsDraft";

type FormatMessage = (
  descriptor: { id: string; defaultMessage?: string },
  values?: Record<string, string | number>
) => string;

/** Where one field's write stands during a save. */
export type GardenSettingsFieldState = "queued" | "uploading" | "waiting" | "saved" | "failed";

export interface GardenSettingsFieldProgress {
  state: GardenSettingsFieldState;
  /** The transaction that saved the field, once it has. */
  hash: `0x${string}` | null;
}

/** One press of Save or Try Again: the fields it writes and where each stands. */
export interface GardenSettingsSaveRun {
  status: "running" | "stopped" | "complete";
  /** Written in this order, one wallet confirmation each. */
  fields: readonly GardenSettingsField[];
  progress: Readonly<Partial<Record<GardenSettingsField, GardenSettingsFieldProgress>>>;
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
  failed: "failed",
};

const TONE: Record<GardenSettingsFieldState, TxProgressTone> = {
  queued: "soft",
  uploading: "active",
  waiting: "active",
  saved: "success",
  failed: "error",
};

function stateLabel(state: GardenSettingsFieldState, formatMessage: FormatMessage) {
  switch (state) {
    case "queued":
      return null;
    case "uploading":
      return formatMessage({
        id: "app.garden.settings.save.uploading",
        defaultMessage: "Uploading the image…",
      });
    case "waiting":
      return formatMessage({
        id: "app.garden.settings.save.waiting",
        defaultMessage: "Waiting for your wallet",
      });
    case "saved":
      return formatMessage({ id: "app.garden.settings.save.saved", defaultMessage: "Confirmed" });
    case "failed":
      return formatMessage({
        id: "app.garden.settings.save.failed",
        defaultMessage: "Didn’t go through",
      });
  }
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
      label: stateLabel(state, formatMessage),
      tone: TONE[state],
      current: state === "uploading" || state === "waiting",
      prompt: index + 1,
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
  formatMessage: FormatMessage
): string {
  if (run?.status === "running") {
    return formatMessage({ id: "app.garden.settings.saving", defaultMessage: "Saving changes…" });
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
  return formatMessage({ id: "app.garden.settings.allSaved", defaultMessage: "All changes saved" });
}
