import { useNavigate } from "react-router-dom";

interface GardenWorkProps {
  actions: Action[];
  works: Work[];
}

export const GardenWork: React.FC<GardenWorkProps> = ({ actions, works }) => {
  const navigate = useNavigate();

  return (
    <>
      <div className="grid grid-cols-2 grid-flow-row gap-2 flex-wrap mt-4">
        {actions.map((action) => (
          <li
            key={action.id}
            className="flex flex-col gap-1 shadow-sm border border-stone-50 bg-stone-100 rounded-xl pb-2"
          >
            <img
              src={action.media[0] ?? "https://picsum.photos/300/200"}
              alt="action"
              className="rounded-xl aspect-square object-cover overflow-hidden"
            />
            <label className="px-1">{action.title}</label>
            <p className="px-2 text-xs line-clamp-3">{action.description}</p>
          </li>
        ))}
      </div>
      <h5>Work Completed</h5>
      <div className="flex flex-col gap-2">
        {works.length ?
          works.map((work) => (
            <li
              key={work.id}
              onClick={() =>
                navigate(`garden/${work.gardenAddress}/work/${work.id}`)
              }
            >
              <h3>{work.title}</h3>
              <p>{work.feedback}</p>
            </li>
          ))
        : <p className="grid place-items-center px-8 py-4 text-center text-sm italic">
            No works done yet, get started by clicking an action above
          </p>
        }
      </div>
    </>
  );
};
