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

export const DEFAULT_CANVAS_ROUTE_HEADER_WIDTH = "max-w-6xl";

export const CanvasRouteFrame = forwardRef<HTMLDivElement, CanvasRouteFrameProps>(
  (
    { children, className, "data-component": dataComponent = "CanvasRouteFrame", ...frameProps },
    ref
  ) => (
    <div ref={ref} data-component={dataComponent} {...frameProps} className={cn("pb-6", className)}>
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
  maxWidthClassName = DEFAULT_CANVAS_ROUTE_HEADER_WIDTH,
  ...contentProps
}: CanvasRouteContentProps) {
  return (
    <div
      data-component={dataComponent}
      data-region={dataRegion}
      {...contentProps}
      className={cn("mx-auto w-full px-4 sm:px-6", maxWidthClassName, className)}
    >
      {children}
    </div>
  );
}

export function CanvasRouteHeader({
  maxWidthClassName = DEFAULT_CANVAS_ROUTE_HEADER_WIDTH,
  wrapperClassName,
  ...headerProps
}: CanvasRouteHeaderProps) {
  return (
    <CanvasRouteContent maxWidthClassName={maxWidthClassName} className={wrapperClassName}>
      <PageHeader {...headerProps} />
    </CanvasRouteContent>
  );
}
