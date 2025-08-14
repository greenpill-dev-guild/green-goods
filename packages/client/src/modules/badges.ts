export type Badge = {
  key: string;
  type: "nft" | "achievement" | string;
  title: string;
  state: "red" | "orange" | "green" | "unknown" | string;
  progress: { current: number; target: number; unit: string } | null;
  images: { small?: string; large?: string };
  details: { description?: string; howToUrl?: string; explorerUrl?: string | null };
  chain?: { chainId?: number; contract?: string | null; tokenId?: string | null };
  owned: boolean;
  updatedAt: string;
};

function getApiBase() {
  return import.meta.env.DEV ? "http://localhost:3000" : "https://api.greengoods.app";
}

export async function fetchBadges(wallet?: string): Promise<Badge[]> {
  const base = getApiBase();
  const url = new URL(`${base}/badges`);
  if (wallet) url.searchParams.set("wallet", wallet);
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) return [];
  const json = (await res.json()) as { badges?: Badge[] } | Badge[];
  // Support both envelope and raw array
  const list = Array.isArray(json) ? (json as Badge[]) : json.badges || [];
  return list;
}

export async function fetchGreenpillBadge(wallet?: string): Promise<Badge | null> {
  const base = getApiBase();
  const url = new URL(`${base}/badges/greenpill`);
  if (wallet) url.searchParams.set("wallet", wallet);
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) return null;
  const badge = (await res.json()) as Badge;
  return badge;
}
