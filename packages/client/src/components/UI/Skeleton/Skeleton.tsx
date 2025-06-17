import React from "react";
import { cn } from "@/utils/cn";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "rectangular" | "circular" | "text" | "rounded";
  width?: string | number;
  height?: string | number;
  animation?: "pulse" | "wave" | "none";
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "rectangular",
  width,
  height,
  animation = "pulse",
  className,
  style,
  ...props
}) => {
  const variantClasses = {
    rectangular: "rounded-none",
    circular: "rounded-full",
    text: "rounded-sm",
    rounded: "rounded-lg",
  };

  const animationClasses = {
    pulse: "animate-pulse",
    wave: "animate-wave",
    none: "",
  };

  const inlineStyle = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    ...style,
  };

  return (
    <div
      className={cn(
        "bg-gray-200 dark:bg-gray-700",
        variantClasses[variant],
        animationClasses[animation],
        className
      )}
      style={inlineStyle}
      {...props}
    />
  );
};

// Predefined skeleton components for common use cases
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className,
}) => (
  <div className={cn("space-y-2", className)}>
    {Array.from({ length: lines }, (_, i) => (
      <Skeleton key={i} variant="text" height={16} width={i === lines - 1 ? "75%" : "100%"} />
    ))}
  </div>
);

export const SkeletonCard: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cn("space-y-4 p-4", className)}>
    <div className="flex items-center space-x-4">
      <Skeleton variant="circular" width={40} height={40} />
      <div className="space-y-2 flex-1">
        <Skeleton variant="text" height={16} width="60%" />
        <Skeleton variant="text" height={12} width="40%" />
      </div>
    </div>
    <Skeleton variant="rounded" height={200} />
    <SkeletonText lines={3} />
  </div>
);

export const SkeletonList: React.FC<{
  items?: number;
  showAvatar?: boolean;
  className?: string;
}> = ({ items = 5, showAvatar = true, className }) => (
  <div className={cn("space-y-4", className)}>
    {Array.from({ length: items }, (_, i) => (
      <div key={i} className="flex items-center space-x-4">
        {showAvatar && <Skeleton variant="circular" width={32} height={32} />}
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" height={14} width="80%" />
          <Skeleton variant="text" height={12} width="60%" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonButton: React.FC<{
  size?: "small" | "medium" | "large";
  className?: string;
}> = ({ size = "medium", className }) => {
  const sizeMap = {
    small: { height: 32, width: 80 },
    medium: { height: 40, width: 120 },
    large: { height: 48, width: 160 },
  };

  return <Skeleton variant="rounded" {...sizeMap[size]} className={className} />;
};
