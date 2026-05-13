import { cn } from "@green-goods/shared";
import { forwardRef, type ComponentProps, type ComponentPropsWithoutRef } from "react";
import { PageHeader } from "./PageHeader";

type CanvasRouteFrameProps = ComponentPropsWithoutRef<"div">;

type CanvasRouteContentProps = ComponentPropsWithoutRef<"div"> & {
  maxWidthClassName?: string;
};

type CanvasRouteHeaderProps = ComponentProps<typeof PageHeader> & {
  maxWidthClassName?: string;
  wrapperClassName?: string;
};

// Canonical canvas gutter and max-width live on `<main className="main-scroll-area">`
// in CanvasLayout. CanvasRouteFrame renders the per-view outer card (`canvas-route-card`)
// that wraps PageHeader + content with reference-spec internal padding (16/28/40px).
// CanvasRouteContent renders flush inside the card; pass `maxWidthClassName` only when
// a view wants to narrow inward (e.g. forms at `max-w-6xl`).
export const CanvasRouteFrame = forwardRef<HTMLDivElement, CanvasRouteFrameProps>(
  (
    { children, className, "data-component": dataComponent = "CanvasRouteFrame", ...frameProps },
    ref
  ) => (
    <div
      ref={ref}
      data-component={dataComponent}
      {...frameProps}
      className={cn("canvas-route-card", className)}
    >
      {children}
    </div>
  )
);

CanvasRouteFrame.displayName = "CanvasRouteFrame";

export function CanvasRouteContent({
  children,
  className,
  "data-component": dataComponent = "CanvasRouteContent",
  "data-region": dataRegion = "route-content",
  maxWidthClassName,
  ...contentProps
}: CanvasRouteContentProps) {
  return (
    <div
      data-component={dataComponent}
      data-region={dataRegion}
      {...contentProps}
      className={cn(
        "w-full",
        maxWidthClassName ? "mx-auto" : undefined,
        maxWidthClassName,
        className
      )}
    >
      {children}
    </div>
  );
}

export function CanvasRouteHeader({
  maxWidthClassName,
  wrapperClassName,
  ...headerProps
}: CanvasRouteHeaderProps) {
  return (
    <CanvasRouteContent maxWidthClassName={maxWidthClassName} className={wrapperClassName}>
      <PageHeader {...headerProps} />
    </CanvasRouteContent>
  );
}
