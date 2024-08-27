import {
  RiMapPin2Fill,
  RiArrowLeftFill,
  RiCalendarEventFill,
  RiThumbUpFill,
  RiProfileFill,
  // PencilLineIcon,
} from "@remixicon/react";
import React from "react";

import { formatPrice } from "@/utils/text";

type ProfileTab = "proposal" | "details" | "milestones";

interface ProposalViewerProps extends TFullProposal {
  view: "review" | "info";
  author?: TUser;
  translations: any;
  userVote: boolean | null;
  onUpVote: (id: string, vote: boolean) => void;
}

const tabs: ProfileTab[] = ["proposal", "details", "milestones"];

export const cardStyles = "bg-white border rounded-xl shadow-sm";
export const cardTitleStyles = "text-base font-medium bg-teal-100 py-2 px-3";
export const cardContentStyles = "text-sm leading-1 mt-2 px-3 pb-2";

export const ProposalViewer: React.FC<ProposalViewerProps> = ({
  view,
  id,
  name,
  location,
  problem,
  solution,
  budget,
  start_date,
  end_date,
  collaborators,
  community,
  banner_image,
  milestones,
  votes,
  author,
  userVote,
  onUpVote,
  translations,
}) => {
  const [tab, setTab] = React.useState<ProfileTab>("proposal");

  const upvotes = votes?.filter((vote) => vote.vote_type === true).length ?? 0;

  return (
    <div className="h-full overflow-y-scroll flex flex-col">
      <div className="relative w-full">
        {view === "info" && (
          <a
            className="flex gap-1 items-center h-8 px-2 py-1 bg-white rounded-lg font-bold absolute top-0 left-0"
            href="/proposals"
          >
            <RiArrowLeftFill className="h-8" />
            Back
          </a>
        )}
        {/* {author.id === user?.id && (
            <PencilLineIcon
              onClick={() => setIsEditing(true)}
              className="h-5 inline-block ml-2"
            />
          )} */}
        <img
          src={banner_image}
          className="w-full object-cover object-top aspect-[16/9] border-b-2 border-slate-300 shadow-sm"
          alt="Banner"
        />
      </div>
      <div className="px-4 py-2">
        <h2 className="text-xl font-semibold line-clamp-2 mb-2">{name}</h2>
        <div className="flex w-full justify-between items-start mb-2">
          <div className="flex flex-col gap-1">
            <div className="flex gap-1">
              <RiProfileFill className="h-5 text-teal-400" />
              <span className="text-sm font-medium">{author?.username}</span>
            </div>
            <div className="flex gap-1">
              <RiMapPin2Fill className="h-5 text-teal-400" />
              <span className="text-sm font-medium">{location}</span>
            </div>
            <div className="flex gap-1">
              <RiCalendarEventFill className="h-5 text-teal-400" />
              <span className="text-sm font-medium">
                {start_date && end_date ?
                  `${start_date.toLocaleDateString()} - ${end_date.toLocaleDateString()}`
                : "No timeline provided."}
              </span>
            </div>
          </div>
          {view === "info" && (
            <span className="flex gap-1 items-center bg-white px-1.5 py-1 rounded-xl">
              <RiThumbUpFill
                onClick={() => onUpVote(id, true)}
                className={`
              ${userVote === true ? "fill-green-500" : "fill-slate-500"}
              h-5 text-slate-500
            `}
              />
              {upvotes}
            </span>
          )}
        </div>
      </div>
      <div className="px-4">
        <div
          className={`${""} tabs tabs-lifted tabs-lg border rounded-xl flex w-full`}
          role="tablist"
        >
          {tabs.map((name) => (
            <a
              key={name}
              className={`tab capitalize flex-1 text-base font-medium ${
                name === tab ? "tab-active [--tab-bg:#99f6e4]" : ""
              }`}
              onClick={() => setTab(name)}
            >
              {name}
            </a>
          ))}
        </div>
      </div>
      <div className="overflow-y-scroll flex-1 flex flex-col gap-4 px-4 py-4">
        {tab === "proposal" && (
          <>
            <div className={cardStyles}>
              <h3 className={cardTitleStyles}>{translations?.("problem")}</h3>
              <p className={cardContentStyles}>{problem}</p>
            </div>
            <div className={cardStyles}>
              <h3 className={cardTitleStyles}>{translations?.("solution")}</h3>
              <p className={cardContentStyles}>{solution}</p>
            </div>
          </>
        )}
        {tab === "details" && (
          <>
            <div className={cardStyles}>
              <h3 className={cardTitleStyles}>{translations("budget")}</h3>
              <p className={`${cardContentStyles} text-base`}>
                {formatPrice(budget)}
              </p>
            </div>
            <div className={cardStyles}>
              <h3 className={cardTitleStyles}>
                {translations("collaborators")}
              </h3>
              <ul
                className={`${cardContentStyles} w-full flex flex-wrap gap-2`}
              >
                {collaborators?.map((user) => (
                  <li
                    key={user.id}
                    className="flex items-center gap-1 border bg-teal-50 rounded-xl p-2 max-w-12"
                  >
                    <img
                      src={user.profile_image ?? "/icons/avatar.png"}
                      className="h-6 w-6 rounded-full"
                      alt="Profile"
                    />
                    <span>{user.username ?? "Unknown User"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={cardStyles}>
              <h3 className={cardTitleStyles}>{translations("community")}</h3>
              <p className={`${cardContentStyles}`}>{community}</p>
            </div>
            {/* <span className="text-sm">
          {collaborators && collaborators.length !== 0 && (
            <UsersIcon className="h-4 inline-block" />
          )}
          {collaborators &&
            collaborators.map((user) => user.username).join(", ")}
        </span> */}
          </>
        )}
        {tab === "milestones" &&
          milestones?.map((milestone: TMilestone) => (
            <div key={milestone.id} className={cardStyles}>
              <div
                className={`${cardTitleStyles} w-full flex justify-between items-center`}
              >
                <h3 className="basis-2/3">{milestone.name}</h3>
                <span>{formatPrice(milestone.budget)}</span>
              </div>
              <p className={`${cardContentStyles}`}>{milestone.description}</p>
            </div>
          ))}
      </div>
    </div>
  );
};
