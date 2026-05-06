import type {
  Action,
  ActionContentLocale,
  ActionInstructionConfig,
  ActionInstructionConfigV2,
  ActionInstructionInputTranslation,
  ActionInstructionTranslationData,
  ActionTranslationLocale,
  ActionTranslationMap,
  ActionTranslationRecord,
  WorkInput,
} from "../../types/domain";

export const ACTION_INSTRUCTIONS_SCHEMA_VERSION = "action_instructions_v2" as const;
export const DEFAULT_ACTION_CONTENT_LOCALE: ActionContentLocale = "en";
export const ACTION_TRANSLATION_LOCALES = [
  "es",
  "pt",
] as const satisfies readonly ActionTranslationLocale[];

type TranslateText = (
  text: string,
  targetLocale: ActionTranslationLocale,
  sourceLocale: ActionContentLocale
) => Promise<string | null>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function sourceFingerprint(title: string, config: ActionInstructionConfig) {
  return stableStringify({
    title,
    description: config.description,
    uiConfig: {
      media: {
        title: config.uiConfig.media.title,
        description: config.uiConfig.media.description,
        needed: config.uiConfig.media.needed,
        optional: config.uiConfig.media.optional,
      },
      details: {
        title: config.uiConfig.details.title,
        description: config.uiConfig.details.description,
        feedbackPlaceholder: config.uiConfig.details.feedbackPlaceholder,
        inputs: config.uiConfig.details.inputs.map(inputSourceFingerprint),
      },
      review: {
        title: config.uiConfig.review.title,
        description: config.uiConfig.review.description,
      },
    },
  });
}

function inputSourceFingerprint(input: WorkInput): unknown {
  return {
    key: input.key,
    title: input.title,
    placeholder: input.placeholder,
    options: input.options,
    bands: input.bands,
    repeaterFields: input.repeaterFields?.map(inputSourceFingerprint),
  };
}

export function getActionSourceHash(title: string, config: ActionInstructionConfig): string {
  return hashString(sourceFingerprint(title, config));
}

export function isActionTranslationLocale(value: unknown): value is ActionTranslationLocale {
  return ACTION_TRANSLATION_LOCALES.includes(value as ActionTranslationLocale);
}

function normalizeTranslationInput(value: unknown): ActionInstructionInputTranslation | null {
  if (!isRecord(value) || !isNonEmptyString(value.key)) return null;

  const record: ActionInstructionInputTranslation = { key: value.key };
  if (typeof value.title === "string") record.title = value.title;
  if (typeof value.placeholder === "string") record.placeholder = value.placeholder;
  if (isRecord(value.options)) {
    record.options = Object.fromEntries(
      Object.entries(value.options).filter((entry): entry is [string, string] => {
        return typeof entry[1] === "string";
      })
    );
  }
  if (isRecord(value.bands)) {
    record.bands = Object.fromEntries(
      Object.entries(value.bands).filter((entry): entry is [string, string] => {
        return typeof entry[1] === "string";
      })
    );
  }
  if (Array.isArray(value.repeaterFields)) {
    const fields = value.repeaterFields
      .map(normalizeTranslationInput)
      .filter((item): item is ActionInstructionInputTranslation => item !== null);
    if (fields.length > 0) record.repeaterFields = fields;
  }
  return record;
}

function normalizeTranslationData(value: unknown): ActionInstructionTranslationData {
  if (!isRecord(value)) return {};
  const data: ActionInstructionTranslationData = {};

  if (typeof value.title === "string") data.title = value.title;
  if (typeof value.description === "string") data.description = value.description;

  const uiConfig = isRecord(value.uiConfig) ? value.uiConfig : undefined;
  const media = isRecord(uiConfig?.media) ? uiConfig.media : undefined;
  const details = isRecord(uiConfig?.details) ? uiConfig.details : undefined;
  const review = isRecord(uiConfig?.review) ? uiConfig.review : undefined;

  if (media || details || review) {
    data.uiConfig = {};
  }
  if (media && data.uiConfig) {
    data.uiConfig.media = {};
    if (typeof media.title === "string") data.uiConfig.media.title = media.title;
    if (typeof media.description === "string") data.uiConfig.media.description = media.description;
    if (Array.isArray(media.needed)) {
      data.uiConfig.media.needed = media.needed.filter(
        (item): item is string => typeof item === "string"
      );
    }
    if (Array.isArray(media.optional)) {
      data.uiConfig.media.optional = media.optional.filter(
        (item): item is string => typeof item === "string"
      );
    }
  }
  if (details && data.uiConfig) {
    data.uiConfig.details = {};
    if (typeof details.title === "string") data.uiConfig.details.title = details.title;
    if (typeof details.description === "string") {
      data.uiConfig.details.description = details.description;
    }
    if (typeof details.feedbackPlaceholder === "string") {
      data.uiConfig.details.feedbackPlaceholder = details.feedbackPlaceholder;
    }
    if (Array.isArray(details.inputs)) {
      data.uiConfig.details.inputs = details.inputs
        .map(normalizeTranslationInput)
        .filter((item): item is ActionInstructionInputTranslation => item !== null);
    }
  }
  if (review && data.uiConfig) {
    data.uiConfig.review = {};
    if (typeof review.title === "string") data.uiConfig.review.title = review.title;
    if (typeof review.description === "string")
      data.uiConfig.review.description = review.description;
  }

  return data;
}

export function normalizeActionTranslations(value: unknown): ActionTranslationMap {
  if (!isRecord(value)) return {};

  const translations: ActionTranslationMap = {};
  for (const locale of ACTION_TRANSLATION_LOCALES) {
    const candidate = value[locale];
    if (!isRecord(candidate)) continue;
    const status =
      candidate.status === "reviewed" || candidate.status === "stale" ? candidate.status : "draft";
    translations[locale] = {
      status,
      sourceHash: typeof candidate.sourceHash === "string" ? candidate.sourceHash : undefined,
      updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined,
      data: normalizeTranslationData(candidate.data),
    };
  }
  return translations;
}

function hasTranslatedString(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTranslatedArray(value: string[] | undefined): boolean {
  return Array.isArray(value) && value.some(hasTranslatedString);
}

function hasTranslatedMap(value: Record<string, string> | undefined): boolean {
  return Boolean(value && Object.values(value).some(hasTranslatedString));
}

function hasInputTranslationContent(input: ActionInstructionInputTranslation): boolean {
  return (
    hasTranslatedString(input.title) ||
    hasTranslatedString(input.placeholder) ||
    hasTranslatedMap(input.options) ||
    hasTranslatedMap(input.bands) ||
    Boolean(input.repeaterFields?.some(hasInputTranslationContent))
  );
}

export function hasActionTranslationContent(
  data: ActionInstructionTranslationData | undefined
): boolean {
  if (!data) return false;
  const media = data.uiConfig?.media;
  const details = data.uiConfig?.details;
  const review = data.uiConfig?.review;

  return (
    hasTranslatedString(data.title) ||
    hasTranslatedString(data.description) ||
    hasTranslatedString(media?.title) ||
    hasTranslatedString(media?.description) ||
    hasTranslatedArray(media?.needed) ||
    hasTranslatedArray(media?.optional) ||
    hasTranslatedString(details?.title) ||
    hasTranslatedString(details?.description) ||
    hasTranslatedString(details?.feedbackPlaceholder) ||
    Boolean(details?.inputs?.some(hasInputTranslationContent)) ||
    hasTranslatedString(review?.title) ||
    hasTranslatedString(review?.description)
  );
}

function sourceNeedsTranslation(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTranslationForSource(source: string | undefined, translated: string | undefined) {
  return !sourceNeedsTranslation(source) || hasTranslatedString(translated);
}

function hasTranslatedArrayForSource(
  source: string[] | undefined,
  translated: string[] | undefined
) {
  return (
    !source ||
    source.every(
      (item, index) => !sourceNeedsTranslation(item) || hasTranslatedString(translated?.[index])
    )
  );
}

function hasTranslatedMapForSource(
  source: string[] | undefined,
  translated: Record<string, string> | undefined
) {
  return (
    !source ||
    source.every((item) => !sourceNeedsTranslation(item) || hasTranslatedString(translated?.[item]))
  );
}

function getInputTranslationByKey(
  translations: ActionInstructionInputTranslation[] | undefined,
  key: string
) {
  return translations?.find((translation) => translation.key === key);
}

function hasCompleteInputTranslationContent(
  input: WorkInput,
  translation: ActionInstructionInputTranslation | undefined
): boolean {
  return (
    hasTranslationForSource(input.title, translation?.title) &&
    hasTranslationForSource(input.placeholder, translation?.placeholder) &&
    hasTranslatedMapForSource(input.options, translation?.options) &&
    hasTranslatedMapForSource(input.bands, translation?.bands) &&
    (!input.repeaterFields ||
      input.repeaterFields.every((field) =>
        hasCompleteInputTranslationContent(
          field,
          getInputTranslationByKey(translation?.repeaterFields, field.key)
        )
      ))
  );
}

export function hasCompleteActionTranslationContent(
  title: string,
  config: ActionInstructionConfig,
  data: ActionInstructionTranslationData | undefined
): boolean {
  const media = data?.uiConfig?.media;
  const details = data?.uiConfig?.details;
  const review = data?.uiConfig?.review;

  return (
    hasTranslationForSource(title, data?.title) &&
    hasTranslationForSource(config.description, data?.description) &&
    hasTranslationForSource(config.uiConfig.media.title, media?.title) &&
    hasTranslationForSource(config.uiConfig.media.description, media?.description) &&
    hasTranslatedArrayForSource(config.uiConfig.media.needed, media?.needed) &&
    hasTranslatedArrayForSource(config.uiConfig.media.optional, media?.optional) &&
    hasTranslationForSource(config.uiConfig.details.title, details?.title) &&
    hasTranslationForSource(config.uiConfig.details.description, details?.description) &&
    hasTranslationForSource(
      config.uiConfig.details.feedbackPlaceholder,
      details?.feedbackPlaceholder
    ) &&
    config.uiConfig.details.inputs.every((input) =>
      hasCompleteInputTranslationContent(
        input,
        getInputTranslationByKey(details?.inputs, input.key)
      )
    ) &&
    hasTranslationForSource(config.uiConfig.review.title, review?.title) &&
    hasTranslationForSource(config.uiConfig.review.description, review?.description)
  );
}

export function markStaleActionTranslations(
  title: string,
  config: ActionInstructionConfig,
  translations: ActionTranslationMap = {}
): ActionTranslationMap {
  const sourceHash = getActionSourceHash(title, config);
  const next: ActionTranslationMap = {};

  for (const locale of ACTION_TRANSLATION_LOCALES) {
    const record = translations[locale];
    if (!record) continue;
    next[locale] =
      record.sourceHash && record.sourceHash !== sourceHash
        ? { ...record, status: "stale" }
        : record;
  }
  return next;
}

export function buildActionInstructionsV2(
  title: string,
  config: ActionInstructionConfig,
  translations: ActionTranslationMap = {}
): ActionInstructionConfigV2 {
  const normalizedTranslations = markStaleActionTranslations(title, config, translations);
  return {
    ...config,
    schemaVersion: ACTION_INSTRUCTIONS_SCHEMA_VERSION,
    defaultLocale: DEFAULT_ACTION_CONTENT_LOCALE,
    translations: normalizedTranslations,
  };
}

export function getReviewedActionTranslation(
  translations: ActionTranslationMap | undefined,
  locale: string | undefined
): ActionTranslationRecord | null {
  if (!isActionTranslationLocale(locale)) return null;
  const record = translations?.[locale];
  return record?.status === "reviewed" && hasActionTranslationContent(record.data) ? record : null;
}

function getInputTranslation(
  translations: ActionInstructionInputTranslation[] | undefined,
  key: string
) {
  return translations?.find((translation) => translation.key === key);
}

function localizeInputs(
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

function applyArrayFallback(source: string[] | undefined, translated: string[] | undefined) {
  if (!source) return undefined;
  return source.map((item, index) => translated?.[index] || item);
}

export function localizeAction(action: Action, locale: string | undefined): Action {
  const translation = getReviewedActionTranslation(action.translations, locale);
  if (!translation) return action;

  const data = translation.data;
  const media = data.uiConfig?.media;
  const details = data.uiConfig?.details;
  const review = data.uiConfig?.review;

  return {
    ...action,
    title: data.title || action.title,
    description: data.description || action.description,
    mediaInfo: action.mediaInfo
      ? {
          ...action.mediaInfo,
          title: media?.title || action.mediaInfo.title,
          description: media?.description || action.mediaInfo.description,
          needed: applyArrayFallback(action.mediaInfo.needed, media?.needed),
          optional: applyArrayFallback(action.mediaInfo.optional, media?.optional),
        }
      : action.mediaInfo,
    details: action.details
      ? {
          ...action.details,
          title: details?.title || action.details.title,
          description: details?.description || action.details.description,
          feedbackPlaceholder: details?.feedbackPlaceholder || action.details.feedbackPlaceholder,
        }
      : action.details,
    review: action.review
      ? {
          ...action.review,
          title: review?.title || action.review.title,
          description: review?.description || action.review.description,
        }
      : action.review,
    inputs: localizeInputs(action.inputs, details?.inputs),
  };
}

async function translateMaybe(
  value: string | undefined,
  locale: ActionTranslationLocale,
  translateText: TranslateText
) {
  if (!value) return value;
  return (await translateText(value, locale, DEFAULT_ACTION_CONTENT_LOCALE)) || value;
}

async function translateString(
  value: string,
  locale: ActionTranslationLocale,
  translateText: TranslateText
) {
  return (await translateText(value, locale, DEFAULT_ACTION_CONTENT_LOCALE)) || value;
}

async function translateInput(
  input: WorkInput,
  locale: ActionTranslationLocale,
  translateText: TranslateText
): Promise<ActionInstructionInputTranslation> {
  const translated: ActionInstructionInputTranslation = {
    key: input.key,
    title: await translateMaybe(input.title, locale, translateText),
    placeholder: await translateMaybe(input.placeholder, locale, translateText),
  };

  if (input.options.length > 0) {
    translated.options = {};
    for (const option of input.options) {
      translated.options[option] = await translateString(option, locale, translateText);
    }
  }

  if (input.bands && input.bands.length > 0) {
    translated.bands = {};
    for (const band of input.bands) {
      translated.bands[band] = await translateString(band, locale, translateText);
    }
  }

  if (input.repeaterFields && input.repeaterFields.length > 0) {
    translated.repeaterFields = [];
    for (const field of input.repeaterFields) {
      translated.repeaterFields.push(await translateInput(field, locale, translateText));
    }
  }

  return translated;
}

export async function createActionTranslationDraft(
  title: string,
  config: ActionInstructionConfig,
  locale: ActionTranslationLocale,
  translateText: TranslateText
): Promise<ActionTranslationRecord> {
  const inputs: ActionInstructionInputTranslation[] = [];
  for (const input of config.uiConfig.details.inputs) {
    inputs.push(await translateInput(input, locale, translateText));
  }

  return {
    status: "draft",
    sourceHash: getActionSourceHash(title, config),
    updatedAt: new Date().toISOString(),
    data: {
      title: await translateMaybe(title, locale, translateText),
      description: await translateMaybe(config.description, locale, translateText),
      uiConfig: {
        media: {
          title: await translateMaybe(config.uiConfig.media.title, locale, translateText),
          description: await translateMaybe(
            config.uiConfig.media.description,
            locale,
            translateText
          ),
          needed: await Promise.all(
            config.uiConfig.media.needed.map((item) => translateString(item, locale, translateText))
          ),
          optional: await Promise.all(
            config.uiConfig.media.optional.map((item) =>
              translateString(item, locale, translateText)
            )
          ),
        },
        details: {
          title: await translateMaybe(config.uiConfig.details.title, locale, translateText),
          description: await translateMaybe(
            config.uiConfig.details.description,
            locale,
            translateText
          ),
          feedbackPlaceholder: await translateMaybe(
            config.uiConfig.details.feedbackPlaceholder,
            locale,
            translateText
          ),
          inputs,
        },
        review: {
          title: await translateMaybe(config.uiConfig.review.title, locale, translateText),
          description: await translateMaybe(
            config.uiConfig.review.description,
            locale,
            translateText
          ),
        },
      },
    },
  };
}
