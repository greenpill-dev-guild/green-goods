import { useState } from "react";

import { GardenWorkApproval } from "./WorkApproval";

interface GardenActionsProps {
  actions: Action[];
  works: Work[];
}

export const GardenActions: React.FC<GardenActionsProps> = ({
  actions,
  works,
}) => {
  const [work, setWork] = useState<Work | null>(null);

  return (
    <>
      <ul className="grid grid-cols-2 grid-flow-row gap-2 flex-wrap mt-4">
        {actions.map((action) => (
          <li
            key={action.id}
            className="flex flex-col gap-1 shadow-sm border border-stone-50 bg-stone-100 rounded-xl pb-2"
          >
            <img
              src={action.media[0] ?? "https://picsum.photos/300/200"}
              alt="action"
              className="rounded-xl aspect[4/3]"
            />
            <label className="px-2">{action.title}</label>
            <p className="px-2 text-xs line-clamp-3">{action.description}</p>
          </li>
        ))}
      </ul>
      <h5>Work</h5>
      <ul className="flex flex-col gap-2">
        {works.map((work) => (
          <li key={work.id} onClick={() => setWork(work)}>
            <h3>{work.title}</h3>
            <p>{work.feedback}</p>
          </li>
        ))}
      </ul>
      <dialog
        id="my_modal_2"
        className="modal"
        onClose={() => setWork(null)}
        open={!!work}
      >
        <div className="modal-box">
          {work && <GardenWorkApproval work={work} />}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
};
