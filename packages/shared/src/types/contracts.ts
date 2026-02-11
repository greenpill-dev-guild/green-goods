// Contract addresses for different networks
export interface NetworkContracts {
  gardenToken: string;
  actionRegistry: string;
  workResolver: string;
  workApprovalResolver: string;
  deploymentRegistry: string;
  octantModule: string;
  hatsModule: string;
  karmaGAPModule: string;
  eas: string;
  easSchemaRegistry: string;
  communityToken: string;
  erc4337EntryPoint: string;
  multicallForwarder: string;
}

// Garden creation parameters
export interface CreateGardenParams {
  communityToken: string;
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  metadata: string;
  openJoining: boolean;
}

// Contract deployment parameters
export interface DeploymentParams {
  contractType: string;
  chainId: number;
  initParams?: unknown[];
}
