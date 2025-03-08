import { formatAddress } from "@/utils/text";
import { RiAlertFill, RiLeafFill, RiSearchEyeLine } from "@remixicon/react";
import { useNavigate } from "react-router-dom";

import { CircleLoader } from "../Loader";

interface GardenWorkProps {
  actions: Action[];
  works: Work[];
  workFetchStatus: "pending" | "success" | "error";
}

export const GardenWork: React.FC<GardenWorkProps> = ({
  works,
  actions,
  workFetchStatus,
}) => {
  const navigate = useNavigate();

  const WorkList = () => {
    switch (workFetchStatus) {
      case "pending":
        return <CircleLoader />;
      case "success":
        return works.length ?
            works.map((work) => (
              <li
                key={work.id}
                className="inline-flex w-full flex-col items-start justify-center overflow-hidden rounded-2xl border border-stroke-soft-200"
                // className="flex flex-col gap-1 shadow-sm border border-slate-50 bg-slate-100 rounded-xl pb-2"
                onClick={() =>
                  navigate(`/gardens/${work.gardenAddress}/work/${work.id}`)
                }
              >
                <img className="h-36 self-stretch" src={work.media[0]} />
                <div className="flex h-[232px] flex-col items-start justify-start gap-4 self-stretch p-4">
                  <div className="flex h-[136px] flex-col items-start justify-start gap-2 self-stretch">
                    <div className="self-stretch text-label-lg text-text-strong-950">
                      {work.title}
                    </div>
                    <div className="inline-flex items-start justify-start gap-2">
                      <div className="border-strok flex items-center justify-start gap-1 overflow-hidden rounded-md border bg-bg-white-0 py-1 pl-1 pr-2">
                        <RiSearchEyeLine className="h-4 w-4 text-primary-base" />
                        <div className="text-label-xs text-text-sub-600">
                          {actions.find((a) => a.id === work.actionUID)?.title}
                        </div>
                      </div>
                      <div className="border-strok flex items-center justify-start gap-1 overflow-hidden rounded-md border bg-bg-white-0 py-1 pl-1 pr-2">
                        <div className="flex h-4 w-4 items-center justify-center rounded-[999px] bg-[#ffecc0]">
                          <img
                            className="h-4 w-4 rounded-[999px]"
                            src="https://picsum.photos/16/16"
                          />
                        </div>
                        <div className="text-label-xs text-text-sub-600">
                          {formatAddress(work.gardenerAddress)}
                        </div>
                      </div>
                    </div>
                    <div className="inline-flex items-start justify-start gap-1 self-stretch">
                      <div className="border-strok flex items-center justify-start gap-1 overflow-hidden rounded-md border bg-bg-white-0 py-1 pl-1 pr-2">
                        <RiAlertFill className="h-4 w-4 text-warning-base" />
                        <div className="text-label-xs text-text-sub-600">
                          {work.status}
                        </div>
                      </div>
                      <div className="border-strok flex items-center justify-start gap-1 overflow-hidden rounded-md border bg-bg-white-0 py-1 pl-1 pr-2">
                        <RiLeafFill className="h-4 w-4 text-primary-base" />
                        <div className="text-label-xs text-text-sub-600">
                          {0}
                        </div>
                      </div>
                    </div>
                    <div className="self-stretch text-paragraph-sm text-text-strong-950">
                      {work.feedback}
                    </div>
                  </div>
                  <div className="inline-flex items-center justify-center gap-2 self-stretch">
                    <div className="h-[0px] shrink grow basis-0 border border-stroke-soft-200"></div>
                  </div>
                  <div className="inline-flex items-center justify-between self-stretch">
                    <div className="font-['Inter'] text-xs font-normal leading-none text-text-sub-600">
                      Published on {work.createdAt}
                    </div>
                    <div className="flex items-center justify-center gap-1 overflow-hidden rounded-lg bg-primary-base p-1.5">
                      <div className="flex items-center justify-center px-1">
                        <div className="font-['Inter'] text-sm font-medium leading-tight text-white">
                          View Details
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            ))
          : <p className="grid place-items-center px-8 py-4 text-center text-sm italic">
              No works done yet, get started by clicking an action above
            </p>;
      case "error":
        return (
          <p className="grid place-items-center text-sm italic">
            Error loading works
          </p>
        );
    }
  };

  return (
    <ul className="flex flex-col gap-2">
      <WorkList />
    </ul>
  );
};
