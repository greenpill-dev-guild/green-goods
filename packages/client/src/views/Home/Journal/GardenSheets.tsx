// Command Surface: the garden's sections as tall sheets over Home (DL-128).
import { GardenBannerFallback } from "@green-goods/shared/components/Display/GardenBannerFallback";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import { type GardenAccess, GardenTab } from "@green-goods/shared/hooks/garden/useGardenTabs";
import { useWorks } from "@green-goods/shared/hooks/work/useWorks";
import { type GardenSheet, useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import { useState } from "react";
import { useIntl } from "react-intl";

import { ConvictionSheet, EndowmentSheet } from "@/components/Sheets";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { APP_ROUTES } from "@/config/pwaRouting";
import { GardenSection } from "../Garden/GardenSection";

const SECTION_TABS: Record<GardenSheet, GardenTab> = {
  work: GardenTab.Work,
  insights: GardenTab.Insights,
  gardeners: GardenTab.Gardeners,
};

const SECTION_TITLE_IDS: Record<GardenSheet, string> = {
  work: "app.garden.work",
  insights: "app.garden.insights",
  gardeners: "app.garden.gardeners",
};

export interface GardenSheetsProps {
  /** The active garden's record. */
  garden: Garden;
  /** Who may do what in it, as the garden page answers it (`useGardenAccess`). */
  access: GardenAccess;
  /** The Endowment sheet, opened from the About row for reviewers and depositors. */
  endowment: { isOpen: boolean; onClose: () => void };
  /** The governance sheet, opened from the About row while its flag is on. */
  governance: { isOpen: boolean; onClose: () => void };
}

/**
 * The sheets Home's About section owns (DL-128): the garden's Work, Insights or Gardeners as
 * one `tall` sheet with the section's content under the shared header and the garden named
 * beneath the title, plus the garden page's Endowment and governance sheets. The sections are
 * the garden page's own (`GardenSection`), not copies: the Work sheet lists pending work first
 * as the Work tab does and sends a work's page back to Home, the Insights sheet opens with the
 * garden's banner when it has one and keeps the assessments as read-only rows, and the Gardeners
 * sheet puts a steward's join-request queue first. Closing any of them returns to Home where it
 * was, with focus on the row that opened it.
 */
export function GardenSheets({ garden, access, endowment, governance }: GardenSheetsProps) {
  const { formatMessage } = useIntl();
  const gardenSheet = useUIStore((state) => state.gardenSheet);
  const closeGardenSheet = useUIStore((state) => state.closeGardenSheet);
  // The last section stays drawn while its sheet slides out.
  const [shown, setShown] = useState<GardenSheet>(gardenSheet ?? "work");
  if (gardenSheet && gardenSheet !== shown) setShown(gardenSheet);
  // The garden's work, under the Work tab's own cache key, so Home and the page never disagree.
  const workRead = useWorks(garden.id, { offline: true });
  const gardenName = garden.name;

  return (
    <>
      <AppSheet
        isOpen={gardenSheet !== null}
        onClose={closeGardenSheet}
        size="tall"
        header={{
          title: formatMessage({ id: SECTION_TITLE_IDS[shown] }),
          description: formatMessage({ id: "app.common.inGarden" }, { garden: gardenName }),
        }}
      >
        {shown === "insights" && garden.bannerImage ? (
          <div
            data-testid="garden-sheet-banner"
            className="relative h-36 shrink-0 overflow-hidden rounded-2xl"
          >
            <ImageWithFallback
              src={garden.bannerImage}
              alt=""
              loading="eager"
              className="absolute inset-0 h-full w-full object-cover object-center"
              backgroundFallback={
                <GardenBannerFallback name={gardenName} className="rounded-2xl" />
              }
            />
          </div>
        ) : null}
        <GardenSection
          garden={garden}
          tab={SECTION_TABS[shown]}
          workRead={workRead}
          pool={undefined}
          canManageRequests={access.canManageRequests}
          workReturnTo={APP_ROUTES.home}
        />
      </AppSheet>
      <EndowmentSheet
        isOpen={endowment.isOpen}
        onClose={endowment.onClose}
        gardenAddress={garden.id as Address}
        gardenName={gardenName}
      />
      {access.showGovernance ? (
        <ConvictionSheet
          isOpen={governance.isOpen}
          onClose={governance.onClose}
          gardenAddress={garden.id as Address}
          gardenName={gardenName}
        />
      ) : null}
    </>
  );
}
