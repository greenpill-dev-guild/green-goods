import { Domain, type ActionInstructionConfig } from "../../../types/domain";
import { defaultTemplate } from "../../../utils/action/templates";
import type { CreateActionFormData } from "../../action/useActionForm";
import { createActionDefaultValues } from "./createAction.utils";

export const ACTION_CREATE_DRAFT_PATH = "/actions/create";

export interface CreateActionSessionDraft {
  title: string;
  slug: string;
  domain: Domain;
  startTime: string | null;
  endTime: string | null;
  capitals: CreateActionFormData["capitals"];
  instructionConfig: ActionInstructionConfig;
  currentStep: number;
}

export interface EditActionSessionDraft {
  title: string;
  startTime: string | null;
  endTime: string | null;
  instructionConfig: ActionInstructionConfig;
  isEditingInstructions: boolean;
}

const createActionMediaDrafts = new Map<string, File[]>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toIsoDate(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }
  return null;
}

function fromIsoDate(value: unknown, fallback: Date) {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

function isFile(value: unknown): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

export function getActionEditDraftPath(actionId: string | undefined) {
  return actionId ? `/actions/${encodeURIComponent(actionId)}/edit` : null;
}

export function saveCreateActionMediaDraft(path: string, media: unknown) {
  if (Array.isArray(media) && media.every(isFile)) {
    createActionMediaDrafts.set(path, media);
  }
}

export function getCreateActionMediaDraft(path: string) {
  return createActionMediaDrafts.get(path) ?? [];
}

export function clearCreateActionMediaDraft(path: string) {
  createActionMediaDrafts.delete(path);
}

export function serializeCreateActionDraft(
  value: Partial<CreateActionFormData>,
  currentStep: number
): CreateActionSessionDraft {
  return {
    title: typeof value.title === "string" ? value.title : "",
    slug: typeof value.slug === "string" ? value.slug : "",
    domain: typeof value.domain === "number" ? value.domain : Domain.SOLAR,
    startTime: toIsoDate(value.startTime),
    endTime: toIsoDate(value.endTime),
    capitals: Array.isArray(value.capitals) ? value.capitals : [],
    instructionConfig: isRecord(value.instructionConfig)
      ? (value.instructionConfig as ActionInstructionConfig)
      : defaultTemplate,
    currentStep,
  };
}

export function restoreCreateActionDraft(
  draft: unknown,
  path: string
): { values: CreateActionFormData; currentStep: number } | null {
  if (!isRecord(draft)) return null;

  const defaults = createActionDefaultValues();
  const currentStep = typeof draft.currentStep === "number" ? draft.currentStep : 0;

  return {
    currentStep,
    values: {
      ...defaults,
      title: typeof draft.title === "string" ? draft.title : defaults.title,
      slug: typeof draft.slug === "string" ? draft.slug : defaults.slug,
      domain: typeof draft.domain === "number" ? (draft.domain as Domain) : defaults.domain,
      startTime: fromIsoDate(draft.startTime, defaults.startTime),
      endTime: fromIsoDate(draft.endTime, defaults.endTime),
      capitals: Array.isArray(draft.capitals)
        ? (draft.capitals as CreateActionFormData["capitals"])
        : defaults.capitals,
      media: getCreateActionMediaDraft(path),
      instructionConfig: isRecord(draft.instructionConfig)
        ? (draft.instructionConfig as unknown as ActionInstructionConfig)
        : defaults.instructionConfig,
    },
  };
}

export function serializeEditActionDraft(
  value: { title?: unknown; startTime?: unknown; endTime?: unknown },
  instructionConfig: ActionInstructionConfig,
  isEditingInstructions: boolean
): EditActionSessionDraft {
  return {
    title: typeof value.title === "string" ? value.title : "",
    startTime: toIsoDate(value.startTime),
    endTime: toIsoDate(value.endTime),
    instructionConfig,
    isEditingInstructions,
  };
}

export function restoreEditActionDraft(draft: unknown) {
  if (!isRecord(draft)) return null;

  return {
    title: typeof draft.title === "string" ? draft.title : "",
    startTime: fromIsoDate(draft.startTime, new Date()),
    endTime: fromIsoDate(draft.endTime, new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)),
    instructionConfig: isRecord(draft.instructionConfig)
      ? (draft.instructionConfig as unknown as ActionInstructionConfig)
      : defaultTemplate,
    isEditingInstructions:
      typeof draft.isEditingInstructions === "boolean" ? draft.isEditingInstructions : false,
  };
}
