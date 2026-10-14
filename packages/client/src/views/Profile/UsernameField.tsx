import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import type { SlugFormValues } from "@green-goods/shared/hooks/ens/useSlugForm";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckLine } from "@remixicon/react";
import type { UseFormReturn } from "react-hook-form";
import { useIntl } from "react-intl";

/** The contract's limit for a username (PRD-1026 D5). */
const MAX_LENGTH = 50;

export interface UsernameFieldProps {
  id: string;
  label: string;
  form: UseFormReturn<SlugFormValues>;
  /** What the field holds now. */
  typed: string;
  /** Whether the typed name is free, while the field checks it; omit to not check. */
  availability?: { available: boolean | undefined; checking: boolean };
  /** The rules under the field, for a first claim. */
  showRules?: boolean;
  disabled?: boolean;
}

/**
 * A username field (PRD-1026 p7, p9, p10): the name typed without its suffix,
 * which the field shows, and one reserved line under it that says whether the
 * name is free, or which rule it breaks, beside the count toward the limit, so
 * nothing moves as the check updates.
 */
export function UsernameField({
  id,
  label,
  form,
  typed,
  availability,
  showRules = false,
  disabled = false,
}: UsernameFieldProps) {
  const { formatMessage } = useIntl();
  const error = form.formState.errors.slug?.message;
  let status: { tone: "error" | "success" | "sub"; text: string } | null = null;
  if (error) {
    status = { tone: "error", text: error };
  } else if (availability && typed) {
    if (availability.checking || availability.available === undefined) {
      status = {
        tone: "sub",
        text: formatMessage({
          id: "app.profile.username.checkingAvailability",
          defaultMessage: "Checking availability…",
        }),
      };
    } else if (availability.available) {
      status = {
        tone: "success",
        text: formatMessage({ id: "app.profile.slugAvailable", defaultMessage: "Name available" }),
      };
    } else {
      status = {
        tone: "error",
        text: formatMessage({
          id: "app.profile.slugTaken",
          defaultMessage: "This name is already taken",
        }),
      };
    }
  }

  return (
    <div data-component="UsernameField">
      <label htmlFor={id} className="block text-sm font-medium text-text-strong-950">
        {label}
      </label>
      <div className="relative mt-1.5">
        <TextInput
          id={id}
          {...form.register("slug")}
          inputMode="text"
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_LENGTH}
          disabled={disabled}
          invalid={status?.tone === "error"}
          aria-describedby={`${id}-status`}
          className="pr-36"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-text-soft-400"
        >
          .greengoods.eth
        </span>
      </div>
      <p
        id={`${id}-status`}
        aria-live="polite"
        className="mt-1.5 flex min-h-5 items-start justify-between gap-3 text-xs"
      >
        <span
          className={cn(
            "flex min-w-0 items-center gap-1",
            status?.tone === "error"
              ? "text-error-dark"
              : status?.tone === "success"
                ? "text-success-dark"
                : "text-text-sub-600"
          )}
        >
          {status?.tone === "success" ? (
            <RiCheckLine className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : null}
          {status?.text}
        </span>
        <span className="shrink-0 tabular-nums text-text-sub-600">
          {typed.length}/{MAX_LENGTH}
        </span>
      </p>
      {showRules ? (
        <p className="mt-1 text-xs text-text-sub-600">
          {formatMessage({
            id: "app.profile.username.rules",
            defaultMessage: "3 to 50 characters: lowercase letters, numbers and hyphens.",
          })}
        </p>
      ) : null}
    </div>
  );
}
