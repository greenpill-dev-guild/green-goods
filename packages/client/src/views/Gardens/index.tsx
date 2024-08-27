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
