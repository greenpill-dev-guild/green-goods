import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import {
  Capital,
  type Action,
  type ActionInstructionConfig,
  type Garden,
  type GardenerCard,
  type WorkInput,
} from "../../types/domain";
import { greenGoodsGraphQL } from "./graphql";
import { greenGoodsIndexer } from "./graphql-client";
import { getFileByHash, resolveIPFSUrl } from "./ipfs";

const GATEWAY_BASE_URL = "https://w3s.link";

// Re-export Capital for backward compatibility
export { Capital };

/** Fetches action definitions from the indexer and enriches media + UI config. */
export async function getActions(): Promise<Action[]> {
  try {
    const chainId = DEFAULT_CHAIN_ID;
    const QUERY = greenGoodsGraphQL(/* GraphQL */ `
      query Actions($chainId: Int!) {
        Action(where: {chainId: {_eq: $chainId}}) {
          id
          chainId
          startTime
          endTime
          title
          instructions
          capitals
          media
          createdAt
        }
      }
    `);

    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }, "getActions");

    if (error) {
      console.error("[getActions] Indexer query failed:", error.message);
      return [];
    }

    if (!data || !data.Action || !Array.isArray(data.Action)) return [];

    return await Promise.all(
      data.Action.map(
        async ({ id, title, startTime, endTime, capitals, media, instructions, createdAt }) => {
          // Resolve media CIDs to gateway URLs
          const resolvedMedia =
            media && Array.isArray(media)
              ? media.map((cid: string) => resolveIPFSUrl(cid, GATEWAY_BASE_URL))
              : [];

          // Fetch action instructions from IPFS using Storacha module
          let actionConfig: ActionInstructionConfig | null = null;
          try {
            if (instructions) {
              const configData = await getFileByHash(instructions);
              // Parse the data as JSON
              if (typeof configData.data === "string") {
                actionConfig = JSON.parse(configData.data) as ActionInstructionConfig;
              } else if (configData.data instanceof Blob) {
                const text = await configData.data.text();
                actionConfig = JSON.parse(text) as ActionInstructionConfig;
              } else {
                actionConfig = configData.data as ActionInstructionConfig;
              }
            }
          } catch (error) {
            console.error(`[getActions] Failed to fetch instructions for action ${id}:`, error);
          }

          return {
            id, // composite id stays for uniqueness but downstream selection matches numeric UID
            title,
            startTime: startTime ? Number(startTime) * 1000 : Date.now(),
            endTime: endTime ? Number(endTime) * 1000 : Date.now() + 365 * 24 * 60 * 60 * 1000, // Default to 1 year from now
            capitals: Array.isArray(capitals) ? capitals.map((c: unknown) => c as Capital) : [],
            media: resolvedMedia.length > 0 ? resolvedMedia : ["/images/no-image-placeholder.png"],
            description: actionConfig?.description || "",
            inputs: (actionConfig?.uiConfig?.details?.inputs as WorkInput[]) || [],
            mediaInfo: actionConfig?.uiConfig?.media || {
              title: "Capture Media",
              description: "",
              maxImageCount: 5,
              required: false,
              minImageCount: 1,
              needed: [],
              optional: [],
            },
            details: actionConfig?.uiConfig?.details || {
              title: "Details",
              description: "",
              feedbackPlaceholder: "",
              inputs: [],
            },
            review: actionConfig?.uiConfig?.review || { title: "Review", description: "" },
            createdAt: createdAt ? Number(createdAt) * 1000 : Date.now(),
          };
        }
      )
    );
  } catch (error) {
    console.error("[getActions] Failed to fetch actions:", error);
    return [];
  }
}

/** Returns gardens with resolved banner assets for the current chain. */
export async function getGardens(): Promise<Garden[]> {
  try {
    const chainId = DEFAULT_CHAIN_ID;
    const QUERY = greenGoodsGraphQL(/* GraphQL */ `
      query Gardens($chainId: Int!) {
        Garden(where: {chainId: {_eq: $chainId}}) {
          id
          chainId
          tokenAddress
          tokenID
          name
          description
          location
          bannerImage
          gardeners
          operators
          openJoining
          createdAt
        }
      }
    `);

    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }, "getGardens");

    if (error) {
      console.error("[getGardens] Indexer query failed:", error.message);
      return [];
    }

    if (!data || !data.Garden || !Array.isArray(data.Garden)) return [];

    return data.Garden.map((garden) => {
      const bannerImage = garden.bannerImage
        ? resolveIPFSUrl(garden.bannerImage, GATEWAY_BASE_URL)
        : "/images/no-image-placeholder.png";

      return {
        id: garden.id,
        chainId: garden.chainId,
        tokenAddress: garden.tokenAddress,
        tokenID: BigInt(garden.tokenID),
        name: garden.name || "Unnamed Garden",
        description: garden.description || "",
        location: garden.location || "Unknown Location",
        bannerImage,
        gardeners: garden.gardeners || [],
        operators: garden.operators || [],
        openJoining: Boolean(garden.openJoining),
        assessments: [],
        works: [],
        createdAt: garden.createdAt ? (garden.createdAt as number) * 1000 : Date.now(),
      };
    });
  } catch (error) {
    console.error("[getGardens] Failed to fetch gardens:", error);
    return [];
  }
}

/** Retrieves gardener registrations for operator views. */
export async function getGardeners(): Promise<GardenerCard[]> {
  try {
    const chainId = DEFAULT_CHAIN_ID;
    const QUERY = greenGoodsGraphQL(/* GraphQL */ `
      query Gardeners($chainId: Int!) {
        Gardener(where: {chainId: {_eq: $chainId}}) {
          id
          chainId
          createdAt
          firstGarden
        }
      }
    `);

    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }, "getGardeners");

    if (error) {
      console.error("[getGardeners] Indexer query failed:", error.message);
      return [];
    }
    if (!data || !data.Gardener || !Array.isArray(data.Gardener)) return [];

    return data.Gardener.map((gardener) => ({
      id: gardener.id,
      registeredAt: gardener.createdAt ? (gardener.createdAt as number) * 1000 : Date.now(),
      account: gardener.id, // Smart account address is the ID
      email: undefined,
      phone: undefined,
      location: "",
      username: gardener.id.slice(0, 8), // Use short address as username
      avatar: undefined,
    }));
  } catch (error) {
    console.error("[getGardeners] Failed to fetch gardeners:", error);
    return [];
  }
}

/** Updates the authenticated user's profile metadata via the API. */
export async function updateUserProfile(
  id: string,
  customMetadata: Record<string, unknown>,
  accessToken?: string
) {
  const apiBase =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : "https://api.greengoods.app");
  const res = await fetch(`${apiBase}/users/me`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ id, customMetadata }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update user: ${res.status}`);
  }
  return (await res.json()) as unknown;
}
