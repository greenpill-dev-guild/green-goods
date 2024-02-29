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
  hypercert_id: number;
  title: string;
  description: string;
  details: string;
  start_date: number;
  end_date: number;
  creator_address: string;
  team_addresses: string[];
  capitals: Capital[];
  created_at: string;
}

declare interface Work {
  id: string;
  cammpaign_address: string;
  title: string;
  description: string;
  value: number;
  user_addres: string;
  capitals: string[];
  media: string[];
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

declare interface Completion {
  id: string;
  work_id: string;
  approver_address: string;
  approval: boolean;
  created_at: string;
}
