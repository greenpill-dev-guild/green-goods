declare type TCreateProposal = {
  name: string;
  location: string;
  problem: string;
  solution: string;
  budget: number;
  start_date: Date;
  end_date: Date;
  collaborators?: string[];
  community?: string | null;
  banner_image: string;
  milestones: TMilestone[];
};

declare type TSummaryProposal = {
  id: string;
  name: string;
  location: string;
  problem: string;
  start_date: Date;
  end_date: Date;
  banner_image: string;
  votes: TVote[] | null;
};

declare type TFullProposal = TSummaryProposal & {
  author_id: string;
  solution: string;
  budget: number;
  community?: string | null;
  collaborators: TCollaborator[] | null;
  milestones: TMilestone[];
};

declare type TCollaborator = {
  id: string | null;
  username?: string | null;
  user_id: string | null;
  profile_image?: string | null;
};

declare type TMilestone = {
  id?: string;
  name: string;
  budget: number;
  description: string;
  // created_at: Date;
};

declare type TUser = {
  id: string;
  username: string;
  address: string | null;
  phone_number: string | null;
  email: string | null;
  location: string | null;
  profile_image: string | null;
  onboarded: boolean | null;
  created_at?: Date;
};

declare type TVote = {
  id: string;
  proposal_id: string;
  user_id: string;
  vote_type: boolean | null;
  created_at: string;
};
