import { Button } from "@green-goods/shared/components/Button";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import {
  RiCompass3Line,
  RiErrorWarningLine,
  RiLoader4Line,
  RiSeedlingLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { HomeSection } from "./HomeSection";
import { STANDING_LABEL_IDS, type SwitcherRow } from "./homeGardens";

/**
 * Home's states before its journal (DL-123, DL-146): loading, a failed read, and no active garden.
 * Each keeps the header above it.
 */

/** The account's gardens are loading; a remembered garden opens as soon as they arrive. */
export function HomeLoading({ remembered }: { remembered: boolean }) {
  const { formatMessage } = useIntl();
  return (
    <EmptyState
      busy
      icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
      title={formatMessage({ id: remembered ? "app.garden.loading" : "app.home.gardensLoading" })}
    />
  );
}

/** The read failed with nothing remembered: nothing was lost, and Try Again reads again. */
export function HomeError({ onRetry }: { onRetry: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <EmptyState
      tone="error"
      icon={<RiErrorWarningLine />}
      title={formatMessage({ id: "app.home.gardensError.title" })}
      description={formatMessage({ id: "app.home.gardensError.description" })}
      action={
        <Button type="button" onClick={onRetry}>
          {formatMessage({ id: "app.common.tryAgain" })}
        </Button>
      }
    />
  );
}

interface HomeNoActiveGardenProps {
  /** The member's gardens, then the gardens they asked to join (`switcherRows`). */
  rows: readonly SwitcherRow[];
  onExplore: () => void;
  /** One of the member's gardens: it becomes the active garden, and Home opens in it. */
  onPick: (gardenId: string) => void;
  /** A garden the member asked to join: a visit, which switches nothing. */
  onVisit: (gardenId: string) => void;
}

/**
 * No active garden, as at first login (DL-146): Explore first, then the gardens the member
 * belongs to, whose rows make that garden active, then the gardens they asked to join, whose
 * rows visit and switch nothing.
 */
export function HomeNoActiveGarden({ rows, onExplore, onPick, onVisit }: HomeNoActiveGardenProps) {
  const { formatMessage } = useIntl();
  const gardenRow = ({ garden, standing }: SwitcherRow) => {
    const awaiting = standing === "awaiting";
    return (
      <ItemRow
        key={garden.id}
        lead={{ kind: "photo", src: garden.bannerImage, fallbackIcon: RiSeedlingLine }}
        title={garden.name}
        status={{
          label: formatMessage({ id: STANDING_LABEL_IDS[standing] }),
          tone: awaiting ? "warning" : "neutral",
        }}
        details={[garden.location]}
        onOpen={() => (awaiting ? onVisit(garden.id) : onPick(garden.id))}
      />
    );
  };
  const member = rows.filter(({ standing }) => standing !== "awaiting");
  const requests = rows.filter(({ standing }) => standing === "awaiting");
  return (
    <div className="flex flex-col gap-6">
      <ItemRow
        lead={{ kind: "icon", icon: <RiCompass3Line /> }}
        title={formatMessage({ id: "app.home.explore.title" })}
        details={[formatMessage({ id: "app.home.explore.row" })]}
        onOpen={onExplore}
      />
      {member.length > 0 ? (
        <HomeSection title={formatMessage({ id: "app.home.switcher.title" })}>
          {member.map(gardenRow)}
        </HomeSection>
      ) : null}
      {requests.length > 0 ? (
        <HomeSection title={formatMessage({ id: "app.home.requests.title" })}>
          {requests.map(gardenRow)}
        </HomeSection>
      ) : null}
    </div>
  );
}
