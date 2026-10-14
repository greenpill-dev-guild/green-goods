import { useIntl } from "react-intl";
import { AdminTooltip } from "@/components/AdminTooltip";
import { exactTime, isoTime } from "./poolTime";

export interface EventTimeProps {
  /** The moment, in milliseconds. */
  ms: number;
  /** How the moment reads where it sits: "Today, 3:42 PM", "Sep 21, 2:18 PM". */
  children: string;
}

/**
 * A moment in a list of events (PRD-1025 D3): it reads the way its list reads
 * it, and hovering it shows the full date, time and zone. A time is not a
 * control, so it takes no focus; the full moment is read out with it instead,
 * and the `<time>` carries it machine-readable.
 */
export function EventTime({ ms, children }: EventTimeProps) {
  const intl = useIntl();
  const exact = exactTime(intl, ms);
  return (
    <AdminTooltip content={exact} placement="bottom">
      <time dateTime={isoTime(ms)} className="underline decoration-dotted underline-offset-2">
        <span aria-hidden="true">{children}</span>
        <span className="sr-only">{exact}</span>
      </time>
    </AdminTooltip>
  );
}
