import { Button } from "@green-goods/shared/components/Button";
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { Garden } from "@green-goods/shared/types/domain";
import {
  RiCompass3Line,
  RiErrorWarningLine,
  RiLoader4Line,
  RiPlantLine,
  RiSeedlingLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { JoinGardenButton } from "@/components/Features/Garden/JoinGardenButton";
import { HomeSection } from "./HomeSection";

/**
 * Home's states before its journal (DL-123): loading, a failed read, no garden yet, and the
 * prompt a dismissed chooser leaves. Each keeps the header above it; none of them writes the
 * active garden.
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

/** Several gardens and none chosen: the quiet prompt a dismissed chooser leaves. */
export function HomeChoosePrompt({ onChoose }: { onChoose: () => void }) {
  const { formatMessage } = useIntl();
  return (
    <EmptyState
      icon={<RiPlantLine />}
      title={formatMessage({ id: "app.home.chooser.title" })}
      description={formatMessage({ id: "app.home.chooser.description" })}
      action={
        <Button type="button" emphasis="secondary" onClick={onChoose}>
          {formatMessage({ id: "app.home.chooser.action" })}
        </Button>
      }
    />
  );
}

interface HomeFindGardenProps {
  /** Gardens the member asked to join, waiting for a steward. */
  awaiting: readonly Garden[];
  /** The Community Garden while anyone can join it, or null. */
  communityGarden: Garden | null;
  onExplore: () => void;
  /** Opens a garden's page: a visit, which switches nothing. */
  onVisit: (gardenId: string) => void;
}

/**
 * No garden yet: a Home that finds one. Explore, the member's requests awaiting review, and the
 * Community Garden's open door, joined from its row.
 */
export function HomeFindGarden({
  awaiting,
  communityGarden,
  onExplore,
  onVisit,
}: HomeFindGardenProps) {
  const { formatMessage } = useIntl();
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
      {awaiting.length > 0 ? (
        <HomeSection title={formatMessage({ id: "app.home.requests.title" })}>
          {awaiting.map((garden) => (
            <ItemRow
              key={garden.id}
              lead={{ kind: "photo", src: garden.bannerImage, fallbackIcon: RiSeedlingLine }}
              title={garden.name}
              status={{ label: formatMessage({ id: "app.home.awaitingReview" }), tone: "warning" }}
              details={[garden.location]}
              onOpen={() => onVisit(garden.id)}
            />
          ))}
        </HomeSection>
      ) : null}
      {communityGarden ? (
        <HomeSection
          title={formatMessage({ id: "app.garden.communityOnramp.title" })}
          description={formatMessage({ id: "app.garden.communityOnramp.description" })}
        >
          <ItemRow
            lead={{ kind: "photo", src: communityGarden.bannerImage, fallbackIcon: RiSeedlingLine }}
            title={communityGarden.name}
            status={{ label: formatMessage({ id: "app.home.explore.tag.open" }), tone: "success" }}
            details={[communityGarden.location]}
            onOpen={() => onVisit(communityGarden.id)}
            action={
              <JoinGardenButton gardenId={communityGarden.id} gardenName={communityGarden.name} />
            }
          />
        </HomeSection>
      ) : null}
    </div>
  );
}
