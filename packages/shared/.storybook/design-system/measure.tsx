/**
 * Live measurement for the Design System review pages.
 *
 * Every specimen on those pages is the real component; this module only reads
 * what the browser rendered (`getBoundingClientRect` / `getComputedStyle`) and
 * grades it against the surface's rules. Nothing here touches product code.
 */
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";

export type SurfaceId = "app" | "website" | "admin";

export interface Measurement {
  height: number;
  width: number;
  /** Resolved top-left corner in px (a capsule reports its huge px value). */
  radius: number;
  /** Corner as the eye reads it: "circle", "pill", or "Npx". */
  corner: string;
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
  /** The type of the first text node inside the control (the label). */
  labelFontSize: number;
  labelFontWeight: number;
  labelFontFamily: string;
  /** Tallest of the box and any absolutely positioned ::before / ::after box. */
  hitHeight: number;
  borderTop: number;
  borderBottom: number;
  /** Which pseudo-element supplied the hit area, if any. */
  hitSource: "box" | "::before" | "::after";
}

const px = (value: string) => Number.parseFloat(value) || 0;
const family = (value: string) => value.split(",")[0]?.replace(/["']/g, "").trim() ?? "";

function pseudoBox(element: Element, which: "::before" | "::after") {
  const style = getComputedStyle(element, which);
  if (style.content === "none" || style.position !== "absolute") return null;
  return { height: px(style.height), width: px(style.width) };
}

/** The first element (self included) holding a non-empty direct text node. */
function labelHost(element: HTMLElement): HTMLElement {
  const nodes = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))];
  return (
    nodes.find((node) =>
      Array.from(node.childNodes).some(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim()
      )
    ) ?? element
  );
}

export function measureElement(element: HTMLElement): Measurement {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const label = getComputedStyle(labelHost(element));
  const radius = px(style.borderTopLeftRadius);
  const half = Math.min(rect.width, rect.height) / 2;
  const corner =
    radius >= half - 0.5
      ? Math.abs(rect.width - rect.height) < 1
        ? "circle"
        : "pill"
      : `${Math.round(radius)}px`;
  const before = pseudoBox(element, "::before");
  const after = pseudoBox(element, "::after");
  let hitHeight = rect.height;
  let hitSource: Measurement["hitSource"] = "box";
  for (const [source, box] of [
    ["::before", before],
    ["::after", after],
  ] as const) {
    if (box && box.height > hitHeight) {
      hitHeight = box.height;
      hitSource = source;
    }
  }
  return {
    height: round(rect.height),
    width: round(rect.width),
    radius,
    corner,
    fontSize: px(style.fontSize),
    fontWeight: Number(style.fontWeight) || 400,
    fontFamily: family(style.fontFamily),
    labelFontSize: px(label.fontSize),
    labelFontWeight: Number(label.fontWeight) || 400,
    labelFontFamily: family(label.fontFamily),
    hitHeight: round(hitHeight),
    borderTop: px(style.borderTopWidth),
    borderBottom: px(style.borderBottomWidth),
    hitSource,
  };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

/** What a specimen is expected to measure. Every field is optional. */
export interface Expectation {
  height?: number | number[];
  /** A number in px, or a shape word. */
  radius?: number | "circle" | "pill" | "none";
  labelSize?: number | number[];
  weight?: number | number[];
  family?: string;
  /** Minimum hit-area height. */
  hit?: number;
  /** An underline field: bottom border only. */
  underline?: boolean;
}

export interface Check {
  label: string;
  pass: boolean;
  actual: string;
  expected: string;
}

const list = (value: number | number[]) => (Array.isArray(value) ? value : [value]);
const near = (actual: number, expected: number, tolerance = 0.5) =>
  Math.abs(actual - expected) <= tolerance;

export function gradeMeasurement(m: Measurement, expect: Expectation): Check[] {
  const checks: Check[] = [];
  if (expect.height !== undefined) {
    const wanted = list(expect.height);
    checks.push({
      label: "height",
      pass: wanted.some((h) => near(m.height, h)),
      actual: `${m.height}px`,
      expected: wanted.map((h) => `${h}px`).join(" / "),
    });
  }
  if (expect.radius !== undefined) {
    const pass =
      expect.radius === "circle" || expect.radius === "pill"
        ? m.corner === expect.radius || (expect.radius === "pill" && m.corner === "circle")
        : expect.radius === "none"
          ? m.radius === 0
          : near(m.radius, expect.radius);
    checks.push({
      label: "corner",
      pass,
      actual: m.corner,
      expected: typeof expect.radius === "number" ? `${expect.radius}px` : expect.radius,
    });
  }
  if (expect.labelSize !== undefined) {
    const wanted = list(expect.labelSize);
    checks.push({
      label: "label",
      pass: wanted.some((size) => near(m.labelFontSize, size)),
      actual: `${m.labelFontSize}px`,
      expected: wanted.map((size) => `${size}px`).join(" / "),
    });
  }
  if (expect.weight !== undefined) {
    const wanted = list(expect.weight);
    checks.push({
      label: "weight",
      pass: wanted.includes(m.labelFontWeight),
      actual: String(m.labelFontWeight),
      expected: wanted.join(" / "),
    });
  }
  if (expect.family !== undefined) {
    checks.push({
      label: "font",
      pass: m.labelFontFamily.toLowerCase() === expect.family.toLowerCase(),
      actual: m.labelFontFamily || "(inherited)",
      expected: expect.family,
    });
  }
  if (expect.hit !== undefined) {
    checks.push({
      label: "hit area",
      pass: m.hitHeight >= expect.hit - 0.5,
      actual: `${m.hitHeight}px`,
      expected: `≥ ${expect.hit}px`,
    });
  }
  if (expect.underline) {
    checks.push({
      label: "underline",
      pass: m.borderBottom >= 1 && m.borderTop === 0,
      actual: `top ${m.borderTop}px · bottom ${m.borderBottom}px`,
      expected: "bottom hairline only",
    });
  }
  return checks;
}

export function describeMeasurement(m: Measurement): string {
  const type = `${m.labelFontSize}px/${m.labelFontWeight} ${m.labelFontFamily || "inherited"}`;
  const hit = m.hitHeight > m.height ? ` · hit ${m.hitHeight}px (${m.hitSource})` : "";
  return `${m.height} × ${m.width}px · ${m.corner} · ${type}${hit}`;
}

/**
 * Re-measures a DOM element after mount, once the web fonts settle, on resize,
 * and when the root theme or surface attribute changes.
 */
export function useLiveMeasurement<T extends HTMLElement>(
  target: () => T | null
): Measurement | null {
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const targetRef = useRef(target);
  targetRef.current = target;

  const remeasure = useCallback(() => {
    const element = targetRef.current();
    if (!element) return;
    setMeasurement(measureElement(element));
    // A dialog or sheet enters under a transform; the rect is only final once
    // every running animation has finished.
    const running = document.getAnimations?.() ?? [];
    if (running.length) {
      Promise.all(running.map((animation) => animation.finished.catch(() => undefined))).then(
        () => {
          const settled = targetRef.current();
          if (settled) setMeasurement(measureElement(settled));
        }
      );
    }
  }, []);

  useEffect(() => {
    remeasure();
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) remeasure();
    });
    const element = targetRef.current();
    const resize = element ? new ResizeObserver(() => remeasure()) : null;
    if (element) resize?.observe(element);
    const attributes = new MutationObserver(() => remeasure());
    attributes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-surface"],
    });
    return () => {
      cancelled = true;
      resize?.disconnect();
      attributes.disconnect();
    };
  }, [remeasure]);

  return measurement;
}

/** Reads a CSS custom property as the browser resolves it on an element. */
export function readToken(name: string, element: Element = document.documentElement): string {
  return getComputedStyle(element).getPropertyValue(name).trim() || "∅";
}

const DEFAULT_TARGET =
  'button, a[href], input, select, textarea, [role="tab"], [role="switch"], [role="button"]';

export interface SpecimenTarget {
  /** Row label when a specimen measures more than one element. */
  name?: string;
  /** CSS selector for the element to measure. */
  selector?: string;
  /** Search the whole document (for portaled dialogs) instead of the specimen. */
  inDocument?: boolean;
  /** Measure every match and grade the whole set (a variant matrix). */
  all?: boolean;
  expect?: Expectation;
}

/** Grades a set of measurements: a check passes only when every element passes. */
export function gradeMany(measurements: Measurement[], expect: Expectation): Check[] {
  const per = measurements.map((m) => gradeMeasurement(m, expect));
  if (!per.length) return [];
  return per[0].map((check, index) => {
    const column = per.map((checks) => checks[index]);
    const actuals = [...new Set(column.map((c) => c.actual))];
    return {
      label: check.label,
      pass: column.every((c) => c.pass),
      actual: actuals.length > 3 ? `${actuals.slice(0, 3).join(", ")} +${actuals.length - 3}` : actuals.join(", "),
      expected: check.expected,
    };
  });
}

export function describeMany(measurements: Measurement[]): string {
  const uniq = (values: Array<string | number>) => [...new Set(values.map(String))].join(" / ");
  const hits = measurements.filter((m) => m.hitHeight > m.height);
  return `${measurements.length} measured · ${uniq(measurements.map((m) => m.height))}px · ${uniq(
    measurements.map((m) => m.corner)
  )} · ${uniq(measurements.map((m) => `${m.labelFontSize}px/${m.labelFontWeight}`))} ${uniq(
    measurements.map((m) => m.labelFontFamily || "inherited")
  )}${hits.length ? ` · hit ${uniq(hits.map((m) => m.hitHeight))}px` : ""}`;
}

/** Live measurements of every element matching a selector. */
export function useLiveMeasurements(targets: () => HTMLElement[]): Measurement[] {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const targetsRef = useRef(targets);
  targetsRef.current = targets;
  const remeasure = useCallback(() => {
    const elements = targetsRef.current();
    setMeasurements(elements.map((element) => measureElement(element)));
    const running = document.getAnimations?.() ?? [];
    if (running.length) {
      Promise.all(running.map((animation) => animation.finished.catch(() => undefined))).then(
        () => setMeasurements(targetsRef.current().map((element) => measureElement(element)))
      );
    }
  }, []);
  useEffect(() => {
    remeasure();
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) remeasure();
    });
    const attributes = new MutationObserver(() => remeasure());
    attributes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-surface"],
    });
    return () => {
      cancelled = true;
      attributes.disconnect();
    };
  }, [remeasure]);
  return measurements;
}

export interface SpecimenProps {
  /** Short name shown above the specimen. */
  title: string;
  /** Extra context under the checks (a source citation, a note). */
  note?: ReactNode;
  /** CSS selector for the element to measure inside the specimen. */
  target?: string;
  expect?: Expectation;
  /** Measure every element `target` matches and grade them as one set. */
  all?: boolean;
  /** Several elements measured at once (a field's container, label, and input). */
  targets?: SpecimenTarget[];
  children: ReactNode;
  /** Renders the specimen on a wider column. */
  wide?: boolean;
}

function ChecksList({ checks }: { checks: Check[] }) {
  if (!checks.length) return null;
  return (
    <ul className="sb-checks">
      {checks.map((check) => (
        <li
          key={check.label}
          className={check.pass ? "sb-check sb-check-pass" : "sb-check sb-check-fail"}
          title={`${check.label}: measured ${check.actual}, expected ${check.expected}`}
        >
          <b>{check.label}</b> {check.actual}
          {check.pass ? null : <i> → {check.expected}</i>}
        </li>
      ))}
    </ul>
  );
}

function TargetReadout({
  host,
  target,
  onGrade,
}: {
  host: React.RefObject<HTMLDivElement | null>;
  target: SpecimenTarget;
  onGrade: (name: string, failing: number) => void;
}) {
  const selector = target.selector ?? DEFAULT_TARGET;
  const root = () => (target.inDocument ? document : host.current);
  const measurement = useLiveMeasurement(() =>
    target.all ? null : (root()?.querySelector<HTMLElement>(selector) ?? null)
  );
  const measurements = useLiveMeasurements(() =>
    target.all ? Array.from(root()?.querySelectorAll<HTMLElement>(selector) ?? []) : []
  );
  const checks = target.all
    ? target.expect
      ? gradeMany(measurements, target.expect)
      : []
    : measurement && target.expect
      ? gradeMeasurement(measurement, target.expect)
      : [];
  const failing = checks.filter((check) => !check.pass).length;
  const key = target.name ?? selector;
  useEffect(() => {
    onGrade(key, checks.length ? failing : -1);
  }, [key, failing, checks.length, onGrade]);
  const readout = target.all
    ? measurements.length
      ? describeMany(measurements)
      : "measuring…"
    : measurement
      ? describeMeasurement(measurement)
      : "measuring…";

  return (
    <>
      <div className="sb-specimen-readout">
        {target.name ? <b>{target.name} · </b> : null}
        {readout}
      </div>
      <ChecksList checks={checks} />
    </>
  );
}

/**
 * A real component with its live measurements and pass/fail chips underneath.
 * The wrapper adds no styles to the child beyond a flex row, so the measured
 * geometry is the component's own.
 */
export function Specimen({
  title,
  note,
  target,
  expect,
  all,
  targets,
  children,
  wide,
}: SpecimenProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const onGrade = useCallback((name: string, failing: number) => {
    setGrades((current) => (current[name] === failing ? current : { ...current, [name]: failing }));
  }, []);
  const resolvedTargets: SpecimenTarget[] = targets ?? [{ selector: target, expect, all }];
  const graded = Object.values(grades).filter((value) => value >= 0);
  const failing = graded.reduce((sum, value) => sum + value, 0);

  return (
    <figure
      className="sb-specimen"
      data-wide={wide ? "true" : undefined}
      data-failing={failing || undefined}
    >
      <figcaption className="sb-specimen-title">
        <span>{title}</span>
        {graded.length ? (
          <span className={failing ? "sb-verdict sb-verdict-fail" : "sb-verdict sb-verdict-pass"}>
            {failing ? `${failing} off` : "on spec"}
          </span>
        ) : null}
      </figcaption>
      <div ref={hostRef} className="sb-specimen-stage">
        {children}
      </div>
      {resolvedTargets.map((item, index) => (
        <TargetReadout
          key={item.name ?? item.selector ?? index}
          host={hostRef}
          target={item}
          onGrade={onGrade}
        />
      ))}
      {note ? <div className="sb-specimen-note">{note}</div> : null}
    </figure>
  );
}

/** Live value of one or more CSS custom properties, read from the root or a scope. */
export function TokenTable({
  tokens,
  scopeSelector,
}: {
  tokens: Array<{ name: string; expected?: string; note?: string }>;
  /** Element to read from (a `[data-surface-scope]` column); the root by default. */
  scopeSelector?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => {
    const read = () => {
      const element =
        (scopeSelector ? document.querySelector(scopeSelector) : null) ?? document.documentElement;
      setValues(
        Object.fromEntries(tokens.map((token) => [token.name, readToken(token.name, element)]))
      );
    };
    read();
    document.fonts?.ready.then(read);
    const attributes = new MutationObserver(read);
    attributes.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-surface"],
    });
    return () => attributes.disconnect();
  }, [tokens, scopeSelector]);

  return (
    <table className="sb-token-table">
      <thead>
        <tr>
          <th>Token</th>
          <th>Live value</th>
          <th>Expected</th>
          <th>Note</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((token) => {
          const value = values[token.name] ?? "…";
          const pass = token.expected === undefined ? null : value === token.expected;
          return (
            <tr key={token.name} data-pass={pass === null ? undefined : String(pass)}>
              <td>
                <code>{token.name}</code>
              </td>
              <td>
                <code>{value}</code>
              </td>
              <td>{token.expected ? <code>{token.expected}</code> : "—"}</td>
              <td>{token.note ?? ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Page scaffolding shared by the Design System stories. */
export function Page({ title, lede, children }: { title: string; lede?: ReactNode; children: ReactNode }) {
  return (
    <article className="sb-ds-page">
      <header className="sb-ds-header">
        <h1>{title}</h1>
        {lede ? <p>{lede}</p> : null}
      </header>
      {children}
    </article>
  );
}

export function Section({
  title,
  lede,
  children,
  id,
}: {
  title: string;
  lede?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="sb-ds-section" id={id}>
      <h2>{title}</h2>
      {lede ? <p className="sb-ds-lede">{lede}</p> : null}
      {children}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="sb-ds-row">{children}</div>;
}

/** A link into another story in the same Storybook. */
export function StoryLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <a className="sb-ds-link" href={`?path=/story/${id}`} target="_top" rel="noreferrer">
      {children}
    </a>
  );
}
