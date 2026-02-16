import type { Action, WorkInput } from "@green-goods/shared";
import type { WorkFormData } from "@green-goods/shared/hooks/work/useWorkForm";
import { normalizeTimeSpentMinutes } from "@green-goods/shared/utils/form/normalizers";
import { RiFileFill, RiMapPinLine } from "@remixicon/react";
import React, { useCallback, useState } from "react";
import type { Control, Path, UseFormRegister, UseFormSetValue } from "react-hook-form";
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

  // Handle location toggle
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

  // Multi-select state tracking (controlled via local state, synced to form)
  const [multiSelectValues, setMultiSelectValues] = useState<Record<string, string[]>>({});

  const toggleMultiSelectOption = useCallback(
    (fieldKey: string, option: string) => {
      setMultiSelectValues((prev) => {
        const current = prev[fieldKey] || [];
        const next = current.includes(option)
          ? current.filter((v) => v !== option)
          : [...current, option];
        // Sync to form
        if (setValue) {
          setValue(fieldKey as Path<WorkFormData>, next);
        }
        return { ...prev, [fieldKey]: next };
      });
    },
    [setValue]
  );

  return (
    <div className="flex flex-col gap-4">
      <FormInfo title={detailsTitle} info={detailsDescription} Icon={RiFileFill} />

      {/* Time Spent Input - Always shown as a default field */}
      <FormInput
        {...register("timeSpentMinutes", {
          setValueAs: normalizeTimeSpentMinutes,
        })}
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
          bands,
          required = false,
          title = "",
          key,
          type,
          unit,
        } = input;

        const selectOptions = Array.isArray(options) ? options : [];
        const registerOptions =
          type === "number"
            ? {
                setValueAs: (value: unknown) => {
                  if (value === "" || value === null || value === undefined) {
                    return undefined;
                  }
                  if (typeof value === "number") return value;
                  if (typeof value === "string") {
                    const parsed = Number(value);
                    return Number.isNaN(parsed) ? undefined : parsed;
                  }
                  return undefined;
                },
              }
            : undefined;

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
                label: option,
                value: option,
              }))}
              control={control}
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
                  defaultMessage: "Select a range",
                })
              }
              options={bandOptions.map((band) => ({
                label: band,
                value: band,
              }))}
              control={control}
            />
          );
        }
        if (type === "multi-select") {
          // Multi-select rendered as tag chips
          const selected = multiSelectValues[key] || [];
          return (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-strong-950">
                {title}
                {required && <span className="text-error-base ml-0.5">*</span>}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectOptions.map((option) => {
                  const isSelected = selected.includes(option);
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleMultiSelectOption(key, option)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                        isSelected
                          ? "bg-primary-base text-white border-primary-base"
                          : "bg-bg-weak-50 text-text-sub-600 border-stroke-sub-300 hover:bg-bg-soft-200"
                      }`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {/* Hidden input for form registration */}
              <input type="hidden" {...register(fieldKey)} value={JSON.stringify(selected)} />
            </div>
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
            <span className="text-sm font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "app.garden.details.shareLocation",
                defaultMessage: "Share location",
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
                      defaultMessage: "Coarse GPS for verification",
                    })}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={locationEnabled}
          onClick={handleLocationToggle}
          disabled={locationStatus === "loading"}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base ${
            locationEnabled ? "bg-primary-base" : "bg-bg-soft-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
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
      />
    </div>
  );
};
