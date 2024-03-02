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
  banner: string;
  logo: string;
  details: string;
  start_date: string;
  end_date: string;
  creator: string;
  team: string[];
  capitals: string[];
  created_at: string;
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
  contributionID: string;
  attester: string;
  approval: boolean;
  feedback?: string;
  created_at: string;
}
