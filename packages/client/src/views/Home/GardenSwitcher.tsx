import { GardenBannerFallback } from "@green-goods/shared/components/Display/GardenBannerFallback";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { Garden } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { RiArrowRightSLine, RiCompass3Line } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";
import { AppSheet } from "@/components/Sheets/AppSheet";
import type { SwitcherRow } from "./homeGardens";

export interface GardenSwitcherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * `choose` is the one-time chooser for a member with several gardens and none remembered
   * (DL-123); `switch` is the chip's switcher.
   */
  mode: "switch" | "choose";
  rows: readonly SwitcherRow[];
  /** One of the member's gardens: it becomes the active garden, and Home stays. */
  onPick: (gardenId: string) => void;
  /** A garden awaiting review: a visit, which never switches the garden. */
  onVisit: (gardenId: string) => void;
  onExplore: () => void;
}

const STANDING_LABEL_IDS = {
  owner: "app.roles.owner",
  steward: "app.roles.steward",
  evaluator: "app.roles.evaluator",
  gardener: "app.roles.gardener",
  awaiting: "app.home.awaitingReview",
} as const satisfies Record<SwitcherRow["standing"], string>;

const ROW_CLASS =
  "flex h-16 w-full min-w-0 items-center gap-3 rounded-[var(--gg-row-radius)] px-3 text-left transition-colors duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--focus-ring))]";

function Avatar({ children, ringed = false }: { children: ReactNode; ringed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-bg-weak text-text-strong",
        ringed && "ring-2 ring-primary-on-surface"
      )}
    >
      {children}
    </span>
  );
}

function RowText({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate type-card-title text-text-strong" title={title}>
        {title}
      </span>
      <span className="truncate type-meta text-text-sub" title={detail}>
        {detail}
      </span>
    </span>
  );
}

function GardenBanner({ garden }: { garden: Garden }) {
  return (
    <ImageWithFallback
      src={garden.bannerImage || ""}
      alt=""
      className="absolute inset-0 h-full w-full object-cover"
      backgroundFallback={<GardenBannerFallback name={garden.name} />}
    />
  );
}

/**
 * The garden switcher (DL-125): a half sheet, Your Gardens, with one row per garden of the
 * member's (its banner, its place and the member's role), the active one a tinted row with a
 * ring on its picture and no check mark, so every role keeps one slot; then the gardens the
 * member asked to join, Awaiting review, and Explore Gardens last. Only a pick among the
 * member's own gardens switches; a garden awaiting review is a visit.
 */
export function GardenSwitcherSheet({
  isOpen,
  onClose,
  mode,
  rows,
  onPick,
  onVisit,
  onExplore,
}: GardenSwitcherSheetProps) {
  const { formatMessage } = useIntl();
  const memberCount = rows.filter(({ standing }) => standing !== "awaiting").length;

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      size="half"
      header={
        mode === "choose"
          ? {
              title: formatMessage({ id: "app.home.chooser.title" }),
              description: formatMessage({ id: "app.home.chooser.description" }),
            }
          : {
              title: formatMessage({ id: "app.home.switcher.title" }),
              description: formatMessage(
                { id: "app.home.switcher.description" },
                { count: memberCount }
              ),
            }
      }
    >
      <ul className="flex flex-col gap-1">
        {rows.map(({ garden, standing, active }) => {
          const awaiting = standing === "awaiting";
          return (
            <li key={garden.id}>
              <button
                type="button"
                data-pressable="row"
                aria-current={active ? "true" : undefined}
                onClick={() => (awaiting ? onVisit(garden.id) : onPick(garden.id))}
                className={cn(
                  ROW_CLASS,
                  active ? pwaStatusStyles.primary.surface : "hover:bg-bg-weak"
                )}
              >
                <Avatar ringed={active}>
                  <GardenBanner garden={garden} />
                </Avatar>
                <RowText title={garden.name} detail={garden.location} />
                <StatusBadge
                  size="xs"
                  variant={awaiting ? "warning" : "neutral"}
                  showIcon={false}
                  className="shrink-0"
                >
                  {formatMessage({ id: STANDING_LABEL_IDS[standing] })}
                </StatusBadge>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="my-1 border-t border-stroke-soft-200" />
      <button
        type="button"
        data-pressable="row"
        onClick={onExplore}
        className={cn(ROW_CLASS, "hover:bg-bg-weak")}
      >
        <Avatar>
          <RiCompass3Line className="h-5 w-5" />
        </Avatar>
        <RowText
          title={formatMessage({ id: "app.home.explore.title" })}
          detail={formatMessage({ id: "app.home.explore.row" })}
        />
        <RiArrowRightSLine aria-hidden="true" className="h-5 w-5 shrink-0 text-text-soft" />
      </button>
    </AppSheet>
  );
}
