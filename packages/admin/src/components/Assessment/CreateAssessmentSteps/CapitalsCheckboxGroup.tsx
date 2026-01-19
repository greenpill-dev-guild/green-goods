import { cn } from "@green-goods/shared/utils";
import {
  type Control,
  type FieldError,
  type FieldErrorsImpl,
  type Merge,
  useController,
} from "react-hook-form";
import { type CreateAssessmentForm, extractErrorMessage } from "./shared";

// The 8 forms of capital from Constants.sol
const CAPITALS = [
  { value: "SOCIAL", label: "Social" },
  { value: "MATERIAL", label: "Material" },
  { value: "FINANCIAL", label: "Financial" },
  { value: "LIVING", label: "Living" },
  { value: "INTELLECTUAL", label: "Intellectual" },
  { value: "EXPERIENTIAL", label: "Experiential" },
  { value: "SPIRITUAL", label: "Spiritual" },
  { value: "CULTURAL", label: "Cultural" },
] as const;

/** Error type for array fields - can be a field error or array of errors */
type ArrayFieldError = FieldError | Merge<FieldError, FieldErrorsImpl<string[]>> | undefined;

interface CapitalsCheckboxGroupProps {
  control: Control<CreateAssessmentForm>;
  error?: ArrayFieldError;
  disabled?: boolean;
}

export function CapitalsCheckboxGroup({
  control,
  error,
  disabled = false,
}: CapitalsCheckboxGroupProps) {
  const {
    field: { value = [], onChange },
  } = useController({
    name: "capitals",
    control,
  });

  const handleToggle = (capitalValue: string) => {
    if (disabled) return;

    const currentValues = Array.isArray(value) ? value : [];
    const newValues = currentValues.includes(capitalValue)
      ? currentValues.filter((v) => v !== capitalValue)
      : [...currentValues, capitalValue];

    onChange(newValues);
  };

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="font-medium text-text-sub text-sm">
          Forms of capital <span className="ml-1 text-red-500">*</span>
        </span>
        <span className="text-xs text-text-soft">
          {Array.isArray(value) ? value.length : 0} selected
        </span>
      </div>
      <p className="text-xs text-text-soft">
        Select the forms of capital assessed in this evaluation
      </p>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CAPITALS.map((capital) => {
          const isChecked = Array.isArray(value) && value.includes(capital.value);

          return (
            <label
              key={capital.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition",
                isChecked
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-stroke-soft bg-bg-white text-text-sub hover:border-green-300 hover:bg-green-50/5",
                disabled && "cursor-not-allowed opacity-60",
                error && !isChecked && "border-red-300/60"
              )}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(capital.value)}
                disabled={disabled}
                className="h-4 w-4 rounded border-stroke-sub text-green-600 focus:ring-2 focus:ring-green-200 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60"
              />
              <span className="flex-1 truncate font-medium">{capital.label}</span>
            </label>
          );
        })}
      </div>

      {/* Always render to reserve space and prevent layout shift */}
      <span className="block min-h-[1.25rem] text-xs text-red-600">
        {extractErrorMessage(error) || "\u00A0"}
      </span>
    </div>
  );
}
