import { DialogShell, PwaSheet, cn, useMediaQuery } from "@green-goods/shared";
import { RiCheckLine, RiCloseLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

/**
 * Shared layout + control primitives for the /vaults checkout surface.
 *
 * Desktop renders through DialogShell while mobile renders through the PWA bottom
 * sheet primitive. Controls are square per the transaction-flow treatment; these
 * classes are scoped to vault checkout and do not touch the global editorial CTA
 * atoms.
 */

export type CheckoutMethod = "card" | "wallet";
export type CheckoutLayout = "compact" | "flow";

// Square transaction controls (no rounded capsules inside the checkout).
export const CHECKOUT_PRIMARY_BUTTON =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-none border border-primary-action bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-stroke-soft-200 disabled:bg-stroke-soft-200 disabled:text-text-soft-400";

export const CHECKOUT_GHOST_BUTTON =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-none border border-stroke-soft-200 bg-bg-white-0 px-6 py-3 text-sm font-semibold text-text-sub-600 transition-colors hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:bg-stroke-soft-200 disabled:text-text-soft-400";

export const CHECKOUT_INPUT =
  "w-full rounded-none border border-stroke-soft-200 bg-bg-white-0 px-4 py-3 text-base text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 focus:border-primary-action disabled:cursor-not-allowed disabled:bg-bg-weak-50 disabled:text-text-soft-400";

export const CHECKOUT_FIELD_LABEL =
  "block font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400";

export interface CheckoutSurfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ariaLabel: string;
  title: ReactNode;
  description: string;
  layout: CheckoutLayout;
  preventClose?: boolean;
  hideCloseButton?: boolean;
  children: ReactNode;
}

/**
 * Route-local adaptive checkout surface. Desktop keeps the shared DialogShell;
 * mobile uses the PWA bottom sheet primitive without changing global dialog
 * behavior.
 */
export function CheckoutSurface({
  open,
  onOpenChange,
  ariaLabel,
  title,
  description,
  layout,
  preventClose = false,
  hideCloseButton = false,
  children,
}: CheckoutSurfaceProps) {
  const { formatMessage } = useIntl();
  const isMobile = useMediaQuery("(max-width: 639px)");
  const handleClose = () => {
    if (!preventClose) onOpenChange(false);
  };
  const closeLabel = formatMessage({ id: "app.common.close", defaultMessage: "Close" });

  if (isMobile) {
    return (
      <PwaSheet
        open={open}
        onClose={handleClose}
        ariaLabel={ariaLabel}
        testId="vault-checkout-sheet"
        showDragHandle={!hideCloseButton}
        dragToDismiss={!preventClose}
        overlayClassName="vault-checkout-mobile-overlay"
        panelClassName={cn(
          "vault-checkout-mobile-panel vault-checkout-surface rounded-t-none",
          layout === "compact" ? "vault-checkout-surface--compact" : "vault-checkout-surface--flow",
          layout === "compact" ? "h-auto max-h-[92dvh]" : "h-[92dvh] max-h-[92dvh]"
        )}
        panelStyle={{ maxHeight: "92dvh" }}
        autoFocusSelector='[data-testid="vault-checkout-sheet-close"]'
      >
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stroke-soft-200 px-4 py-3">
            <div className="min-w-0">
              <h2 className="text-left">{title}</h2>
              <p className="sr-only">{description}</p>
            </div>
            {!hideCloseButton ? (
              <button
                type="button"
                data-testid="vault-checkout-sheet-close"
                aria-label={closeLabel}
                onClick={handleClose}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-none text-text-sub-600 transition-colors hover:bg-bg-weak-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
              >
                <RiCloseLine className="size-5" aria-hidden />
              </button>
            ) : null}
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        </div>
      </PwaSheet>
    );
  }

  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="xl"
      preventClose={preventClose}
      hideCloseButton={hideCloseButton}
      className={cn(
        "vault-checkout-surface flex flex-col",
        layout === "compact" ? "vault-checkout-surface--compact" : "vault-checkout-surface--flow",
        layout === "compact" ? "h-auto" : "h-[min(40rem,90vh)]"
      )}
      headerClassName="px-4 py-2 sm:px-5 sm:py-2"
      descriptionClassName="sr-only"
      bodyClassName={cn(
        "flex min-h-0 flex-col overflow-hidden !p-0 sm:!p-0 max-h-none",
        layout === "flow" ? "flex-1" : ""
      )}
    >
      {children}
    </DialogShell>
  );
}

/**
 * One checkout step. Compact layout hugs content for setup and short system
 * errors; flow layout keeps long routes scrollable with an optional pinned footer.
 */
export function CheckoutScreen({
  children,
  footer,
  layout = "flow",
}: {
  children: ReactNode;
  footer?: ReactNode;
  layout?: CheckoutLayout;
}) {
  if (layout === "compact") {
    return (
      <div className="flex max-h-[inherit] min-h-0 flex-col">
        <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
        {footer ? (
          <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 px-4 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">{children}</div>
      {footer ? (
        <div className="shrink-0 border-t border-stroke-soft-200 bg-bg-white-0 px-4 py-4 sm:px-6">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export interface CheckoutSummaryItem {
  label: string;
  value: ReactNode;
  /** Render the value in a mono, break-all treatment (addresses). */
  mono?: boolean;
}

/**
 * Compact, read-only strip of decisions already made (amount, method, email,
 * receiver). Replaces keeping full previous sections visible; an optional Edit
 * affordance lets the user step back while the value path is still unlocked.
 */
export function CheckoutSummary({
  items,
  onEdit,
  editLabel,
}: {
  items: CheckoutSummaryItem[];
  onEdit?: () => void;
  editLabel?: string;
}) {
  const { formatMessage } = useIntl();
  return (
    <div className="rounded-none border border-stroke-soft-200 bg-bg-weak-50 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <dl className="grid min-w-0 flex-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
                {item.label}
              </dt>
              <dd
                className={
                  item.mono
                    ? "mt-0.5 break-all font-mono text-xs text-text-sub-600"
                    : "mt-0.5 text-sm text-text-strong-950"
                }
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="shrink-0 rounded-none px-2 py-1 text-xs font-semibold text-primary-base underline-offset-2 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-1"
          >
            {editLabel ??
              formatMessage({ id: "public.vaults.checkout.edit", defaultMessage: "Edit" })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CheckoutStageHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="flex flex-col gap-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-soft-400">
        {eyebrow}
      </p>
      <h3 className="font-serif text-xl font-normal leading-tight text-text-strong-950">{title}</h3>
      <p className="text-sm leading-[1.55] text-text-sub-600">{description}</p>
    </header>
  );
}

/** Method choice tile — squared, with a non-color selected cue (check + ring). */
export function CheckoutMethodTile({
  method,
  label,
  subtitle,
  selected,
  disabled,
  onSelect,
}: {
  method: CheckoutMethod;
  label: string;
  subtitle: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (method: CheckoutMethod) => void;
}) {
  return (
    <button
      type="button"
      data-testid={`vault-checkout-method-${method}`}
      onClick={() => onSelect(method)}
      aria-pressed={selected}
      disabled={disabled}
      className={`flex items-start justify-between gap-2 rounded-none border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-primary-action bg-editorial-warm ring-1 ring-primary-action"
          : "border-stroke-soft-200 bg-bg-white-0 hover:bg-editorial-warm/40"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <span className="flex flex-col gap-0.5">
        <span className="font-serif text-base text-text-strong-950">{label}</span>
        <span className="text-[11px] text-text-soft-400">{subtitle}</span>
      </span>
      {selected ? (
        <RiCheckLine className="mt-0.5 h-4 w-4 shrink-0 text-primary-base" aria-hidden />
      ) : null}
    </button>
  );
}
