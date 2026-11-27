// Command Surface: the garden's About entry at the end of Home's journal (DL-128, decision 27).
import { ItemRow } from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useUser } from "@green-goods/shared/hooks/auth/useUser";
import { useGardenAccess } from "@green-goods/shared/hooks/garden/useGardenTabs";
import { useExitPresence } from "@green-goods/shared/hooks/utils/useExitPresence";
import { useUIStore } from "@green-goods/shared/stores/useUIStore";
import type { Garden } from "@green-goods/shared/types/domain";
import { isAddressInList } from "@green-goods/shared/utils/blockchain/address";
import {
  RiBankLine,
  RiBarChartBoxLine,
  RiDashboardLine,
  RiGovernmentLine,
  RiGroupLine,
  RiShareLine,
} from "@remixicon/react";
import { lazy, Suspense, useContext, useMemo, useState } from "react";
import { useIntl } from "react-intl";

import { getPwaSheetExitMs } from "@/components/Pwa/sheetStyles";
import { shareGarden } from "../Garden/shareGarden";
import { focusOnPress } from "./focusOnPress";
import { HomeShownContext } from "./homeShown";
import { JournalSection } from "./JournalSection";

// The sheets carry the garden page's sections, its Endowment and its governance, so they load
// on first use and stay out of the installed app's startup bundle.
const GardenSheets = lazy(() =>
  import("./GardenSheets").then(({ GardenSheets }) => ({ default: GardenSheets }))
);

export interface AboutGardenProps {
  /** The active garden's record. */
  garden: Garden;
  /** This build's Hub address; stories can provide a fictional destination. */
  hubUrl?: string;
}

/**
 * About This Garden (PWA Home step 10, DL-128): the journal's last section, one item row per
 * entry point the garden page kept for members. Insights, Gardeners and the garden's Work open
 * as `full` sheets over Home, so a member reading Home keeps their place; Share shares the
 * garden's link. Stewards of the selected garden see Endowment when it has a vault and the Hub
 * when the build has a Hub URL. Governance follows the garden page's own access rule. Home's
 * header chip names the selected garden.
 *
 * The sheets mount here, because About is always on Home: Recent Activity's See All and a
 * steward's work-to-review row open the Work sheet through the same store flag. Endowment and
 * Governance open from this section's own state, never from the app-wide Endowment flag the
 * garden's page reads, so neither can follow the member onto a garden's page.
 */
export function AboutGarden({
  garden,
  hubUrl = import.meta.env.VITE_ADMIN_APP_URL,
}: AboutGardenProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const { primaryAddress } = useUser();
  const access = useGardenAccess(garden);
  const isSteward = isAddressInList(primaryAddress, garden.stewards);
  const showEndowment = isSteward && access.showEndowment;
  const hub = hubUrl?.trim();
  const gardenSheet = useUIStore((state) => state.gardenSheet);
  const openGardenSheet = useUIStore((state) => state.openGardenSheet);
  const [ownSheet, setOwnSheet] = useState<"endowment" | "governance" | null>(null);
  const closeOwnSheet = () => setOwnSheet(null);
  // Leaving Home closes them with Home's own drawers: they portal past its hidden wrapper.
  const homeShown = useContext(HomeShownContext);
  if ((!homeShown && ownSheet !== null) || (ownSheet === "endowment" && !showEndowment)) {
    setOwnSheet(null);
  }
  // The sheets stay mounted until the closing one's exit has played.
  const sheetsPresent = useExitPresence(
    gardenSheet !== null || ownSheet !== null,
    getPwaSheetExitMs
  );

  // The people the Gardeners sheet lists: stewards and gardeners, each once.
  const memberCount = useMemo(
    () =>
      new Set([...(garden.stewards ?? []), ...(garden.gardeners ?? [])].map((a) => a.toLowerCase()))
        .size,
    [garden.stewards, garden.gardeners]
  );

  const share = () => {
    shareGarden(garden.id, garden.name).catch(() => {
      toastService.error({ title: formatMessage({ id: "app.garden.shareFailed" }) });
    });
  };

  return (
    <>
      <JournalSection
        data-component="AboutGarden"
        title={formatMessage({ id: "app.home.journal.about" })}
      >
        <li>
          <ItemRow
            {...focusOnPress}
            lead={{ kind: "icon", icon: <RiBarChartBoxLine aria-hidden="true" /> }}
            title={formatMessage({ id: "app.garden.insights" })}
            details={[formatMessage({ id: "app.home.journal.about.insights" })]}
            onOpen={() => openGardenSheet("insights")}
          />
        </li>
        <li>
          <ItemRow
            {...focusOnPress}
            lead={{ kind: "icon", icon: <RiGroupLine aria-hidden="true" /> }}
            title={formatMessage({ id: "app.garden.gardeners" })}
            details={[
              formatMessage({ id: "app.home.journal.about.members" }, { count: memberCount }),
            ]}
            onOpen={() => openGardenSheet("gardeners")}
          />
        </li>
        {showEndowment ? (
          <li>
            <ItemRow
              {...focusOnPress}
              lead={{ kind: "icon", icon: <RiBankLine aria-hidden="true" /> }}
              title={formatMessage({ id: "app.treasury.title" })}
              details={
                access.hasEndowmentDeposits
                  ? [formatMessage({ id: "app.home.journal.about.yourDeposit" })]
                  : undefined
              }
              onOpen={() => setOwnSheet("endowment")}
            />
          </li>
        ) : null}
        <li>
          <ItemRow
            lead={{ kind: "icon", icon: <RiShareLine aria-hidden="true" /> }}
            title={formatMessage({ id: "app.garden.share" })}
            details={[formatMessage({ id: "app.home.journal.about.share" })]}
            onOpen={share}
          />
        </li>
        {access.showGovernance ? (
          <li>
            <ItemRow
              {...focusOnPress}
              lead={{ kind: "icon", icon: <RiGovernmentLine aria-hidden="true" /> }}
              title={formatMessage({ id: "app.signal.governance" })}
              onOpen={() => setOwnSheet("governance")}
            />
          </li>
        ) : null}
        {isSteward && hub ? (
          <li>
            <a
              href={hub}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-[var(--gg-card-radius)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--gg-focus-ring))]"
            >
              <ItemRow
                lead={{ kind: "icon", icon: <RiDashboardLine aria-hidden="true" /> }}
                title={formatMessage({ id: "app.profile.help.hub.title" })}
                details={[formatMessage({ id: "app.profile.help.hub.description" })]}
              />
              <span className="sr-only">
                {formatMessage({ id: "app.profile.help.faq.guideNewTab" })}
              </span>
            </a>
          </li>
        ) : null}
      </JournalSection>
      {sheetsPresent ? (
        <Suspense fallback={null}>
          <GardenSheets
            garden={garden}
            access={access}
            endowment={{ isOpen: ownSheet === "endowment", onClose: closeOwnSheet }}
            governance={{ isOpen: ownSheet === "governance", onClose: closeOwnSheet }}
          />
        </Suspense>
      ) : null}
    </>
  );
}
