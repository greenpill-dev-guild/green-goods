import { RiHandHeartLine, RiSeedlingLine } from "@remixicon/react";
import { useIntl } from "react-intl";

export interface ComposeKindProps {
  value: "OFFER" | "REQUEST";
  onChange: (value: "OFFER" | "REQUEST") => void;
}

/**
 * The first beat, and the only one with two doors.
 *
 * Offering and asking are the same object seen from two sides, so this decides
 * one enum and the wording of every screen after it. It is a question rather
 * than a default because the two are equally ordinary here: a pool where only
 * offers happen is a pool where nobody admits to needing anything.
 */
export function ComposeKind({ value, onChange }: ComposeKindProps) {
  const { formatMessage } = useIntl();

  const options = [
    {
      id: "OFFER" as const,
      icon: <RiSeedlingLine className="h-5 w-5" aria-hidden="true" />,
      titleId: "app.compose.kind.offer.title",
      bodyId: "app.compose.kind.offer.body",
    },
    {
      id: "REQUEST" as const,
      icon: <RiHandHeartLine className="h-5 w-5" aria-hidden="true" />,
      titleId: "app.compose.kind.request.title",
      bodyId: "app.compose.kind.request.body",
    },
  ];

  return (
    <fieldset>
      <legend className="text-lg font-medium text-text-strong-950">
        {formatMessage({ id: "app.compose.kind.legend" })}
      </legend>
      <div className="mt-4 space-y-3">
        {options.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
              className={
                selected
                  ? "flex w-full gap-3 rounded-[var(--radius-lg)] border border-primary-alpha-24 bg-primary-alpha-10 p-4 text-left tap-target-lg"
                  : "flex w-full gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4 text-left tap-target-lg"
              }
            >
              <span className="mt-0.5 shrink-0 text-text-sub-600">{option.icon}</span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-text-strong-950">
                  {formatMessage({ id: option.titleId })}
                </span>
                <span className="mt-0.5 block text-sm text-text-sub-600">
                  {formatMessage({ id: option.bodyId })}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
