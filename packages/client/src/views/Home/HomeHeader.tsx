import type { ReactNode } from "react";
import { StickyTopBar } from "./StickyTopBar";

interface HomeHeaderProps {
  /** The header's lead: the garden chip, or Home's title while the member has no garden. */
  lead: ReactNode;
  /** The launchers at the end: Wallet, Promises and Your Work, with the bell to come last. */
  launchers: ReactNode;
}

/**
 * Home's header (DL-124, DL-127): the chip in the title's place, then the launchers. It stays at
 * the top while Home scrolls, so the chip keeps naming the garden at any scroll position.
 */
export function HomeHeader({ lead, launchers }: HomeHeaderProps) {
  return (
    <StickyTopBar component="HomeHeader" className="justify-between gap-4">
      <div className="flex min-h-12 min-w-0 flex-1 items-center">{lead}</div>
      <div className="flex shrink-0 items-center gap-2">{launchers}</div>
    </StickyTopBar>
  );
}
