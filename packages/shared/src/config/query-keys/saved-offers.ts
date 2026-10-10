export const savedOffersKeys = {
  all: (chainId: number) => ["greengoods", "saved-offers", chainId] as const,
  list: (chainId: number) => [...savedOffersKeys.all(chainId), "list"] as const,
  record: (chainId: number, savedOfferId: string) =>
    [...savedOffersKeys.all(chainId), "record", savedOfferId] as const,
} as const;
