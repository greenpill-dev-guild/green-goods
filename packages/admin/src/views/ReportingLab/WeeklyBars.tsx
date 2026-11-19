/**
 * Garden reporting lab (proposed component): a small weekly bar chart with its numbers.
 *
 * "nested" draws a total with a part inside it (reported, and the approved share of it);
 * "paired" draws two counts side by side (submitted beside reviewed). Each week is a
 * button when it opens records, its value is printed above its bar, and a table shows
 * the same numbers on request. No library: the bars are boxes sized by percentage.
 */
import { Button } from "@green-goods/shared/components/Button";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useState } from "react";
import { AdminListRow } from "@/components/AdminListRow";

export interface BarPoint {
  key: string;
  /** The axis tick: short, since eight weeks share a small chart. */
  label: string;
  /** The week's full name for screen readers and the table; the tick when left out. */
  fullLabel?: string;
  /** A second tick line under the label, such as the month where it changes. */
  group?: string;
  primary: number;
  secondary?: number;
  /** A week the chart cannot speak for, said instead of a bar ("Not loaded"). */
  gap?: string;
  /** A week still running, said beside its label. */
  running?: boolean;
}

interface WeeklyBarsProps {
  title: string;
  points: readonly BarPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
  mode?: "nested" | "paired";
  format: (value: number) => string;
  onSelect?: (index: number) => void;
  selectedIndex?: number;
  /** The chart's period total, said right under it. */
  summary?: string;
  /** A quieter line: what is kept apart, what a value means. */
  note?: string;
  compact?: boolean;
}

function describe(point: BarPoint, props: WeeklyBarsProps) {
  const name = point.fullLabel ?? point.label;
  if (point.gap) return `${name}: ${point.gap}`;
  const parts = [`${props.format(point.primary)} ${props.primaryLabel.toLowerCase()}`];
  if (props.secondaryLabel && point.secondary !== undefined) {
    parts.push(`${props.format(point.secondary)} ${props.secondaryLabel.toLowerCase()}`);
  }
  return `${name}${point.running ? " (so far)" : ""}: ${parts.join(", ")}`;
}

function Bars({ point, max, mode }: { point: BarPoint; max: number; mode: "nested" | "paired" }) {
  const height = (value: number) => `${Math.max(value > 0 ? 3 : 0, (value / max) * 100)}%`;
  if (point.gap) {
    return (
      <span className="mt-auto h-full w-full rounded-(--admin-radius-xs) border border-dashed border-stroke-sub" />
    );
  }
  if (mode === "paired") {
    return (
      <span className="mt-auto flex h-full w-full items-end justify-center gap-0.5">
        <span
          className="w-1/2 rounded-t-(--admin-radius-xs) bg-text-soft"
          style={{ height: height(point.primary) }}
        />
        <span
          className="w-1/2 rounded-t-(--admin-radius-xs) bg-information-base"
          style={{ height: height(point.secondary ?? 0) }}
        />
      </span>
    );
  }
  if (point.secondary === undefined) {
    return (
      <span
        className="mt-auto w-full rounded-t-(--admin-radius-xs) bg-information-base"
        style={{ height: height(point.primary) }}
      />
    );
  }
  return (
    <span
      className="relative mt-auto w-full rounded-t-(--admin-radius-xs) border border-stroke-sub bg-bg-weak"
      style={{ height: height(point.primary) }}
    >
      <span
        className="absolute inset-x-0 bottom-0 rounded-t-(--admin-radius-xs) bg-success-base"
        style={{
          height: point.primary > 0 ? `${((point.secondary ?? 0) / point.primary) * 100}%` : 0,
        }}
      />
    </span>
  );
}

export function WeeklyBars(props: WeeklyBarsProps) {
  const {
    title,
    points,
    primaryLabel,
    secondaryLabel,
    mode = "nested",
    format,
    onSelect,
    selectedIndex,
    summary,
    note,
    compact,
  } = props;
  const [asTable, setAsTable] = useState(false);
  const gaps = [...new Set(points.flatMap((point) => (point.gap ? [point.gap] : [])))];
  const hasGroups = points.some((point) => point.group !== undefined);
  const max = Math.max(1, ...points.map((p) => Math.max(p.primary, p.secondary ?? 0)));
  let swatch = mode === "paired" ? "bg-text-soft" : "border border-stroke-sub bg-bg-weak";
  if (mode === "nested" && !secondaryLabel) swatch = "bg-information-base";

  return (
    <figure className="flex min-w-0 flex-col gap-2" data-component="WeeklyBars">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="type-label font-semibold text-text-strong">{title}</span>
        <span className="flex flex-wrap items-center gap-3 type-meta text-text-sub">
          <span className="inline-flex items-center gap-1">
            <span aria-hidden className={cn("h-2.5 w-2.5 rounded-(--admin-radius-xs)", swatch)} />
            {primaryLabel}
          </span>
          {secondaryLabel ? (
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className={cn(
                  "h-2.5 w-2.5 rounded-(--admin-radius-xs)",
                  mode === "paired" ? "bg-information-base" : "bg-success-base"
                )}
              />
              {secondaryLabel}
            </span>
          ) : null}
          {gaps.map((gap) => (
            <span key={gap} className="inline-flex items-center gap-1">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-(--admin-radius-xs) border border-dashed border-stroke-sub"
              />
              {gap}
            </span>
          ))}
        </span>
      </figcaption>
      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[18rem] type-meta">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-b border-stroke-soft text-left text-text-sub">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Week
                </th>
                <th scope="col" className="py-1 pr-3 text-right font-medium">
                  {primaryLabel}
                </th>
                {secondaryLabel ? (
                  <th scope="col" className="py-1 text-right font-medium">
                    {secondaryLabel}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.key} className="border-b border-stroke-soft last:border-0">
                  <th scope="row" className="py-1 pr-3 text-left font-normal text-text-sub">
                    {point.fullLabel ?? point.label}
                    {point.running ? " (so far)" : ""}
                  </th>
                  <td className="py-1 pr-3 text-right tabular-nums text-text-strong">
                    {point.gap ?? format(point.primary)}
                  </td>
                  {secondaryLabel ? (
                    <td className="py-1 text-right tabular-nums text-text-strong">
                      {point.gap ? "" : format(point.secondary ?? 0)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ol
          className={cn("grid items-end gap-1", compact ? "h-28" : "h-40")}
          style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}
        >
          {points.map((point, index) => {
            const body = (
              <>
                <span
                  aria-hidden
                  className="flex flex-col truncate text-center type-meta-sm tabular-nums text-text-sub"
                >
                  <span className="truncate">{point.gap ? "–" : format(point.primary)}</span>
                  {mode === "paired" ? (
                    <span className="truncate text-information-dark">
                      {point.gap ? "" : format(point.secondary ?? 0)}
                    </span>
                  ) : null}
                </span>
                <span aria-hidden className="flex min-h-0 flex-1 items-end">
                  <Bars point={point} max={max} mode={mode} />
                </span>
                <span aria-hidden className="flex flex-col text-center type-meta-sm text-text-soft">
                  <span className="truncate">{point.label}</span>
                  {hasGroups ? <span className="truncate">{point.group ?? "\u00a0"}</span> : null}
                </span>
              </>
            );
            const box = "flex h-full min-h-0 flex-col gap-1 px-0.5 py-1";
            return (
              <li key={point.key} className="h-full min-w-0">
                {onSelect && !point.gap ? (
                  <AdminListRow
                    aria-label={`${describe(point, props)}. Open records`}
                    current={selectedIndex === index}
                    onClick={() => onSelect(index)}
                    className={cn(
                      box,
                      "min-h-0 rounded-(--admin-radius-sm) border-transparent bg-transparent"
                    )}
                  >
                    {body}
                  </AdminListRow>
                ) : (
                  <span className={box} aria-label={describe(point, props)} role="img">
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {summary ? <p className="type-meta text-text-sub">{summary}</p> : null}
      {note ? <p className="type-meta text-text-soft">{note}</p> : null}
      <div className="flex justify-end">
        <Button
          type="button"
          emphasis="tertiary"
          size="compact"
          aria-pressed={asTable}
          onClick={() => setAsTable(!asTable)}
        >
          {asTable ? "Show Chart" : "Show Table"}
        </Button>
      </div>
    </figure>
  );
}
