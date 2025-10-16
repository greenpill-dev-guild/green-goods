export interface Garden {
  id: string;
  chainId: number;
  tokenAddress: string;
  tokenID: bigint;
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  createdAt: number;
  gardeners: string[];
  operators: string[];
}
