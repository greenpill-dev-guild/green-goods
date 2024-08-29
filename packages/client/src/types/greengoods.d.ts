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

declare interface GardenerCard {
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

declare interface User extends UserDraft, GardenerCard {
  eoaAddress: string; // EOA address
  onboarded: boolean;
  email?: string;
  phoneNumber?: string;
}

declare interface GardenAssessment {
  id: string;
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
  createdAt: BigInt;
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
  id: string;
  startTime: BigInt;
  endTime: BigInt;
  title: string;
  instructions: string;
  capitals: Captial[];
  media: string[];
  createdAt: BigInt;
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
  createdAt: string;
  title: string;
  gardernerAddress: string;
  gardenAddress: string;
  createdAt: BigInt;
}

declare interface Work extends WorkDraft, WprkCard {}

declare interface WorkApprovalDraft {
  actionUID: number;
  workUID: number;
  approved: boolean;
  feedback: string;
}

declare interface WorkApprovalCard {
  id: string;
  approved: boolean;
  workUid: string;
  recipientAddress: string;
  approverAddress: string;
  createdAt: BigInt;
}

declare interface WorkApproval extends WorkApprovalDraft, WorkApprovalCard {}
