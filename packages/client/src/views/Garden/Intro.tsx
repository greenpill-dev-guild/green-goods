import { RiHammerFill, RiPlantFill } from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import {
  ActionCard,
  ActionCardSkeleton,
  FormInfo,
  GardenCard,
  GardenCardSkeleton,
} from "@/components/Cards";
import { Carousel, CarouselContent, CarouselItem } from "@/components/Display";

interface WorkIntroProps {
  actions: Action[];
  gardens: Garden[];
  selectedActionUID: number | null;
  selectedGardenAddress: string | null;
  setActionUID: (value: number | null) => void;
  setGardenAddress: (value: string | null) => void;
}

export const WorkIntro: React.FC<WorkIntroProps> = ({
  actions,
  gardens,
  selectedActionUID,
  selectedGardenAddress,
  setActionUID,
  setGardenAddress,
}) => {
  const intl = useIntl();

  // Filter to only show active actions (current time is within startTime and endTime)
  const activeActions = actions.filter((action) => {
    const now = Date.now();
    return now >= action.startTime && now <= action.endTime;
  });

  // Status comes from parent loader now; show skeletons based on arrays being empty temporarily
  const actionsStatus: "pending" | "success" = actions.length ? "success" : "pending";
  const gardensStatus: "pending" | "success" = gardens.length ? "success" : "pending";
  const uidFromActionId = (id: string): number | null => {
    const last = id.split("-").pop();
    const n = Number(last);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <>
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourAction",
          defaultMessage: "Select your action",
        })}
        info={intl.formatMessage({
          id: "app.garden.whatTypeOfWork",
          defaultMessage: "What type of work are you submitting?",
        })}
        Icon={RiHammerFill}
      />
      <Carousel opts={{ align: "start" }}>
        <CarouselContent>
          {actionsStatus === "pending" &&
            Array.from({ length: 4 }).map((_, idx) => (
              <CarouselItem key={`action-skel-${idx}`}>
                <ActionCardSkeleton media="small" height="selection" />
              </CarouselItem>
            ))}

          {/* Error state intentionally disabled until backend errors are surfaced */}
          {actions.length === 0 && actionsStatus === "success" && (
            <div className="p-4 text-sm text-rose-600">
              {intl.formatMessage({
                id: "app.garden.errorFetchingActions",
                defaultMessage: "Error fetching actions. Please try again.",
              })}
            </div>
          )}

          {actionsStatus === "success" && activeActions.length === 0 && (
            <div className="p-4 text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.garden.noActionsFound",
                defaultMessage: "No actions found.",
              })}
            </div>
          )}

          {activeActions.length > 0 &&
            activeActions.map((action) => {
              const uid = uidFromActionId(action.id);
              return (
                <CarouselItem
                  key={action.id}
                  onClick={() => {
                    if (uid !== null) setActionUID(uid);
                  }}
                >
                  <ActionCard
                    action={action}
                    selected={selectedActionUID === uid}
                    media="small"
                    height="selection"
                  />
                </CarouselItem>
              );
            })}
        </CarouselContent>
      </Carousel>
      <FormInfo
        title={intl.formatMessage({
          id: "app.garden.selectYourGarden",
          defaultMessage: "Select your garden",
        })}
        info={intl.formatMessage({
          id: "app.garden.whichGarden",
          defaultMessage: "Which garden are you submitting for?",
        })}
        Icon={RiPlantFill}
      />
      <Carousel>
        <CarouselContent>
          {gardensStatus === "pending" &&
            Array.from({ length: 4 }).map((_, idx) => (
              <CarouselItem key={`garden-skel-${idx}`}>
                <GardenCardSkeleton media="small" height="selection" />
              </CarouselItem>
            ))}

          {/* Error state intentionally disabled until backend errors are surfaced */}
          {gardens.length === 0 && gardensStatus === "success" && (
            <div className="p-4 text-sm text-rose-600">
              {intl.formatMessage({
                id: "app.garden.errorFetchingGardens",
                defaultMessage: "Error fetching gardens. Please try again.",
              })}
            </div>
          )}

          {gardensStatus === "success" && gardens.length === 0 && (
            <div className="p-4 text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "app.garden.noGardensFound",
                defaultMessage: "No gardens found.",
              })}
            </div>
          )}

          {gardens.length > 0 &&
            gardens.map((garden) => (
              <CarouselItem
                key={garden.id}
                onClick={() => {
                  setGardenAddress(garden.id);
                }}
              >
                <GardenCard
                  garden={garden}
                  height="selection"
                  selected={garden.id === selectedGardenAddress}
                  showDescription={true}
                  showOperators={false}
                />
              </CarouselItem>
            ))}
        </CarouselContent>
      </Carousel>
    </>
  );
};
