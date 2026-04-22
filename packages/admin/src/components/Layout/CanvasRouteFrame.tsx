import { cn } from "@green-goods/shared";
import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { PageHeader } from "./PageHeader";

type CanvasRouteFrameProps = {
  children: ReactNode;
  className?: string;
};

type CanvasRouteContentProps = {
  children: ReactNode;
  className?: string;
  maxWidthClassName?: string;
};

type CanvasRouteHeaderProps = ComponentProps<typeof PageHeader> & {
  maxWidthClassName?: string;
  wrapperClassName?: string;
};

export const DEFAULT_CANVAS_ROUTE_HEADER_WIDTH = "max-w-6xl";

export const CanvasRouteFrame = forwardRef<HTMLDivElement, CanvasRouteFrameProps>(
  ({ children, className }, ref) => (
    <div ref={ref} className={cn("pb-6", className)}>
      {children}
    </div>
  )
);

CanvasRouteFrame.displayName = "CanvasRouteFrame";

export function CanvasRouteContent({
  children,
  className,
  maxWidthClassName = DEFAULT_CANVAS_ROUTE_HEADER_WIDTH,
}: CanvasRouteContentProps) {
  return (
    <div className={cn("mx-auto w-full px-4 sm:px-6", maxWidthClassName, className)}>
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
