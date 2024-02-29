declare type Capital =
  | "Living"
  | "Social"
  | "Material"
  | "Cultural"
  | "Financial"
  | "Intellectual"
  | "Experiental"
  | "Spiritual";

declare interface Campaign {
  id: string;
  hypercertID: number;
  title: string;
  description: string;
  details: string;
  start_date: string;
  end_date: string;
  creator: string;
  team: string[];
  capitals: string[];
  created_at: string;
  actions?: Action[];
}

declare interface Action {
  id: string;
  cammpaignAddrs: string;
  title: string;
  description: string;
  value: number;
  user: string;
  capitals: string[];
  proof: string[];
  created_at: string;
  status: "pending" | "approved" | "rejected";
}

declare interface Completion {
  id: string;
  workID: string;
  userAddrs: string;
  approval: boolean;
  created_at: string;
}
