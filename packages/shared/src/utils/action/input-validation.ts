import type { WorkInput } from "../../types/domain";

const inputTypes = new Set<WorkInput["type"]>([
  "text",
  "textarea",
  "select",
  "multi-select",
  "number",
  "band",
  "repeater",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isInputList(value: unknown): value is WorkInput[] {
  return (
    Array.isArray(value) &&
    value.every((input) => {
      if (!isRecord(input)) return false;
      return (
        typeof input.key === "string" &&
        !!input.key.trim() &&
        typeof input.title === "string" &&
        !!input.title.trim() &&
        typeof input.placeholder === "string" &&
        typeof input.required === "boolean" &&
        inputTypes.has(input.type as WorkInput["type"]) &&
        isStringList(input.options) &&
        (input.unit === undefined || typeof input.unit === "string") &&
        (input.bands === undefined ? input.type !== "band" : isStringList(input.bands)) &&
        (input.repeaterFields === undefined
          ? input.type !== "repeater"
          : isInputList(input.repeaterFields)) &&
        [input.optionLabels, input.bandLabels].every(
          (labels) =>
            labels === undefined ||
            (isRecord(labels) && Object.values(labels).every((label) => typeof label === "string"))
        )
      );
    })
  );
}

/** Historical evidence must have complete, safe definitions rather than today's fallback. */
export function assertRecordedInputDefinitions(candidate: unknown): void {
  if (
    !isRecord(candidate) ||
    !isRecord(candidate.uiConfig) ||
    !isRecord(candidate.uiConfig.details) ||
    !isInputList(candidate.uiConfig.details.inputs)
  ) {
    throw new Error(
      "Action instructions have no recorded input definitions or contain invalid entries"
    );
  }
}
