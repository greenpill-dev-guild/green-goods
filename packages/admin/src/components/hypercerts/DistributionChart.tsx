import { type AllowlistEntry, TOTAL_UNITS } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

/** Threshold percentage below which segments are grouped into "Others" */
const OTHERS_THRESHOLD = 5;

/** Color palette for distribution chart segments */
const CHART_COLORS = [
  "var(--color-primary-base)",
  "var(--color-success-base)",
  "var(--color-warning-base)",
  "var(--color-info-base)",
  "var(--color-primary-dark)",
  "var(--color-success-dark)",
  "var(--color-warning-dark)",
  "var(--color-info-dark)",
];

/** Color for the "Others" grouped segment */
const OTHERS_COLOR = "var(--color-bg-soft)";

interface ChartDataItem {
  name: string;
  value: number;
  percentage: number;
  address?: string;
  isOthers?: boolean;
}

interface DistributionChartProps {
  allowlist: AllowlistEntry[];
  totalUnits?: bigint;
  /** Size in pixels for width/height. Defaults to 200. */
  size?: number;
}

/**
 * Donut chart showing the distribution of hypercert units across recipients.
 * Groups segments below 5% into an "Others" category for readability.
 */
export function DistributionChart({
  allowlist,
  totalUnits = TOTAL_UNITS,
  size = 200,
}: DistributionChartProps) {
  const { formatMessage } = useIntl();

  const chartData = useMemo(() => {
    if (!allowlist.length || totalUnits === 0n) return [];

    // Calculate percentages for each entry
    const entries: ChartDataItem[] = allowlist.map((entry) => {
      const percentage = Number((entry.units * 10000n) / totalUnits) / 100;
      const truncatedAddress = `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`;
      return {
        name: entry.label || truncatedAddress,
        value: Number(entry.units),
        percentage,
        address: entry.address,
        isOthers: false,
      };
    });

    // Separate large and small segments
    const largeSegments = entries.filter((e) => e.percentage >= OTHERS_THRESHOLD);
    const smallSegments = entries.filter((e) => e.percentage < OTHERS_THRESHOLD);

    // If there are small segments, group them
    if (smallSegments.length > 0) {
      const othersValue = smallSegments.reduce((sum, e) => sum + e.value, 0);
      const othersPercentage = smallSegments.reduce((sum, e) => sum + e.percentage, 0);

      largeSegments.push({
        name: formatMessage({ id: "app.hypercerts.distribution.chart.others" }),
        value: othersValue,
        percentage: othersPercentage,
        isOthers: true,
      });
    }

    return largeSegments;
  }, [allowlist, totalUnits, formatMessage]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width={size} height={size}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={size * 0.3}
            outerRadius={size * 0.45}
            dataKey="value"
            label={({ percentage }) =>
              percentage >= OTHERS_THRESHOLD ? `${percentage.toFixed(1)}%` : undefined
            }
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${entry.address ?? index}`}
                fill={entry.isOthers ? OTHERS_COLOR : CHART_COLORS[index % CHART_COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload as ChartDataItem;
              return (
                <div className="rounded-lg border border-stroke-soft bg-bg-white p-2 shadow-md">
                  <p className="text-sm font-medium text-text-strong">{data.name}</p>
                  <p className="text-xs text-text-sub">
                    {data.value.toLocaleString()}{" "}
                    {formatMessage({ id: "app.hypercerts.distribution.table.units" })} (
                    {data.percentage.toFixed(2)}%)
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-text-sub">
        {formatMessage(
          { id: "app.hypercerts.distribution.chart.recipients" },
          { count: allowlist.length }
        )}
      </p>
    </div>
  );
}
