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
  hypercertTokenID: number;
  title: string;
  description: string;
  details: string;
  start_date: number;
  end_date: number;
  creator: string;
  team: string[];
  capitals: Capital[];
  created_at: string;
}

declare interface Work {
  id: string;
  cammpaign: string;
  title: string;
  description: string;
  value: number;
  user: string;
  capitals: string[];
  proof: string[];
  created_at: string;
}

declare interface Completion {
  id: string;
  work: string;
  user: string;
  approval: boolean;
  created_at: string;
}
