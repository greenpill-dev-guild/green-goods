import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiCheckFill } from "@remixicon/react";
import type { ReactNode } from "react";

import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

/**
 * Whether a media step holds what its flow needs: amber until it does, then
 * green with a tick and what counts. It says so as it changes.
 */
export function MediaRulePill({ met, children }: { met: boolean; children: ReactNode }) {
  const tone = met ? pwaStatusStyles.success : pwaStatusStyles.warning;
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1 self-start rounded-full px-2.5 py-1 text-xs font-medium",
        tone.surface,
        tone.text
      )}
    >
      {met ? <RiCheckFill className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
