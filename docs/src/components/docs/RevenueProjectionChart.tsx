import {useMemo} from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {MonteCarloYearBand, ProjectionYearData, RevenueStream} from "./protocolRevenueModel";

interface RevenueProjectionChartProps {
  projectionData: ProjectionYearData[];
  visibleStreams: RevenueStream[];
  streamColors: string[];
  bands?: MonteCarloYearBand[];
  totalExpenses?: number;
}

const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatAxis(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
  return `$${v}`;
}

const axisTick = {fontSize: 11, fill: "var(--ifm-font-color-secondary)"};

export function RevenueProjectionChart({
  projectionData,
  visibleStreams,
  streamColors,
  bands,
  totalExpenses,
}: RevenueProjectionChartProps) {
  const chartData = useMemo(
    () =>
      projectionData.map((yearData) => ({
        year: `Y${yearData.year}`,
        ...yearData.streams,
      })),
    [projectionData],
  );

  const streamKeys = useMemo(() => visibleStreams.map((s) => s.key), [visibleStreams]);

  if (projectionData.length === 0 || streamKeys.length === 0) return null;

  return (
    <>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{top: 4, right: 4, bottom: 0, left: 0}}>
          <XAxis
            dataKey="year"
            tick={axisTick}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={formatAxis}
            tick={axisTick}
            width={52}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={(value: number) => usdFormatter.format(value)}
            contentStyle={{
              background: "var(--ifm-background-color)",
              border: "1px solid var(--ifm-color-emphasis-200)",
              borderRadius: "10px",
              fontSize: "0.82rem",
            }}
            labelStyle={{color: "var(--ifm-font-color-base)"}}
            itemStyle={{color: "var(--ifm-font-color-base)"}}
          />
          {totalExpenses != null && totalExpenses > 0 && (
            <ReferenceLine
              y={totalExpenses}
              stroke="#c46358"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{
                value: `Opex ${formatAxis(totalExpenses)}`,
                position: "right",
                fontSize: 10,
                fill: "#c46358",
              }}
            />
          )}
          {streamKeys.map((key, index) => {
            const stream = visibleStreams.find((s) => s.key === key);
            const color = streamColors[index % streamColors.length];
            return (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={stream?.label ?? key}
                stackId="revenue"
                fill={color}
                stroke={color}
                fillOpacity={0.82}
                strokeWidth={1.5}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>

      {bands && bands.length > 0 && <ConfidenceBands bands={bands} />}
    </>
  );
}

function ConfidenceBands({bands}: {bands: MonteCarloYearBand[]}) {
  const data = useMemo(
    () => bands.map((b) => ({year: `Y${b.year}`, ...b})),
    [bands],
  );

  return (
    <div style={{marginTop: "0.75rem"}}>
      <div
        style={{
          fontSize: "0.78rem",
          fontWeight: 600,
          color: "var(--ifm-font-color-secondary)",
          marginBottom: "0.35rem",
        }}
      >
        Confidence bands (total revenue)
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{top: 4, right: 4, bottom: 0, left: 0}}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--ifm-color-emphasis-200)" />
          <XAxis dataKey="year" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={formatAxis} tick={axisTick} width={52} axisLine={false} tickLine={false} />
          <Tooltip
            formatter={(value: number, name: string) => [
              usdFormatter.format(value),
              name,
            ]}
            contentStyle={{
              background: "var(--ifm-background-color)",
              border: "1px solid var(--ifm-color-emphasis-200)",
              borderRadius: "10px",
              fontSize: "0.78rem",
            }}
            labelStyle={{color: "var(--ifm-font-color-base)"}}
            itemStyle={{color: "var(--ifm-font-color-base)"}}
          />
          <Area
            type="monotone"
            dataKey="p90"
            stroke="none"
            fill="rgba(47, 143, 91, 0.08)"
            fillOpacity={1}
            name="p90"
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="p75"
            stroke="none"
            fill="rgba(47, 143, 91, 0.12)"
            fillOpacity={1}
            name="p75"
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="p25"
            stroke="none"
            fill="var(--ifm-background-color)"
            fillOpacity={1}
            name="p25"
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="p10"
            stroke="none"
            fill="var(--ifm-background-color)"
            fillOpacity={1}
            name="p10"
            legendType="none"
          />
          <Line
            type="monotone"
            dataKey="p90"
            stroke="rgba(47, 143, 91, 0.35)"
            strokeWidth={1}
            strokeDasharray="4 3"
            dot={false}
            name="90th"
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke="#2f8f5b"
            strokeWidth={2}
            dot={false}
            name="Median"
          />
          <Line
            type="monotone"
            dataKey="p10"
            stroke="rgba(47, 143, 91, 0.35)"
            strokeWidth={1}
            strokeDasharray="4 3"
            dot={false}
            name="10th"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
