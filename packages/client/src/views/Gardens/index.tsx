// import { useState } from "react";

import { ProposalCard } from "./Card";

export interface ProposalListProps {
  user: TUser | null;
  proposals: TSummaryProposal[];
  onProposalClick: (id: string) => void;
  onProposalVote: (id: string, vote: boolean | null) => void;
  noProposalsMessage?: string;
}

export const ProposalList: React.FC<ProposalListProps> = ({
  user,
  proposals,
  onProposalClick,
  onProposalVote,
  noProposalsMessage,
}) => {
  // const [filter, setFiler] = useState<"all" | "upvoted">("all"); // TODO: Add filter state

  const filteredProposals = proposals.filter((p) => p);

  return (
    <ul className="h-full flex-1 flex flex-col gap-4 overflow-y-scroll cursor-pointer">
      {filteredProposals.length ?
        filteredProposals.map((proposal) => (
          <li key={proposal.id}>
            <ProposalCard
              {...proposal}
              userVote={
                proposal.votes?.find((v) => v.user_id === user?.id)
                  ?.vote_type ?? null
              }
              onCardClick={() => onProposalClick(proposal.id)}
              onUpVote={() => onProposalVote(proposal.id, true)}
            />
          </li>
        ))
      : <p className="h-full w-full grid place-items-center text-sm italic">
          {noProposalsMessage}
        </p>
      }
    </ul>
  );
};

// const Home: React.FC<HomeProps> = (
//   {
//     // address,
//     // confirmationMap,
//     // contributions,
//   }
// ) => {
//   const navigate = useNavigate();
//   const location = useLocation();

//   function handleCardClick(id: string) {
//     navigate(`/campaigns/${id}`);
//   }

//   return (
//     <section className={`relative w-full h-full`}>
//       <div className="flex justify-between w-full">
//         <h4>Home</h4>
//         <div></div>
//       </div>
//       {location.pathname === "/campaigns" ?
//         <ul className={`relative w-full h-full`}>
//           {Array.from({ length: 5 }).map((_, index) => (
//             <li className="p-1" onClick={() => handleCardClick("")}>
//               {index}
//             </li>
//           ))}
//         </ul>
//       : null}
//       <Outlet />
//     </section>
//   );
// };
