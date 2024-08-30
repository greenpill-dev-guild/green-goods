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

declare interface UserCard {
  id: string; // Privy ID
  username: string; // Unique username
  gardenerAddress: string; // Smart Account Address
  avatar?: string;
  location?: string;
  createdAt?: string;
}

declare interface UserDraft {
  username: string;
  avatar: string;
  location: string;
}

declare interface User extends UserDraft, UserCard {
  eoaAddress: string; // EOA address
  onboarded: boolean;
  email?: string;
  phoneNumber?: string;
}

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
  gardenOperators: string[];
}

declare interface Garden extends GardenCard {
  description: string;
  address: string;
  gardeners: string[];
  gardenAssessments: GardenAssessment[];
}

declare interface Action {
  id: number;
  startTime: number;
  endTime: number;
  title: string;
  instructions: string;
  capitals: Captial[];
  media: string[];
  createdAt: number;
}

declare interface WorkDraft {
  actionUID: number;
  title: string;
  feedback: string;
  metadata: string;
  media: string[];
}

declare interface WorkCard {
  id: string;
  // title: string;
  gardenerAddress: string;
  gardenAddress: string;
  createdAt: number;
}

declare interface Work extends WorkDraft, WorkCard {}

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
