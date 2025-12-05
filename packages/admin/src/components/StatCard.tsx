import type React from "react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, className = "" }) => {
  return (
    <div
      className={`rounded-lg border border-stroke-soft bg-bg-white p-3 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-4 ${className}`}
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-600">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs uppercase tracking-wide text-text-soft">{label}</p>
          <p className="mt-1 truncate text-xl font-semibold text-text-strong sm:text-2xl">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};
