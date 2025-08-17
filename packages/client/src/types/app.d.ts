/* eslint-disable */
/* biome-ignore format: generated file */

declare interface Link<T> {
  title: string;
  Icon: T;
  link: string;
  action?: () => void;
}

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
  account?: string; // Smart Account Address
  username?: string | null; // Unique username
  email?: string;
  phone?: string;
  location?: string;
  avatar?: string | null;
  registeredAt: number;
}

declare interface GardenCard {
  id: string;
  name: string;
  location: string;
  bannerImage: string;
  operators: string[];
}

declare interface Garden extends GardenCard {
  createdAt: number;
  description: string;
  tokenAddress: string;
  tokenID: number;
  gardeners: string[];
  assessments: GardenAssessment[];
  works: Work[];
}

declare interface PlantInfo {
  genus: string;
  height: number;
  latitude: number;
  longitude: number;
  image: string;
}

declare interface SpeciesRegistry {
  trees: PlantInfo[];
  weeds: PlantInfo[];
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
  remoteReport: string;
  speciesRegistry: SpeciesRegistry;
  polygonCoordinates: string;
  treeGenusesObserved: string[];
  weedGenusesObserved: string[];
  issues: string[];
  tags: string[];
  createdAt: number;
}

declare interface ActionCard {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  instructions?: string;
  capitals: Capital[];
  media: string[];
  createdAt: number;
}

declare interface Action extends ActionCard {
  description: string;
  inputs: WorkInput[];
  mediaInfo?: {
    title: string;
    description: string;
    maxImageCount: number;
  };
  details?: {
    title: string;
    description: string;
    feedbackPlaceholder: string;
  };
  review?: {
    title: string;
    description: string;
  };
}

declare interface WorkInput {
  key: string;
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

declare interface Work extends WorkCard {
  status: "pending" | "approved" | "rejected";
}

declare interface WorkMetadata {
  plantCount: number;
  plantSelection: string[];
}

declare interface WorkApprovalDraft {
  actionUID: number;
  workUID: string;
  approved: boolean;
  feedback?: string;
}

declare interface WorkApproval extends WorkApprovalDraft {
  id: string;
  gardenerAddress: string;
  operatorAddress: string;
  createdAt: number;
}
