import type { ActionInstructionInputTranslation, WorkInput } from "../../types/domain";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getInputTranslation(
  translations: ActionInstructionInputTranslation[] | undefined,
  key: string
) {
  return translations?.find((translation) => translation.key === key);
}

export function localizeInputs(
  inputs: WorkInput[],
  translations: ActionInstructionInputTranslation[] | undefined
): WorkInput[] {
  return inputs.map((input) => {
    const translated = getInputTranslation(translations, input.key);
    return {
      ...input,
      title: translated?.title || input.title,
      placeholder: translated?.placeholder || input.placeholder,
      optionLabels: translated?.options,
      bandLabels: translated?.bands,
      repeaterFields: input.repeaterFields
        ? localizeInputs(input.repeaterFields, translated?.repeaterFields)
        : undefined,
    };
  });
}

/** Project only recorded values whose labels and selected choices have usable locale copy. */
export function localizeRecordedInputs(
  inputs: WorkInput[],
  details: Record<string, unknown>,
  translations: ActionInstructionInputTranslation[] | undefined,
  needsTranslation: boolean
): WorkInput[] | null {
  function covered(
    values: Record<string, unknown>,
    inputs: WorkInput[],
    translations: ActionInstructionInputTranslation[] | undefined
  ): boolean {
    return Object.entries(values).every(([key, value]) => {
      if (
        value === null ||
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && !value.length)
      )
        return true;
      const input = inputs.find((item) => item?.key === key);
      const translation = getInputTranslation(translations, key);
      if (
        !input ||
        !isNonEmptyString(input.title) ||
        (needsTranslation && !isNonEmptyString(translation?.title))
      )
        return false;
      const items = Array.isArray(value) ? value : [value];
      if (input.type === "repeater") {
        return items.every(
          (row) =>
            isRecord(row) && covered(row, input.repeaterFields ?? [], translation?.repeaterFields)
        );
      }
      return items.every((item) => {
        if (item === null || item === undefined || item === "") return true;
        if (typeof item === "object") return false;
        const choices = input.type === "band" ? input.bands : input.options;
        if (!choices?.length)
          return input.type !== "select" && input.type !== "multi-select" && input.type !== "band";
        const option = String(item);
        const labels = input.type === "band" ? translation?.bands : translation?.options;
        return (
          choices.includes(option) && (!needsTranslation || isNonEmptyString(labels?.[option]))
        );
      });
    });
  }

  if (!covered(details, inputs, translations)) return null;
  return needsTranslation ? localizeInputs(inputs, translations) : inputs;
}
