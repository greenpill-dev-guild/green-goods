import {
  ACTION_TRANSLATION_LOCALES,
  type ActionInstructionConfig,
  type ActionInstructionInputTranslation,
  type ActionInstructionTranslationData,
  type ActionTranslationLocale,
  type ActionTranslationMap,
  type ActionTranslationRecord,
  browserTranslator,
  cn,
  createActionTranslationDraft,
  getActionSourceHash,
  hasActionTranslationContent,
  hasCompleteActionTranslationContent,
  markStaleActionTranslations,
  normalizeActionTranslations,
  Textarea,
  type WorkInput,
} from "@green-goods/shared";
import { RiCheckboxCircleLine, RiRefreshLine, RiTranslate2 } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminTextField } from "@/components/AdminTextField";

interface ActionTranslationEditorProps {
  sourceTitle: string;
  sourceConfig: ActionInstructionConfig;
  value: ActionTranslationMap | undefined;
  onChange: (translations: ActionTranslationMap) => void;
}

type TranslationScope = "media" | "details" | "review";

const LOCALE_LABELS: Record<ActionTranslationLocale, { id: string; defaultMessage: string }> = {
  es: { id: "app.admin.actions.translations.spanish", defaultMessage: "Spanish" },
  pt: { id: "app.admin.actions.translations.portuguese", defaultMessage: "Portuguese" },
};

function createEmptyRecord(sourceHash: string): ActionTranslationRecord {
  return {
    status: "draft",
    sourceHash,
    updatedAt: new Date().toISOString(),
    data: {},
  };
}

function updateScope(
  data: ActionInstructionTranslationData,
  scope: TranslationScope,
  updater: (
    scopeData: NonNullable<NonNullable<ActionInstructionTranslationData["uiConfig"]>[typeof scope]>
  ) => NonNullable<NonNullable<ActionInstructionTranslationData["uiConfig"]>[typeof scope]>
): ActionInstructionTranslationData {
  return {
    ...data,
    uiConfig: {
      ...data.uiConfig,
      [scope]: updater((data.uiConfig?.[scope] ?? {}) as never),
    },
  };
}

function updateStringArray(value: string[] | undefined, index: number, nextValue: string) {
  const next = [...(value ?? [])];
  next[index] = nextValue;
  return next;
}

function getInputTranslation(
  inputs: ActionInstructionInputTranslation[] | undefined,
  path: string[]
): ActionInstructionInputTranslation | undefined {
  const [key, ...rest] = path;
  const current = inputs?.find((input) => input.key === key);
  if (!current || rest.length === 0) return current;
  return getInputTranslation(current.repeaterFields, rest);
}

function upsertInputTranslation(
  inputs: ActionInstructionInputTranslation[] | undefined,
  path: string[],
  updater: (input: ActionInstructionInputTranslation) => ActionInstructionInputTranslation
): ActionInstructionInputTranslation[] {
  const [key, ...rest] = path;
  const currentInputs = inputs ?? [];
  const existingIndex = currentInputs.findIndex((input) => input.key === key);
  const existing = existingIndex >= 0 ? currentInputs[existingIndex] : { key };
  const next =
    rest.length === 0
      ? updater(existing)
      : {
          ...existing,
          repeaterFields: upsertInputTranslation(existing.repeaterFields, rest, updater),
        };

  if (existingIndex >= 0) {
    return currentInputs.map((input, index) => (index === existingIndex ? next : input));
  }
  return [...currentInputs, next];
}

function updateOptionLabel(
  input: ActionInstructionInputTranslation,
  kind: "options" | "bands",
  value: string,
  label: string
) {
  return {
    ...input,
    [kind]: {
      ...(input[kind] ?? {}),
      [value]: label,
    },
  };
}

interface TextControlProps {
  id: string;
  label: string;
  source: string;
  value: string | undefined;
  onChange: (value: string) => void;
  multiline?: boolean;
}

function TranslationTextControl({
  id,
  label,
  source,
  value,
  onChange,
  multiline = false,
}: TextControlProps) {
  const { formatMessage } = useIntl();
  const sourceLabel = formatMessage({
    id: "app.admin.actions.translations.englishSource",
    defaultMessage: "English source",
  });

  if (!multiline) {
    return (
      <AdminTextField
        id={id}
        label={label}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        helperText={`${sourceLabel}: ${source}`}
        variant="outlined"
      />
    );
  }

  return (
    <label className="flex flex-col gap-1" htmlFor={id}>
      <span className="text-label-md font-medium text-[rgb(var(--m3-on-surface))]">{label}</span>
      <Textarea
        surface="admin"
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        rows={3}
        className="min-h-24"
      />
      <span className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
        {sourceLabel}: {source}
      </span>
    </label>
  );
}

function getStatusLabel(
  record: ActionTranslationRecord | undefined,
  formatMessage: ReturnType<typeof useIntl>["formatMessage"]
) {
  if (!record) {
    return formatMessage({
      id: "app.admin.actions.translations.statusMissing",
      defaultMessage: "Missing",
    });
  }
  if (!hasActionTranslationContent(record.data)) {
    return formatMessage({
      id: "app.admin.actions.translations.statusMissing",
      defaultMessage: "Missing",
    });
  }
  if (record.status === "reviewed") {
    return formatMessage({
      id: "app.admin.actions.translations.statusReviewed",
      defaultMessage: "Reviewed",
    });
  }
  if (record.status === "stale") {
    return formatMessage({
      id: "app.admin.actions.translations.statusStale",
      defaultMessage: "Stale",
    });
  }
  return formatMessage({
    id: "app.admin.actions.translations.statusDraft",
    defaultMessage: "Draft",
  });
}

export function ActionTranslationEditor({
  sourceTitle,
  sourceConfig,
  value,
  onChange,
}: ActionTranslationEditorProps) {
  const { formatMessage } = useIntl();
  const [activeLocale, setActiveLocale] = useState<ActionTranslationLocale>("es");
  const [generatingLocale, setGeneratingLocale] = useState<ActionTranslationLocale | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const currentSourceHash = useMemo(
    () => getActionSourceHash(sourceTitle, sourceConfig),
    [sourceConfig, sourceTitle]
  );
  const translations = useMemo(
    () =>
      markStaleActionTranslations(sourceTitle, sourceConfig, normalizeActionTranslations(value)),
    [sourceConfig, sourceTitle, value]
  );
  const activeRecord = translations[activeLocale];
  const activeData = activeRecord?.data ?? {};
  const activeInputTranslations = activeData.uiConfig?.details?.inputs;
  const hasUnreviewedTranslations = ACTION_TRANSLATION_LOCALES.some((locale) => {
    const record = translations[locale];
    return (
      record?.status !== "reviewed" ||
      !hasActionTranslationContent(record.data) ||
      !hasCompleteActionTranslationContent(sourceTitle, sourceConfig, record.data)
    );
  });

  const updateActiveRecord = (
    updater: (record: ActionTranslationRecord) => ActionTranslationRecord
  ) => {
    const nextRecord = updater(activeRecord ?? createEmptyRecord(currentSourceHash));
    onChange({
      ...translations,
      [activeLocale]: {
        ...nextRecord,
        sourceHash: currentSourceHash,
        updatedAt: new Date().toISOString(),
      },
    });
  };

  const updateActiveData = (
    updater: (data: ActionInstructionTranslationData) => ActionInstructionTranslationData
  ) => {
    setMessage(null);
    updateActiveRecord((record) => ({
      ...record,
      status: "draft",
      data: updater(record.data),
    }));
  };

  const updateTopLevel = (key: "title" | "description", nextValue: string) => {
    updateActiveData((data) => ({ ...data, [key]: nextValue }));
  };

  const updateScopedField = (
    scope: TranslationScope,
    key: string,
    nextValue: string | string[]
  ) => {
    updateActiveData((data) =>
      updateScope(data, scope, (scopeData) => ({
        ...scopeData,
        [key]: nextValue,
      }))
    );
  };

  const updateInputField = (
    path: string[],
    updater: (input: ActionInstructionInputTranslation) => ActionInstructionInputTranslation
  ) => {
    updateActiveData((data) =>
      updateScope(data, "details", (details) => ({
        ...details,
        inputs: upsertInputTranslation(details.inputs, path, updater),
      }))
    );
  };

  const handleGenerateDraft = async () => {
    setMessage(null);
    if (!browserTranslator.isSupported) {
      setMessage(
        formatMessage({
          id: "app.admin.actions.translations.browserUnavailable",
          defaultMessage:
            "Browser translation is not available here. You can still enter translations manually.",
        })
      );
      return;
    }

    setGeneratingLocale(activeLocale);
    try {
      const draft = await createActionTranslationDraft(
        sourceTitle,
        sourceConfig,
        activeLocale,
        (text, targetLocale, sourceLocale) =>
          browserTranslator.translate(text, targetLocale, sourceLocale)
      );
      onChange({ ...translations, [activeLocale]: draft });
      setMessage(
        formatMessage({
          id: "app.admin.actions.translations.generatedDraft",
          defaultMessage: "Draft generated. Review it before publishing.",
        })
      );
    } catch {
      setMessage(
        formatMessage({
          id: "app.admin.actions.translations.generationFailed",
          defaultMessage: "Draft generation failed. You can still enter translations manually.",
        })
      );
    } finally {
      setGeneratingLocale(null);
    }
  };

  const markReviewed = () => {
    if (!hasActionTranslationContent(activeData)) {
      setMessage(
        formatMessage({
          id: "app.admin.actions.translations.reviewNeedsContent",
          defaultMessage: "Add translation text before marking this locale reviewed.",
        })
      );
      return;
    }

    setMessage(null);
    updateActiveRecord((record) => ({
      ...record,
      status: "reviewed",
      sourceHash: currentSourceHash,
    }));
  };

  const markDraft = () => {
    updateActiveRecord((record) => ({
      ...record,
      status: "draft",
      sourceHash: currentSourceHash,
    }));
  };

  const renderInputControls = (input: WorkInput, path: string[], depth = 0) => {
    const inputTranslation = getInputTranslation(activeInputTranslations, path);
    const prefix = path.join(".");

    return (
      <div
        key={prefix}
        className={cn(
          "space-y-3 border-l border-[rgb(var(--m3-outline-variant))] pl-3",
          depth > 0 && "ml-3"
        )}
      >
        <div>
          <p className="text-label-md font-semibold text-[rgb(var(--m3-on-surface))]">
            {input.title}
          </p>
          <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {input.key} / {input.type}
          </p>
        </div>
        <TranslationTextControl
          id={`${activeLocale}-${prefix}-title`}
          label={formatMessage({
            id: "app.admin.actions.translations.fieldLabel",
            defaultMessage: "Field label",
          })}
          source={input.title}
          value={inputTranslation?.title}
          onChange={(nextValue) =>
            updateInputField(path, (translation) => ({ ...translation, title: nextValue }))
          }
        />
        <TranslationTextControl
          id={`${activeLocale}-${prefix}-placeholder`}
          label={formatMessage({
            id: "app.admin.actions.translations.fieldPlaceholder",
            defaultMessage: "Field placeholder",
          })}
          source={input.placeholder}
          value={inputTranslation?.placeholder}
          onChange={(nextValue) =>
            updateInputField(path, (translation) => ({
              ...translation,
              placeholder: nextValue,
            }))
          }
        />

        {input.options.map((option) => (
          <TranslationTextControl
            key={`${prefix}-option-${option}`}
            id={`${activeLocale}-${prefix}-option-${option}`}
            label={formatMessage(
              {
                id: "app.admin.actions.translations.optionLabel",
                defaultMessage: "Option label: {value}",
              },
              { value: option }
            )}
            source={option}
            value={inputTranslation?.options?.[option]}
            onChange={(nextValue) =>
              updateInputField(path, (translation) =>
                updateOptionLabel(translation, "options", option, nextValue)
              )
            }
          />
        ))}

        {(input.bands ?? []).map((band) => (
          <TranslationTextControl
            key={`${prefix}-band-${band}`}
            id={`${activeLocale}-${prefix}-band-${band}`}
            label={formatMessage(
              {
                id: "app.admin.actions.translations.bandLabel",
                defaultMessage: "Band label: {value}",
              },
              { value: band }
            )}
            source={band}
            value={inputTranslation?.bands?.[band]}
            onChange={(nextValue) =>
              updateInputField(path, (translation) =>
                updateOptionLabel(translation, "bands", band, nextValue)
              )
            }
          />
        ))}

        {input.repeaterFields?.map((field) =>
          renderInputControls(field, [...path, field.key], depth + 1)
        )}
      </div>
    );
  };

  return (
    <section className="mt-6 space-y-4 rounded-[var(--m3-shape-sm)] border border-[rgb(var(--m3-outline-variant))] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <RiTranslate2 className="h-4 w-4 text-[rgb(var(--m3-on-surface-variant))]" />
            <h3 className="text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
              {formatMessage({
                id: "app.admin.actions.translations.title",
                defaultMessage: "Translations",
              })}
            </h3>
          </div>
          <p className="mt-1 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {formatMessage({
              id: "app.admin.actions.translations.description",
              defaultMessage:
                "English remains canonical. Reviewed locale text is used at runtime; missing fields fall back to English.",
            })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {ACTION_TRANSLATION_LOCALES.map((locale) => {
            const selected = locale === activeLocale;
            const record = translations[locale];
            return (
              <button
                key={locale}
                type="button"
                onClick={() => setActiveLocale(locale)}
                className={cn(
                  "rounded-[var(--m3-shape-full)] border px-3 py-1.5 text-label-md",
                  selected
                    ? "border-[rgb(var(--m3-primary))] bg-[rgb(var(--m3-primary-container))] text-[rgb(var(--m3-on-primary-container))]"
                    : "border-[rgb(var(--m3-outline-variant))] text-[rgb(var(--m3-on-surface-variant))]"
                )}
              >
                {formatMessage(LOCALE_LABELS[locale])} · {getStatusLabel(record, formatMessage)}
              </button>
            );
          })}
        </div>
      </div>

      {hasUnreviewedTranslations ? (
        <p className="rounded-[var(--m3-shape-xs)] bg-[rgb(var(--m3-tertiary-container))] px-3 py-2 text-body-sm text-[rgb(var(--m3-on-tertiary-container))]">
          {formatMessage({
            id: "app.admin.actions.translations.publishWarning",
            defaultMessage:
              "Publishing can continue with missing, draft, or stale translations. Runtime display will fall back to English for those fields.",
          })}
        </p>
      ) : null}

      {activeRecord?.status === "stale" ? (
        <p className="rounded-[var(--m3-shape-xs)] bg-[rgb(var(--m3-error-container))] px-3 py-2 text-body-sm text-[rgb(var(--m3-on-error-container))]">
          {formatMessage({
            id: "app.admin.actions.translations.sourceChanged",
            defaultMessage:
              "The English source changed after this locale was reviewed. Regenerate or review it again before relying on it.",
          })}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <AdminButton
          type="button"
          variant="outlined"
          size="sm"
          loading={generatingLocale === activeLocale}
          leadingIcon={<RiRefreshLine />}
          onClick={() => {
            void handleGenerateDraft();
          }}
        >
          {formatMessage({
            id: "app.admin.actions.translations.generateDraft",
            defaultMessage: "Generate draft",
          })}
        </AdminButton>
        <AdminButton
          type="button"
          variant="tonal"
          size="sm"
          leadingIcon={<RiCheckboxCircleLine />}
          onClick={markReviewed}
        >
          {formatMessage({
            id: "app.admin.actions.translations.markReviewed",
            defaultMessage: "Mark reviewed",
          })}
        </AdminButton>
        <AdminButton type="button" variant="text" size="sm" onClick={markDraft}>
          {formatMessage({
            id: "app.admin.actions.translations.markDraft",
            defaultMessage: "Mark draft",
          })}
        </AdminButton>
      </div>

      {message ? (
        <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">{message}</p>
      ) : null}

      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TranslationTextControl
            id={`${activeLocale}-action-title`}
            label={formatMessage({
              id: "app.admin.actions.translations.actionTitle",
              defaultMessage: "Action title",
            })}
            source={sourceTitle}
            value={activeData.title}
            onChange={(nextValue) => updateTopLevel("title", nextValue)}
          />
          <TranslationTextControl
            id={`${activeLocale}-action-description`}
            label={formatMessage({
              id: "app.admin.actions.translations.actionDescription",
              defaultMessage: "Action description",
            })}
            source={sourceConfig.description}
            value={activeData.description}
            onChange={(nextValue) => updateTopLevel("description", nextValue)}
            multiline
          />
        </div>

        <div className="space-y-3">
          <h4 className="text-label-lg font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "app.admin.actions.translations.mediaSection",
              defaultMessage: "Media guidance",
            })}
          </h4>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TranslationTextControl
              id={`${activeLocale}-media-title`}
              label={formatMessage({
                id: "app.admin.actions.translations.sectionTitle",
                defaultMessage: "Section title",
              })}
              source={sourceConfig.uiConfig.media.title}
              value={activeData.uiConfig?.media?.title}
              onChange={(nextValue) => updateScopedField("media", "title", nextValue)}
            />
            <TranslationTextControl
              id={`${activeLocale}-media-description`}
              label={formatMessage({
                id: "app.admin.actions.translations.sectionDescription",
                defaultMessage: "Section description",
              })}
              source={sourceConfig.uiConfig.media.description}
              value={activeData.uiConfig?.media?.description}
              onChange={(nextValue) => updateScopedField("media", "description", nextValue)}
              multiline
            />
          </div>
          {sourceConfig.uiConfig.media.needed.map((item, index) => (
            <TranslationTextControl
              key={`needed-${index}`}
              id={`${activeLocale}-media-needed-${index}`}
              label={formatMessage(
                {
                  id: "app.admin.actions.translations.mediaNeeded",
                  defaultMessage: "Needed item {index}",
                },
                { index: index + 1 }
              )}
              source={item}
              value={activeData.uiConfig?.media?.needed?.[index]}
              onChange={(nextValue) =>
                updateScopedField(
                  "media",
                  "needed",
                  updateStringArray(activeData.uiConfig?.media?.needed, index, nextValue)
                )
              }
            />
          ))}
          {sourceConfig.uiConfig.media.optional.map((item, index) => (
            <TranslationTextControl
              key={`optional-${index}`}
              id={`${activeLocale}-media-optional-${index}`}
              label={formatMessage(
                {
                  id: "app.admin.actions.translations.mediaOptional",
                  defaultMessage: "Optional item {index}",
                },
                { index: index + 1 }
              )}
              source={item}
              value={activeData.uiConfig?.media?.optional?.[index]}
              onChange={(nextValue) =>
                updateScopedField(
                  "media",
                  "optional",
                  updateStringArray(activeData.uiConfig?.media?.optional, index, nextValue)
                )
              }
            />
          ))}
        </div>

        <div className="space-y-3">
          <h4 className="text-label-lg font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "app.admin.actions.translations.detailsSection",
              defaultMessage: "Details form",
            })}
          </h4>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TranslationTextControl
              id={`${activeLocale}-details-title`}
              label={formatMessage({
                id: "app.admin.actions.translations.sectionTitle",
                defaultMessage: "Section title",
              })}
              source={sourceConfig.uiConfig.details.title}
              value={activeData.uiConfig?.details?.title}
              onChange={(nextValue) => updateScopedField("details", "title", nextValue)}
            />
            <TranslationTextControl
              id={`${activeLocale}-details-description`}
              label={formatMessage({
                id: "app.admin.actions.translations.sectionDescription",
                defaultMessage: "Section description",
              })}
              source={sourceConfig.uiConfig.details.description}
              value={activeData.uiConfig?.details?.description}
              onChange={(nextValue) => updateScopedField("details", "description", nextValue)}
              multiline
            />
            <TranslationTextControl
              id={`${activeLocale}-details-feedback`}
              label={formatMessage({
                id: "app.admin.actions.translations.feedbackPlaceholder",
                defaultMessage: "Feedback placeholder",
              })}
              source={sourceConfig.uiConfig.details.feedbackPlaceholder}
              value={activeData.uiConfig?.details?.feedbackPlaceholder}
              onChange={(nextValue) =>
                updateScopedField("details", "feedbackPlaceholder", nextValue)
              }
            />
          </div>
          <div className="space-y-4">
            {sourceConfig.uiConfig.details.inputs.map((input) =>
              renderInputControls(input, [input.key])
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-label-lg font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "app.admin.actions.translations.reviewSection",
              defaultMessage: "Review copy",
            })}
          </h4>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TranslationTextControl
              id={`${activeLocale}-review-title`}
              label={formatMessage({
                id: "app.admin.actions.translations.sectionTitle",
                defaultMessage: "Section title",
              })}
              source={sourceConfig.uiConfig.review.title}
              value={activeData.uiConfig?.review?.title}
              onChange={(nextValue) => updateScopedField("review", "title", nextValue)}
            />
            <TranslationTextControl
              id={`${activeLocale}-review-description`}
              label={formatMessage({
                id: "app.admin.actions.translations.sectionDescription",
                defaultMessage: "Section description",
              })}
              source={sourceConfig.uiConfig.review.description}
              value={activeData.uiConfig?.review?.description}
              onChange={(nextValue) => updateScopedField("review", "description", nextValue)}
              multiline
            />
          </div>
        </div>
      </div>
    </section>
  );
}
