import { RiArrowRightLine } from "@remixicon/react";
import { type ComponentType, type HTMLAttributes, type ReactNode, useMemo } from "react";
import { useIntl } from "react-intl";
import { cn } from "../../utils";
import { Button } from "../Button";
import { Surface } from "../Surface";
import { useFabConfig } from "./FabContext";
import type { FabConfig } from "./NavigationBar";
import { useCanvasMobileChromeHidden } from "./useCanvasMobileChromeHidden";

export interface CanvasMetaStripItem {
  id?: string;
  label: ReactNode;
  value?: ReactNode;
}

export interface CanvasMetaStripProps {
  items: CanvasMetaStripItem[];
  className?: string;
}

export function CanvasMetaStrip({ items, className }: CanvasMetaStripProps) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 max-[599px]:gap-1.5", className)}>
      {items.map((item, index) => (
        <span
          key={item.id ?? `meta-${index}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-bg-soft px-3 py-2 text-[0.72rem] font-semibold tracking-[0.01em] text-text-sub shadow-[var(--edge-rest)]"
        >
          {item.value ? <span className="font-bold text-text-strong">{item.value}</span> : null}
          <span>{item.label}</span>
        </span>
      ))}
    </div>
  );
}

export interface CanvasStageTab {
  id: string;
  label: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  count?: number;
  disabled?: boolean;
}

export interface CanvasStageTabRailProps {
  tabs: CanvasStageTab[];
  activeId: string;
  ariaLabel: string;
  onChange: (id: string) => void;
  idBase?: string;
  className?: string;
}

export function CanvasStageTabRail({
  tabs,
  activeId,
  ariaLabel,
  onChange,
  idBase,
  className,
}: CanvasStageTabRailProps) {
  const activeIndex = Math.max(
    tabs.findIndex((tab) => tab.id === activeId),
    0
  );

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative isolate flex w-full rounded-lg px-[var(--canvas-stage-pad-x)] py-[var(--canvas-stage-pad-y)] [--canvas-stage-pad-x:0.25rem] [--canvas-stage-pad-y:0.25rem] max-[599px]:rounded-none max-[599px]:[--canvas-stage-pad-x:0.75rem] max-[599px]:[--canvas-stage-pad-y:0.35rem]",
        "bg-[linear-gradient(180deg,rgb(244_242_236/0.9)_0%,rgb(238_235_229/0.7)_100%)] dark:bg-bg-sub/80",
        className
      )}
      style={{
        boxShadow: "var(--edge-rest), inset 0 -1px 2px rgb(0 0 0 / 0.04)",
      }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-0 motion-reduce:transition-none"
        style={{
          top: "var(--canvas-stage-pad-y)",
          bottom: "var(--canvas-stage-pad-y)",
          left: "var(--canvas-stage-pad-x)",
          width: `calc((100% - (var(--canvas-stage-pad-x) * 2)) / ${Math.max(tabs.length, 1)})`,
          transform: `translateX(${activeIndex * 100}%)`,
          transition: `transform var(--spring-medium-duration,300ms) var(--spring-medium-easing,cubic-bezier(0.16,1,0.3,1))`,
        }}
      >
        <div
          className="h-full rounded-md bg-[rgb(var(--ws-primary-container,var(--blue-100)))] dark:bg-bg-soft"
          style={{
            boxShadow: "var(--edge-rest), 0 8px 20px rgba(133, 109, 70, 0.1)",
          }}
        />
      </div>

      {tabs.map((tab) => {
        const active = activeId === tab.id;
        const Icon = tab.icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${tab.id}` : undefined}
            aria-selected={active}
            aria-controls={idBase ? `${idBase}-panel` : undefined}
            data-active={active ? "true" : "false"}
            data-disabled={tab.disabled ? "true" : "false"}
            disabled={tab.disabled}
            onClick={() => {
              if (!tab.disabled) onChange(tab.id);
            }}
            className={cn(
              "relative z-[1] inline-flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 rounded-md px-4 py-3 text-[0.92rem] font-semibold text-text-sub transition-[transform,color,opacity] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base motion-reduce:transition-none max-[599px]:min-h-[3.4rem] max-[599px]:min-w-0 max-[599px]:flex-col max-[599px]:gap-1 max-[599px]:px-[0.35rem] max-[599px]:py-[0.55rem] max-[599px]:text-[0.78rem] max-[599px]:leading-[1.05]",
              active
                ? "-translate-y-[1px] text-[rgb(var(--ws-on-primary-container,var(--blue-900)))]"
                : "text-text-sub hover:text-text-strong active:translate-y-[1px]",
              tab.disabled && "cursor-not-allowed opacity-45 shadow-none"
            )}
          >
            <span className="flex items-center gap-1.5 max-[599px]:flex-col max-[599px]:gap-1">
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              <span className="truncate">{tab.label}</span>
            </span>
            {tab.count !== undefined ? (
              <span
                className={cn(
                  "inline-flex min-w-6 items-center justify-center rounded-full bg-white/74 px-2 py-0.5 text-[0.72rem] font-bold leading-none text-text-soft shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)] transition-[background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none max-[599px]:min-w-[1.35rem] max-[599px]:px-[0.35rem] max-[599px]:text-[0.68rem]",
                  active &&
                    "bg-primary-alpha-10 text-text-strong shadow-[inset_0_0_0_1px_rgba(var(--workspace-tint),0.14)]"
                )}
              >
                {tab.count > 99 ? "99+" : tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function CanvasWorkbenchList({
  children,
  className,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "overflow-hidden rounded-xl divide-y divide-black/5 dark:divide-white/5",
        "glass-raised",
        className
      )}
      style={{
        boxShadow: "var(--edge-rest), var(--elevation-1)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export type CanvasWorkbenchTone = "pending" | "approved" | "certify" | "history";

export interface CanvasWorkbenchRowProps {
  eyebrow: string;
  title: string;
  description: string;
  meta: string[];
  statusLabel: string;
  statusTone: CanvasWorkbenchTone;
  leadingIcon: ComponentType<{ className?: string }>;
  thumbnailSrc?: string | null;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}

function getStatusToneClasses(tone: CanvasWorkbenchTone) {
  if (tone === "pending") return "bg-warning-lighter/95 text-warning-dark";
  if (tone === "approved") return "bg-success-lighter/95 text-success-dark";
  if (tone === "certify") return "bg-primary-alpha-10 text-text-strong";
  return "bg-bg-soft text-text-sub shadow-[var(--edge-rest)]";
}

export function CanvasWorkbenchRow({
  eyebrow,
  title,
  description,
  meta,
  statusLabel,
  statusTone,
  leadingIcon: LeadingIcon,
  thumbnailSrc,
  selected = false,
  disabled = false,
  onClick,
  className,
}: CanvasWorkbenchRowProps) {
  const content = (
    <>
      <div
        className="flex w-[3.75rem] items-center justify-center max-[599px]:w-12"
        aria-hidden="true"
      >
        {thumbnailSrc ? (
          <img
            src={thumbnailSrc}
            alt=""
            loading="lazy"
            draggable={false}
            className="h-14 w-14 rounded-2xl object-cover shadow-[var(--edge-rest),0_10px_18px_rgba(38,28,18,0.08)] max-[599px]:h-11 max-[599px]:w-11 max-[599px]:rounded-[0.85rem]"
          />
        ) : (
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-soft dark:bg-bg-sub text-primary-base shadow-[var(--edge-rest),0_10px_18px_rgba(38,28,18,0.05)] max-[599px]:h-11 max-[599px]:w-11 max-[599px]:rounded-[0.85rem]">
            <LeadingIcon className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-sm text-text-soft">{eyebrow}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-1 text-[0.72rem] font-bold tracking-[0.01em]",
              getStatusToneClasses(statusTone)
            )}
          >
            {statusLabel}
          </span>
        </div>
        <h3 className="mt-[0.32rem] text-title-md text-text-strong">{title}</h3>
        <p className="mt-[0.2rem] max-w-[60ch] text-body-md text-text-sub">{description}</p>
        <div className="mt-[0.55rem] flex flex-wrap gap-[0.45rem]">
          {meta.map((value) => (
            <span
              key={`${title}-${value}`}
              className="inline-flex items-center rounded-full bg-bg-soft px-2.5 py-[0.34rem] text-body-sm font-semibold text-text-sub shadow-[var(--edge-rest)]"
            >
              {value}
            </span>
          ))}
        </div>
      </div>

      <div
        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-bg-soft text-text-sub shadow-[var(--edge-rest)] max-[599px]:hidden"
        aria-hidden="true"
      >
        <RiArrowRightLine className="h-4 w-4" />
      </div>
    </>
  );

  const sharedClassName = cn(
    "relative grid w-full items-center gap-[0.875rem] px-4 py-3 text-left transition-[background-color,transform,box-shadow,filter] duration-200 ease-out motion-reduce:transition-none max-[599px]:grid-cols-[auto_minmax(0,1fr)] max-[599px]:gap-3 max-[599px]:px-[0.8rem] max-[599px]:py-[0.85rem]",
    "grid-cols-[auto_minmax(0,1fr)_auto]",
    selected &&
      "bg-[rgb(var(--ws-primary-container)/0.12)] shadow-[0_0_0_1px_rgba(var(--workspace-tint),0.22),0_10px_24px_rgba(38,28,18,0.05)]",
    disabled && "cursor-default opacity-60 shadow-none",
    onClick &&
      !disabled &&
      "cursor-pointer hover:-translate-y-0.5 transition duration-[var(--spring-fast-duration)] hover:bg-bg-weak dark:hover:bg-bg-sub/60 hover:shadow-[var(--edge-rest),0_8px_18px_rgba(38,28,18,0.05)] active:translate-y-0 active:scale-[0.998] active:bg-[#fff8ec] dark:active:bg-bg-sub active:shadow-[0_0_0_1px_rgba(var(--workspace-tint),0.14),0_4px_10px_rgba(38,28,18,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-base",
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        data-selected={selected ? "true" : "false"}
        data-disabled={disabled ? "true" : "false"}
        className={sharedClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      data-selected={selected ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
      className={sharedClassName}
    >
      {content}
    </div>
  );
}

export function CanvasEmptyStateShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Surface
      elevation="ground"
      radius="xl"
      className={cn(
        "flex items-center justify-center p-6",
        "bg-[linear-gradient(180deg,rgb(255_255_255/0.62)_0%,rgb(249_247_242/0.82)_100%)] dark:bg-bg-soft/60",
        className
      )}
      style={{
        minHeight: "min(24rem, 48vh)",
        boxShadow: "var(--edge-rest)",
      }}
    >
      {children}
    </Surface>
  );
}

export function CanvasSheetFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex flex-col gap-4 p-1.5", className)}>{children}</div>;
}

export interface CanvasMobilePrimaryAction {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}

export interface UseCanvasResponsiveFabOptions {
  fab: FabConfig | null;
  isDesktop: boolean;
  blocked?: boolean;
  allowMobilePrimaryAction?: boolean;
}

export function useCanvasResponsiveFab({
  fab,
  isDesktop,
  blocked = false,
  allowMobilePrimaryAction = true,
}: UseCanvasResponsiveFabOptions): CanvasMobilePrimaryAction | null {
  const { formatMessage } = useIntl();
  useFabConfig(isDesktop && !blocked ? fab : null);

  return useMemo(() => {
    if (isDesktop || blocked || !allowMobilePrimaryAction || !fab) return null;

    const primaryAction = fab.actions[0];
    if (!primaryAction) return null;

    return {
      icon: primaryAction.icon,
      label: formatMessage({
        id: primaryAction.labelId,
        defaultMessage: primaryAction.label,
      }),
      onClick: () => fab.onAction(primaryAction.id),
    };
  }, [allowMobilePrimaryAction, blocked, fab, formatMessage, isDesktop]);
}

export function CanvasMobileActionSlot({
  action,
  className,
  buttonClassName,
}: {
  action: CanvasMobilePrimaryAction | null;
  className?: string;
  buttonClassName?: string;
}) {
  const hideMobileChrome = useCanvasMobileChromeHidden();

  if (hideMobileChrome) return null;
  if (!action) return null;

  const Icon = action.icon;

  return (
    <div
      className={cn(
        "pointer-events-none sticky bottom-[calc(env(safe-area-inset-bottom)+5rem)] z-[7] flex justify-end px-3 pb-2 pt-1 min-[600px]:hidden",
        className
      )}
    >
      <div className="pointer-events-auto ml-auto w-auto max-w-full">
        <Button
          onClick={action.onClick}
          size="lg"
          className={cn(
            "min-h-12 min-w-[10rem] max-w-[min(15rem,calc(100vw-1.5rem))] justify-center rounded-full px-4.5 shadow-[0_14px_30px_rgba(38,28,18,0.14)] transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none active:translate-y-px active:shadow-[0_8px_18px_rgba(38,28,18,0.16)]",
            buttonClassName
          )}
        >
          <Icon className="h-5 w-5" />
          {action.label}
        </Button>
      </div>
    </div>
  );
}
