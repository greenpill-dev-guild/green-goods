/* eslint-disable */
/* prettier-ignore */

declare enum Capital {
  SOCIAL,
  MATERIAL,
  FINANCIAL,
  LIVING,
  INTELLECTUAL,
  EXPERIENTIAL,
  SPIRITUAL,
  CULTURAL,
}

declare type Plant =
  | "Jatoba"
  | "uvaia"
  | "avocado"
  | "banana"
  | "jambo"
  | "inga"
  | "ipê";

// declare interface UserCard {
//   id: string; // Privy ID
//   username: string; // Unique username
//   gardenerAddress: string; // Smart Account Address
//   avatar?: string;
//   location?: string;
//   createdAt?: string;
// }

// declare interface UserDraft {
//   username: string;
//   avatar: string;
//   location: string;
// }

// declare interface User extends UserDraft, UserCard {
//   eoaAddress: string; // EOA address
//   onboarded: boolean;
//   email?: string;
//   phoneNumber?: string;
// }

declare interface GardenAssessment {
  id: string;
  authorAddress: string;
  gardenAddress: string;
  soilMoisturePercentage: number;
  carbonTonStock: number;
  carbonTonPotential: number;
  gardenSquareMeters: number;
  biome: string;
  remoteReportCID: string;
  speciesRegistryCID: string;
  polygonCoordinates: string;
  treeGenusesObserved: string[];
  weedGenusesObserved: string[];
  issues: string[];
  tags: string[];
  createdAt: number;
}

declare interface GardenCard {
  id: string;
  name: string;
  location: string;
  bannerImage: string;
  operators: string[];
}

declare interface Garden extends GardenCard {
  description: string;
  tokenAddress: string;
  tokenID: number;
  gardeners: string[];
  gardenAssessments: GardenAssessment[];
}

declare interface ActionCard {
  id: number;
  startTime: number;
  endTime: number;
  title: string;
  instructions: string;
  capitals: Captial[];
  media: string[];
  createdAt: number;
}

declare interface Action extends ActionCard {
  description: string;
  inputs: WorkInput[];
  mediaInfo: {
    title: string;
    description: string;
    maxImageCount: number;
  };
  details: {
    title: string;
    description: string;
    feedbackPlaceholder: string;
  };
  review: {
    title: string;
    description: string;
  };
}

declare interface WorkInput {
  title: string;
  placeholder: string;
  type: "text" | "textarea" | "select" | "number";
  required: boolean;
  options: string[];
}

declare interface WorkDraft {
  actionUID: number;
  title: string;
  plantSelection: string[];
  plantCount: number;
  feedback: string;
  // metadata: Record<string, string | number | boolean | string[]>;
  media: File[];
}

declare interface WorkCard {
  id: string;
  title: string;
  actionUID: number;
  gardenerAddress: string;
  gardenAddress: string;
  feedback: string;
  metadata: string;
  media: string[];
  createdAt: number;
}

declare interface WorkMetadata {
  [key: string]: string | number | boolean | string[];
}

declare interface Work extends WorkCard {
  approvals: WorkApproval[];
}

declare interface WorkApprovalDraft {
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback: string;
}

declare interface WorkApprovalCard {
  id: string;
  workUID: string;
  approved: boolean;
  recipientAddress: string;
  approverAddress: string;
  createdAt: number;
}

declare interface WorkApproval extends WorkApprovalDraft, WorkApprovalCard {}
