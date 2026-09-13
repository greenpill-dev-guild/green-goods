import { Button, type ButtonProps, type ButtonSize } from "@green-goods/shared/components/Button";
import { Chip } from "@green-goods/shared/components/Chip";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Link, type LinkProps } from "react-router-dom";

/**
 * EditorialAtoms — primitives for the public-browser editorial dialect.
 *
 * Each atom encodes one piece of the Warm Earth × Vellum visual language so
 * views and section composites stay declarative. Tones are restricted to
 * "default" (ink on linen) or "dark" (foreground on walnut) — anything more
 * exotic should be handled at the section level.
 *
 * Stories: see `EditorialAtoms.stories.tsx` for variants + a11y checks.
 */

type Tone = "default" | "dark";

// ============================================================================
// Text atoms
// ============================================================================

export interface EditorialKickerProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

/**
 * § 01 — Section marker. Inter, 11px, tracked uppercase.
 * Reserves an "1." style numeral via `EditorialNumeral` for ordinal ranks.
 */
export function EditorialKicker({ children, tone = "default", className }: EditorialKickerProps) {
  return (
    <p
      className={cn(
        "font-mono text-[11px] font-medium uppercase tracking-[0.16em]",
        tone === "dark" ? "text-editorial-deep-fg/72" : "text-text-sub-600",
        className
      )}
    >
      {children}
    </p>
  );
}

export interface EditorialTitleAccentProps {
  children: ReactNode;
  className?: string;
}

export function EditorialTitleAccent({ children, className }: EditorialTitleAccentProps) {
  return <em className={cn("font-serif italic text-primary-dark", className)}>{children}</em>;
}

export type EditorialHeadingSize = "display" | "section" | "sub";
export interface EditorialHeadingProps {
  children: ReactNode;
  size?: EditorialHeadingSize;
  tone?: Tone;
  as?: "h1" | "h2" | "h3" | "h4";
  className?: string;
  id?: string;
}

const HEADING_SIZE_CLASS: Record<EditorialHeadingSize, string> = {
  display: "text-3xl leading-[1.04] tracking-[-0.018em] sm:text-4xl md:text-5xl lg:text-6xl",
  section: "text-3xl leading-[1.04] tracking-[-0.02em] md:text-5xl",
  sub: "text-xl leading-[1.18] tracking-[-0.012em] md:text-2xl",
};

/**
 * Editorial Fraunces serif heading. Defaults to h2 / section size.
 * `display` is reserved for hero h1; `sub` covers card titles.
 */
export function EditorialHeading({
  children,
  size = "section",
  tone = "default",
  as: Tag = "h2",
  className,
  id,
}: EditorialHeadingProps) {
  return (
    <Tag
      id={id}
      className={cn(
        "font-serif font-normal",
        HEADING_SIZE_CLASS[size],
        tone === "dark" ? "text-editorial-deep-fg" : "text-text-strong-950",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export interface EditorialLedeProps {
  children: ReactNode;
  tone?: Tone | "muted";
  className?: string;
}

/**
 * Restrained body paragraph used under headings. Inter, larger leading, soft ink.
 */
export function EditorialLede({ children, tone = "default", className }: EditorialLedeProps) {
  const toneClass =
    tone === "dark"
      ? "text-editorial-deep-fg/78"
      : tone === "muted"
        ? "text-text-soft-400"
        : "text-text-sub-600";
  return (
    <p className={cn("text-base leading-[1.6] md:text-lg", toneClass, className)}>{children}</p>
  );
}

export interface EditorialNumeralProps {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}

/**
 * Italic Fraunces ordinal — `1.` `2.` `3.` `4.`. Used by loop steps,
 * pipeline nodes, and ledger row numbers.
 */
export function EditorialNumeral({ children, tone = "default", className }: EditorialNumeralProps) {
  return (
    <span
      className={cn(
        "font-serif text-sm italic",
        tone === "dark" ? "text-editorial-deep-fg/72" : "text-text-soft-400",
        className
      )}
    >
      {children}
    </span>
  );
}

// ============================================================================
// Structural atoms
// ============================================================================

export interface EditorialDividerProps {
  tone?: Tone;
  className?: string;
}

/**
 * 1px hairline. The editorial dialect prefers rules over card chrome.
 */
export function EditorialDivider({ tone = "default", className }: EditorialDividerProps) {
  return (
    <hr
      className={cn(
        "h-px w-full border-0",
        tone === "dark" ? "bg-editorial-deep-fg/32" : "bg-stroke-soft-200",
        className
      )}
      aria-hidden="true"
    />
  );
}

export interface EditorialMetaItem {
  label: string;
  icon?: ReactNode;
}

export interface EditorialMetaRowProps {
  items: readonly EditorialMetaItem[];
  tone?: Tone;
  className?: string;
}

/**
 * `location · 47 contributors · 312 entries` — restrained metadata row with dot
 * separators. Use for Garden cards and Action card metadata.
 */
export function EditorialMetaRow({ items, tone = "default", className }: EditorialMetaRowProps) {
  const textClass = tone === "dark" ? "text-editorial-deep-fg/72" : "text-text-soft-400";
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-relaxed tracking-[0.02em]",
        textClass,
        className
      )}
    >
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="flex items-center gap-2">
          {item.icon ? (
            <span className="inline-flex h-3 w-3 items-center" aria-hidden="true">
              {item.icon}
            </span>
          ) : null}
          <span>{item.label}</span>
          {index < items.length - 1 ? (
            <span
              aria-hidden="true"
              className="ml-3 inline-block h-0.5 w-0.5 rounded-full bg-current opacity-50"
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

// ============================================================================
// Action atoms — buttons + links
// ============================================================================

// The capsule and secondary atoms are the editorial dialect over the shared
// Button (DL-024): shape, height, press morph, and hit area come from the
// primitive, and `size` picks the step (lg 48 for hero actions, md 44 for
// section and panel actions, sm 40 for row actions). The atoms only add the
// dialect's colours, a warm linen secondary that pairs with a primary and a
// secondary for walnut surfaces. `EditorialLinkArrow` and the domain chip stay
// quiet inline affordances and never scale on hover.
const WARM_CLASSES =
  "border-editorial-deep/15 bg-editorial-warm text-text-strong-950 hover:border-editorial-deep/25 hover:bg-editorial-deep/10";

const DARK_CLASSES =
  "border-editorial-deep-fg/40 bg-transparent text-editorial-deep-fg hover:bg-editorial-deep-fg/10";

function ghostClasses(variant: EditorialGhostVariant, tone: Tone) {
  if (variant === "warm") return WARM_CLASSES;
  return tone === "dark" ? DARK_CLASSES : undefined;
}

/** The shared Button's props, minus the emphasis and tone each atom fixes. */
type EditorialButtonProps = Omit<ButtonProps, "emphasis" | "tone" | "variant" | "asChild">;

export interface EditorialPrimaryButtonProps extends EditorialButtonProps {
  children: ReactNode;
}

/** Capsule green primary action. Use for the rare on-page action (subscribe). */
export function EditorialPrimaryButton({
  children,
  type = "button",
  size = "md",
  ...rest
}: EditorialPrimaryButtonProps) {
  return (
    <Button type={type} size={size} {...rest}>
      {children}
    </Button>
  );
}

export type EditorialGhostVariant = "ghost" | "warm";

export interface EditorialGhostButtonProps extends EditorialButtonProps {
  children: ReactNode;
  tone?: Tone;
  /**
   * Visual variant. `ghost` (default) is the quiet white secondary. `warm` is a
   * tonal linen secondary that pairs with primary CTAs when the secondary action
   * carries similar weight (e.g. Donate / Endow). `tone` only applies to `ghost`.
   */
  variant?: EditorialGhostVariant;
}

/** Secondary action. Default tone for linen, dark for walnut. */
export function EditorialGhostButton({
  children,
  className,
  tone = "default",
  variant = "ghost",
  type = "button",
  size = "md",
  ...rest
}: EditorialGhostButtonProps) {
  return (
    <Button
      type={type}
      emphasis="secondary"
      size={size}
      className={cn(ghostClasses(variant, tone), className)}
      {...rest}
    >
      {children}
    </Button>
  );
}

export interface EditorialPrimaryLinkProps extends LinkProps {
  children: ReactNode;
  size?: ButtonSize;
}

/** Capsule green primary action that routes via React Router Link. */
export function EditorialPrimaryLink({
  children,
  className,
  size = "md",
  viewTransition = true,
  ...rest
}: EditorialPrimaryLinkProps) {
  return (
    <Button asChild size={size} className={className}>
      <Link viewTransition={viewTransition} {...rest}>
        {children}
      </Link>
    </Button>
  );
}

export interface EditorialGhostLinkProps extends LinkProps {
  children: ReactNode;
  tone?: Tone;
  /** Mirrors `EditorialGhostButton` so route-backed secondaries keep the same treatment. */
  variant?: EditorialGhostVariant;
  size?: ButtonSize;
}

/** Secondary action that routes via React Router Link. */
export function EditorialGhostLink({
  children,
  className,
  tone = "default",
  variant = "ghost",
  size = "md",
  viewTransition = true,
  ...rest
}: EditorialGhostLinkProps) {
  return (
    <Button
      asChild
      emphasis="secondary"
      size={size}
      className={cn(ghostClasses(variant, tone), className)}
    >
      <Link viewTransition={viewTransition} {...rest}>
        {children}
      </Link>
    </Button>
  );
}

export interface EditorialLinkArrowProps {
  to: string;
  children: ReactNode;
  external?: boolean;
  tone?: Tone;
  className?: string;
}

/**
 * Inline green underline link with a trailing arrow. Doubles as a ghost CTA in
 * places where capsule buttons would feel too loud (section footers, lede asides).
 */
export function EditorialLinkArrow({
  to,
  children,
  external = false,
  tone = "default",
  className,
}: EditorialLinkArrowProps) {
  const baseClasses = cn(
    "group inline-flex items-center gap-2 border-b pb-0.5 text-sm font-medium transition-colors",
    tone === "dark"
      ? "border-editorial-deep-fg/35 text-editorial-deep-fg hover:border-editorial-deep-fg/70"
      : "border-primary-action/35 text-primary-action hover:border-primary-action-hover hover:text-primary-action-hover",
    className
  );

  // Arrow translates 4px right on hover via spring-fast — pairs with the
  // unified action-motion language on Editorial buttons/links. Reduced motion
  // pins the arrow in place via `motion-safe`.
  const arrowClasses =
    "transition-transform duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] motion-safe:group-hover:translate-x-1 motion-safe:group-focus-visible:translate-x-1";

  if (external) {
    return (
      <a href={to} target="_blank" rel="noreferrer noopener" className={baseClasses}>
        {children}
        <span aria-hidden="true" className={arrowClasses}>
          →
        </span>
      </a>
    );
  }

  return (
    <Link to={to} className={baseClasses} viewTransition>
      {children}
      <span aria-hidden="true" className={arrowClasses}>
        →
      </span>
    </Link>
  );
}

// ============================================================================
// Domain chip — filter affordance with optional domain ink
// ============================================================================

export type EditorialDomain = "all" | "solar" | "agro" | "education" | "waste";

export interface EditorialDomainChipProps {
  domain: EditorialDomain;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  className?: string;
}

const ACTIVE_DOMAIN_CLASSES: Record<EditorialDomain, string> = {
  all: "bg-text-strong-950 text-static-white border-text-strong-950",
  solar: "bg-domain-solar-soft text-domain-solar border-domain-solar/30",
  agro: "bg-domain-agro-soft text-domain-agro border-domain-agro/30",
  education: "bg-domain-education-soft text-domain-education border-domain-education/30",
  waste: "bg-domain-waste-soft text-domain-waste border-domain-waste/30",
};

/**
 * Filter chip for /actions, /impact, /gardens: the shared Chip with the
 * domain's own ink when active (or strong ink for "All"), never green, which
 * keeps the green accent for primary action.
 */
export function EditorialDomainChip({
  domain,
  active,
  onClick,
  children,
  count,
  className,
}: EditorialDomainChipProps) {
  const isEmpty = count === 0 && !active;
  return (
    <Chip
      selected={active}
      onClick={onClick}
      className={cn(
        active
          ? ACTIVE_DOMAIN_CLASSES[domain]
          : isEmpty && "border-stroke-soft-200/60 bg-bg-weak-50 text-text-soft-400",
        className
      )}
    >
      <span>{children}</span>
      {typeof count === "number" ? (
        <span
          className={cn("tabular-nums text-[10px] opacity-70", active ? "" : "text-text-soft-400")}
        >
          {count}
        </span>
      ) : null}
    </Chip>
  );
}

// ============================================================================
// Glossary tooltip — first-mention vocabulary primer
// ============================================================================

export interface EditorialTermTooltipProps {
  /** The term itself, displayed inline with a dotted underline. */
  term: ReactNode;
  /** One-sentence plain-English definition shown in the popover. */
  definition: ReactNode;
  className?: string;
}

/**
 * EditorialTermTooltip — wrap a vocabulary term to give first-time readers a
 * one-sentence plain-English definition on hover (desktop) or click/tap (mobile).
 *
 * The trigger reads as a normal word with a soft dotted underline. The popover
 * is positioned above the term and dismisses on outside click, Escape, or blur.
 */
export function EditorialTermTooltip({ term, definition, className }: EditorialTermTooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={containerRef}
      className={cn("relative inline-block", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        data-pressable="trigger"
        aria-describedby={open ? popoverId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onFocus={() => setOpen(true)}
        onBlur={(event) => {
          if (!containerRef.current?.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        className="cursor-help border-b border-dotted border-current text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-1"
      >
        {term}
      </button>
      {open ? (
        <span
          id={popoverId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-raised mb-2 w-64 -translate-x-1/2 border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-xs leading-snug text-text-sub-600 shadow-[var(--shadow-editorial-card)]"
        >
          {definition}
        </span>
      ) : null}
    </span>
  );
}
