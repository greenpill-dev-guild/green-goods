import type { WorkFormData } from "@green-goods/shared/hooks/work/useWorkForm";
import type { Action, WorkInput } from "@green-goods/shared/types/domain";
import { RiAddLine, RiCloseLine, RiFileFill, RiMapPinLine } from "@remixicon/react";
import React, { useCallback, useState } from "react";
import {
  Controller,
  type Control,
  type Path,
  type UseFormRegister,
  type UseFormSetValue,
  useFieldArray,
} from "react-hook-form";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards";

import { FormInput, FormSelect, FormText } from "@/components/Inputs";

interface WorkDetailsProps {
  config?: Action["details"];
  inputs: WorkInput[];
  register: UseFormRegister<WorkFormData>;
  control: Control<WorkFormData>;
  setValue?: UseFormSetValue<WorkFormData>;
}

function getNumberRegisterOptions() {
  return {
    setValueAs: (value: unknown) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isNaN(parsed) ? undefined : parsed;
      }
      return undefined;
    },
  };
}

interface WorkRepeaterInputProps {
  input: WorkInput;
  register: UseFormRegister<WorkFormData>;
  control: Control<WorkFormData>;
  addLabel: string;
  removeLabel: string;
}

const WorkRepeaterInput: React.FC<WorkRepeaterInputProps> = ({
  input,
  register,
  control,
  addLabel,
  removeLabel,
}) => {
  const { fields, append, remove } = useFieldArray({
    control,
    name: input.key as never,
  });
  const childInputs = input.repeaterFields ?? [];

  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-stroke-sub-300 p-3">
      <legend className="px-1 text-sm font-medium text-text-strong-950">
        {input.title}
        {input.required && <span className="text-error-base ml-0.5">*</span>}
      </legend>
      {fields.map((row, index) => (
        <div key={row.id} className="flex flex-col gap-3 rounded-lg bg-bg-weak-50 p-3">
          {childInputs.map((child) => {
            const fieldName = `${input.key}.${index}.${child.key}` as Path<WorkFormData>;
            const options = child.type === "band" ? (child.bands ?? child.options) : child.options;

            if (child.type === "select" || child.type === "band") {
              return (
                <FormSelect
                  key={child.key}
                  name={fieldName}
                  label={child.unit ? `${child.title} (${child.unit})` : child.title}
                  placeholder={child.placeholder}
                  options={options.map((option) => ({
                    label: child.optionLabels?.[option] ?? child.bandLabels?.[option] ?? option,
                    value: option,
                  }))}
                  control={control}
                  isMulti={false}
                  required={child.required}
                />
              );
            }

            if (child.type === "multi-select") {
              return (
                <FormSelect
                  key={child.key}
                  name={fieldName}
                  label={child.title}
                  placeholder={child.placeholder}
                  options={options.map((option) => ({
                    label: child.optionLabels?.[option] ?? option,
                    value: option,
                  }))}
                  control={control}
                  isMulti
                  required={child.required}
                />
              );
            }

            if (child.type === "textarea") {
              return (
                <FormText
                  key={child.key}
                  {...register(fieldName)}
                  label={child.title}
                  placeholder={child.placeholder}
                  required={child.required}
                  rows={3}
                />
              );
            }

            return (
              <FormInput
                key={child.key}
                {...register(
                  fieldName,
                  child.type === "number" ? getNumberRegisterOptions() : undefined
                )}
                label={child.unit ? `${child.title} (${child.unit})` : child.title}
                type={child.type === "number" ? "number" : "text"}
                inputMode={child.type === "number" ? "decimal" : undefined}
                placeholder={child.placeholder}
                required={child.required}
              />
            );
          })}
          <button
            type="button"
            onClick={() => remove(index)}
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg border border-stroke-sub-300 px-3 text-sm font-medium text-text-sub-600"
          >
            <RiCloseLine className="h-4 w-4" aria-hidden="true" />
            {removeLabel}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => append({} as never)}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-stroke-sub-300 px-3 text-sm font-medium text-text-sub-600"
      >
        <RiAddLine className="h-4 w-4" aria-hidden="true" />
        {addLabel}
      </button>
    </fieldset>
  );
};

export const WorkDetails: React.FC<WorkDetailsProps> = ({
  config,
  register,
  control,
  inputs,
  setValue,
}) => {
  const intl = useIntl();
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "success" | "denied">(
    "idle"
  );

  const detailsTitle =
    config?.title ??
    intl.formatMessage({
      id: "app.garden.details.title",
      description: "Enter Details",
    });
  const detailsDescription =
    config?.description ??
    intl.formatMessage({
      id: "app.garden.submit.tab.details.instruction",
      defaultMessage: "Provide detailed information and feedback",
    });
  const feedbackPlaceholder =
    config?.feedbackPlaceholder ??
    intl.formatMessage({
      id: "app.garden.details.feedbackPlaceholder",
      defaultMessage: "Provide feedback or any observations",
    });

  const handleLocationToggle = useCallback(() => {
    if (locationEnabled) {
      setLocationEnabled(false);
      setLocationStatus("idle");
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus("denied");
      return;
    }

    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationEnabled(true);
        setLocationStatus("success");
        // Store location data in form via setValue if available
        if (setValue) {
          setValue("_location" as Path<WorkFormData>, {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
        }
      },
      () => {
        setLocationStatus("denied");
        setLocationEnabled(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, [locationEnabled, setValue]);

  const handleTextareaFocus = useCallback((event: React.FocusEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    requestAnimationFrame(() => {
      target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title={detailsTitle} info={detailsDescription} Icon={RiFileFill} />

      {/* Time Spent Input - Always shown as a default field */}
      <FormInput
        {...register("timeSpentMinutes")}
        label={intl.formatMessage({
          id: "app.garden.details.timeSpent",
          defaultMessage: "Time Spent (hours)",
        })}
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        placeholder={intl.formatMessage({
          id: "app.garden.details.timeSpentPlaceholder",
          defaultMessage: "e.g., 1.5 for 1h 30m",
        })}
        helperText={intl.formatMessage({
          id: "app.garden.details.timeSpentHint",
          defaultMessage: "Enter hours spent on this work (decimals OK)",
        })}
      />

      {inputs.map((input) => {
        if (!input) return null;

        const {
          placeholder = "",
          options = [],
          optionLabels,
          bands,
          bandLabels,
          required = false,
          title = "",
          key,
          type,
          unit,
        } = input;

        const selectOptions = Array.isArray(options) ? options : [];
        const registerOptions = type === "number" ? getNumberRegisterOptions() : undefined;

        // Cast key to Path for dynamic form fields
        const fieldKey = key as Path<WorkFormData>;

        if (type === "number") {
          return (
            <FormInput
              key={key}
              {...register(fieldKey, registerOptions)}
              label={unit ? `${title} (${unit})` : title}
              type="number"
              placeholder={placeholder}
              required={required}
              inputMode="numeric"
            />
          );
        }
        if (type === "select") {
          return (
            <FormSelect
              key={key}
              name={fieldKey}
              label={title}
              placeholder={placeholder}
              options={selectOptions.map((option) => ({
                label: optionLabels?.[option] ?? option,
                value: option,
              }))}
              control={control}
              isMulti={false}
              required={required}
            />
          );
        }
        if (type === "band") {
          // Band fields use a select with predefined ranges
          const bandOptions = bands || selectOptions;
          return (
            <FormSelect
              key={key}
              name={fieldKey}
              label={title}
              placeholder={
                placeholder ||
                intl.formatMessage({
                  id: "app.garden.details.selectRange",
                  defaultMessage: "Select Date Range",
                })
              }
              options={bandOptions.map((band) => ({
                label: bandLabels?.[band] ?? band,
                value: band,
              }))}
              control={control}
              isMulti={false}
              required={required}
            />
          );
        }
        if (type === "multi-select") {
          return (
            <Controller
              key={key}
              name={fieldKey}
              control={control}
              defaultValue={[]}
              render={({ field }) => {
                const selected = Array.isArray(field.value)
                  ? field.value.filter((value): value is string => typeof value === "string")
                  : [];
                return (
                  <fieldset className="flex flex-col gap-1.5">
                    <legend className="text-sm font-medium text-text-strong-950">
                      {title}
                      {required && <span className="text-error-base ml-0.5">*</span>}
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {selectOptions.map((option) => {
                        const isSelected = selected.includes(option);
                        const label = optionLabels?.[option] ?? option;
                        return (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() =>
                              field.onChange(
                                isSelected
                                  ? selected.filter((value) => value !== option)
                                  : [...selected, option]
                              )
                            }
                            className={`min-h-11 px-3 py-2.5 rounded-full text-sm font-medium transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] border ${
                              isSelected
                                ? "bg-primary-base text-primary-accent-foreground border-primary-base"
                                : "bg-bg-weak-50 text-text-sub-600 border-stroke-sub-300 hover:bg-bg-soft-200"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              }}
            />
          );
        }
        if (type === "repeater") {
          return (
            <WorkRepeaterInput
              key={key}
              input={input}
              register={register}
              control={control}
              addLabel={intl.formatMessage({ id: "app.common.add", defaultMessage: "Add" })}
              removeLabel={intl.formatMessage({
                id: "app.common.remove",
                defaultMessage: "Remove",
              })}
            />
          );
        }
        if (type === "text") {
          return (
            <FormInput
              key={key}
              {...register(fieldKey, registerOptions)}
              label={title}
              placeholder={placeholder}
              required={required}
            />
          );
        }
        if (type === "textarea") {
          return (
            <FormText
              key={key}
              {...register(fieldKey, registerOptions)}
              label={title}
              rows={3}
              placeholder={placeholder}
              required={required}
              onFocus={handleTextareaFocus}
            />
          );
        }
        return null;
      })}

      {/* Share location toggle (decision #27: optional, user-triggered, privacy-first) */}
      <div className="flex items-center justify-between p-3 rounded-xl border border-stroke-sub-300 bg-bg-weak-50">
        <div className="flex items-center gap-2">
          <RiMapPinLine className="w-5 h-5 text-text-sub-600" />
          <div>
            <span id="share-location-label" className="text-sm font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "app.garden.details.shareLocation",
                defaultMessage: "Share Location",
              })}
            </span>
            <p className="text-xs text-text-soft-400">
              {locationStatus === "success"
                ? intl.formatMessage({
                    id: "app.garden.details.locationCaptured",
                    defaultMessage: "Location captured",
                  })
                : locationStatus === "denied"
                  ? intl.formatMessage({
                      id: "app.garden.details.locationDenied",
                      defaultMessage: "Location access denied",
                    })
                  : intl.formatMessage({
                      id: "app.garden.details.locationHint",
                      defaultMessage: "Share your location to auto-fill coordinates",
                    })}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={locationEnabled}
          aria-labelledby="share-location-label"
          onClick={handleLocationToggle}
          disabled={locationStatus === "loading"}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base ${
            locationEnabled ? "bg-primary-base" : "bg-bg-soft-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-static-white transition-transform duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] ${
              locationEnabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <FormText
        {...register("feedback")}
        label={intl.formatMessage({
          id: "app.garden.details.feedback",
          description: "Feedback",
        })}
        rows={4}
        placeholder={feedbackPlaceholder}
        onFocus={handleTextareaFocus}
      />
    </div>
  );
};
