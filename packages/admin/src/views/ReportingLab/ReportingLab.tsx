/**
 * Garden reporting lab: a Storybook-only prototype of reporting in the steward dashboard.
 * Not routed and not imported by the app. The product preview renders the cockpit's real
 * chrome (AppBar with GardenChip, MainSheet, NavigationBar) around the proposed Reports
 * page; the reviewer's controls sit above it and never mix into it. Every number comes
 * from synthetic sample data at a fixed date.
 */
import { GardenChip } from "@green-goods/shared/components/Canvas/GardenChip";
import { useMemo, useState } from "react";
import { IntlProvider, useIntl } from "react-intl";
import { AppBar } from "@/components/Shell/AppBar";
import { MainSheet } from "@/components/Shell/MainSheet";
import { NavigationBar } from "@/components/Shell/NavigationBar";
import { LAB_NAV_SLOTS, labGardens, scenarioForGarden } from "./labShell";
import type { MediaSet } from "./model";
import { ReportsPage } from "./ReportsPage";
import { type LabControls, ReviewerBar } from "./ReviewerBar";
import { buildScenario, type ScenarioId } from "./scenarios";
import { defaultScope, type ReportScope } from "./scope";

export interface ReportingLabProps {
  media: MediaSet;
  initial?: Partial<LabControls>;
  /** Starting month and filters, for a story that opens on a particular scope. */
  initialScope?: Partial<ReportScope>;
  /** Hide the reviewer's controls to see the product preview alone. */
  showReviewer?: boolean;
}

export function ReportingLab({
  media,
  initial,
  initialScope,
  showReviewer = true,
}: ReportingLabProps) {
  const intl = useIntl();
  const [controls, setControls] = useState<LabControls>({
    scenario: "compost",
    view: "overview",
    role: "steward",
    nameId: "current",
    hubLabel: "hub",
    panel: "none",
    ...initial,
  });
  const [pages, setPages] = useState(1);
  const dataset = useMemo(
    () => buildScenario(controls.scenario, pages),
    [controls.scenario, pages]
  );
  const [scope, setScope] = useState<ReportScope>(() => ({
    ...defaultScope(buildScenario(controls.scenario), controls.view),
    ...initialScope,
  }));

  const changeControls = (patch: Partial<LabControls>) => {
    setControls((current) => ({ ...current, ...patch }));
    if (patch.view)
      setScope((current) => ({ ...current, view: patch.view as ReportScope["view"] }));
    if (patch.scenario && patch.scenario !== controls.scenario) {
      // A new garden starts on its own month with no filters; the report in view stays.
      setPages(1);
      setScope((current) => ({
        ...defaultScope(buildScenario(patch.scenario as ScenarioId)),
        view: current.view,
      }));
    }
  };
  const changeScope = (patch: Partial<ReportScope>) => {
    setScope((current) => ({ ...current, ...patch }));
    if (patch.view)
      setControls((current) => ({ ...current, view: patch.view as ReportScope["view"] }));
  };

  const gardens = labGardens(media, dataset.garden);
  const messages = useMemo(
    () =>
      controls.hubLabel === "review"
        ? { ...intl.messages, "cockpit.nav.hub": "Review" }
        : intl.messages,
    [controls.hubLabel, intl.messages]
  );

  return (
    <div className="flex min-h-full flex-col" data-component="ReportingLab">
      {showReviewer ? <ReviewerBar controls={controls} onChange={changeControls} /> : null}
      <div
        data-tone="garden"
        className="admin-m3 workspace-canvas relative flex min-h-[48rem] flex-1 flex-col"
      >
        <div className="canvas-area-top px-3 min-[600px]:px-[clamp(0.875rem,1.5vw,1.5rem)]">
          <AppBar
            gardenChip={
              <GardenChip
                gardens={gardens}
                selectedGarden={gardens.find((garden) => garden.id === dataset.garden.id) ?? null}
                onSelectGarden={(garden) => {
                  const scenario = garden ? scenarioForGarden(garden.id) : undefined;
                  if (scenario) changeControls({ scenario });
                }}
                showCreateGardenAction={false}
              />
            }
          />
        </div>
        <MainSheet>
          <main
            id="main-content"
            className="mx-auto w-full max-w-[87.5rem] px-3 pt-2 pb-36 min-[600px]:px-[clamp(0.875rem,1.5vw,1.5rem)] sm:pt-3 lg:pb-28"
          >
            <ReportsPage
              dataset={dataset}
              scope={scope}
              onScopeChange={changeScope}
              media={media}
              role={controls.role}
              onLoadOlder={dataset.loadedFrom !== null ? () => setPages(pages + 1) : undefined}
              onRetry={
                controls.scenario === "error"
                  ? () => changeControls({ scenario: "compost" })
                  : undefined
              }
            />
          </main>
        </MainSheet>
        <div className="canvas-area-bottom">
          <IntlProvider locale={intl.locale} messages={messages}>
            <NavigationBar
              slots={LAB_NAV_SLOTS}
              activePath="/garden"
              onNavigate={() => undefined}
            />
          </IntlProvider>
        </div>
      </div>
    </div>
  );
}
