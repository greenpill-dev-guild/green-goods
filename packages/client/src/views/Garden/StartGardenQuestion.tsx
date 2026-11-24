import { Button } from "@green-goods/shared/components/Button";
import {
  GardenCard,
  GardenPicker,
} from "@green-goods/shared/components/Cards/GardenCard/GardenCard";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import type { Garden } from "@green-goods/shared/types/domain";
import { RiPlantFill, RiPlantLine, RiUserAddLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { FormInfo } from "@/components/Cards/Form/FormInfo";

/** Asked only while the flow's garden is not one the member can submit work to (decision 28). */
export interface StartGardenQuestionProps {
  gardens: Garden[];
  selected: string | null;
  onSelect: (garden: string | null) => void;
  hasJoined: boolean;
  loading: boolean;
  joinable: Garden | null;
  joining: boolean;
  onJoin?: () => void;
}

/** The garden question, with the Community Garden's open door for a member with none. */
export function StartGardenQuestion({
  gardens,
  selected,
  onSelect,
  hasJoined,
  loading,
  joinable,
  joining,
  onJoin,
}: StartGardenQuestionProps) {
  const intl = useIntl();
  const showOnramp = !hasJoined && Boolean(joinable) && Boolean(onJoin);
  const pending = loading && gardens.length === 0 && !joinable;
  return (
    <div className="flex flex-col gap-4" data-component="WorkStart" data-screen="garden">
      <FormInfo
        fit="line"
        title={intl.formatMessage({ id: "app.garden.selectYourGarden" })}
        info={intl.formatMessage({ id: "app.garden.whichGarden" })}
        Icon={RiPlantFill}
      />
      {gardens.length === 0 && !pending && showOnramp && joinable?.id === selected ? (
        <GardenCard garden={joinable} selected />
      ) : gardens.length === 0 && !pending && showOnramp ? (
        <EmptyState
          icon={<RiPlantLine />}
          title={intl.formatMessage({ id: "app.garden.communityOnramp.title" })}
          description={intl.formatMessage({ id: "app.garden.communityOnramp.description" })}
          action={
            <Button
              type="button"
              size="sm"
              onClick={onJoin}
              loading={joining}
              leadingIcon={<RiUserAddLine className="h-4 w-4" aria-hidden="true" />}
            >
              {intl.formatMessage({ id: "app.garden.communityOnramp.action" })}
            </Button>
          }
        />
      ) : gardens.length === 0 && !pending ? (
        <EmptyState
          icon={<RiPlantLine />}
          title={intl.formatMessage({ id: "app.garden.noGardensAvailable.title" })}
          description={intl.formatMessage({ id: "app.garden.noGardensAvailable.description" })}
        />
      ) : (
        <GardenPicker
          gardens={gardens}
          value={selected}
          onChange={onSelect}
          label={intl.formatMessage({ id: "app.garden.selectYourGarden" })}
          layout="row"
          loading={pending}
          className="-mx-4 scroll-px-4 px-4"
        />
      )}
    </div>
  );
}
