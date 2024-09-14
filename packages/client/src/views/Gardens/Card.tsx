import React from "react";
import {
  RiMapPin2Fill,
  // RiCalendar2Fill,
  // RiThumbUpFill,
} from "@remixicon/react";
import { Button } from "@/components/Button";

// import { truncateDescription } from "../../utils/text";
// import { Button } from "../Button";

export interface GardenCardProps extends Garden {
  index: number;
  onCardClick: () => void;
}

export const GardenCard: React.FC<GardenCardProps> = ({
  // id,
  index,
  name,
  description,
  location,
  bannerImage,
  // operators,
  onCardClick,
}) => {
  return (
    <li
      className={`${index === 0 ? "mt-4" : ""} flex flex-col bg-stone-50 border border-1 shadow-md rounded-xl`}
      // onClick={onCardClick}
    >
      <div className="relative w-full h-auto rounded-t-xl">
        <img
          className="w-full rounded-t-xl aspect-[4/2] object-cover object-top"
          width={400}
          height={200}
          src={
            bannerImage ??
            "https://images.unsplash.com/photo-1680868543815-b8666dba60f7?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2532&q=80"
          }
          alt="Image Description"
        />
      </div>
      <div className="p-4 md:p-5 flex flex-col gap-3">
        <h4 className=" text-slate-800 line-clamp-1">{name}</h4>
        <div className="flex gap-1">
          <RiMapPin2Fill className="h-5 text-teal-400" />
          <span className="text-sm font-medium">{location}</span>
        </div>
        <p className="small text-slate-600 line-clamp-3">{description}</p>
        <div className="flex w-full justify-end">
          <Button label="View" size="small" fullWidth onClick={onCardClick} />
        </div>
      </div>
    </li>
  );
};
