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
  contributions?: Contribution[];
}

declare interface Contribution {
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

declare interface Confirmation {
  id: string;
  workID: string;
  approver: string;
  approval: boolean;
  created_at: string;
}
