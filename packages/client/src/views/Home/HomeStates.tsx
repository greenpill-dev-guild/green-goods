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
 * Home's states before its journal (DL-123, DL-155): loading, a failed read, and no active garden.
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
 * No active garden, as at first login (DL-155). A member of no garden finds one: the state block
 * with Explore Gardens, then any gardens they asked to join, whose rows visit and switch nothing.
 * A member of several picks one: their gardens, whose rows make that garden active and open Home,
 * then their requests, with Explore Gardens last.
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
        titleLines={2}
        status={{
          label: formatMessage({ id: STANDING_LABEL_IDS[standing] }),
          tone: awaiting ? "warning" : "neutral",
        }}
        onOpen={() => (awaiting ? onVisit(garden.id) : onPick(garden.id))}
      />
    );
  };
  const member = rows.filter(({ standing }) => standing !== "awaiting");
  const requests = rows.filter(({ standing }) => standing === "awaiting");
  const yourRequests =
    requests.length > 0 ? (
      <HomeSection title={formatMessage({ id: "app.home.requests.title" })}>
        {requests.map(gardenRow)}
      </HomeSection>
    ) : null;
  if (member.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <EmptyState
          icon={<RiCompass3Line />}
          title={formatMessage({ id: "app.home.none.title" })}
          description={formatMessage({ id: "app.home.none.description" })}
          action={
            <Button type="button" onClick={onExplore}>
              {formatMessage({ id: "app.home.explore.title" })}
            </Button>
          }
        />
        {yourRequests}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="type-body text-text-sub-600">
        {formatMessage({ id: "app.home.chooser.description" })}
      </p>
      <HomeSection title={formatMessage({ id: "app.home.switcher.title" })}>
        {member.map(gardenRow)}
      </HomeSection>
      {yourRequests}
      <ItemRow
        lead={{ kind: "icon", icon: <RiCompass3Line /> }}
        title={formatMessage({ id: "app.home.explore.title" })}
        details={[formatMessage({ id: "app.home.explore.row" })]}
        onOpen={onExplore}
      />
    </div>
  );
}
