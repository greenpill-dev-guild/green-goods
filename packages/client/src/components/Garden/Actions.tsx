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
    <div>
      <ul className="flex flex-col gap-2">
        {actions.map((action) => (
          <li key={action.id}>
            <h3>{action.title}</h3>
            <p>{action.instructions}</p>
          </li>
        ))}
      </ul>
      <h3>Work</h3>
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
    </div>
  );
};
