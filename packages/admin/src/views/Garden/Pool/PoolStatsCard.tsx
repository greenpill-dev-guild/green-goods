import { cn } from "@green-goods/shared/utils/styles/cn";
import { AdminCard } from "@/components/AdminCard";

export interface PoolStat {
  id: string;
  count: number;
  label: string;
  /** Where the count lands: the list or card that holds exactly what it counts. */
  onOpen: () => void;
}

/**
 * What needs the steward, as counts (interaction-patterns §5): one hairline
 * card of columns, the number leading in tabular figures over its label, with
 * no button chrome. A count that lands somewhere is still a real button, named
 * by its number and label; a zero goes nowhere, so it is calm text.
 */
export function PoolStatsCard({ stats, label }: { stats: readonly PoolStat[]; label: string }) {
  return (
    <AdminCard
      variant="outlined"
      density="none"
      className="overflow-hidden"
      data-component="PoolStatsCard"
    >
      <ul className="grid grid-cols-3 divide-x divide-stroke-soft" aria-label={label}>
        {stats.map((stat) => {
          const body = (
            <>
              <span
                className={cn(
                  "block text-lg font-semibold tabular-nums",
                  stat.count > 0 ? "text-text-strong" : "text-text-soft"
                )}
              >
                {stat.count}
              </span>
              <span className="block text-xs text-text-soft">{stat.label}</span>
            </>
          );
          return (
            <li key={stat.id} className="min-w-0" data-stat={stat.id}>
              {stat.count > 0 ? (
                <button
                  type="button"
                  onClick={stat.onOpen}
                  className="m3-state-layer block h-full w-full px-3 py-2 text-left [--state-layer-color:var(--m3-on-surface)]"
                >
                  {body}
                </button>
              ) : (
                <div className="px-3 py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </AdminCard>
  );
}
