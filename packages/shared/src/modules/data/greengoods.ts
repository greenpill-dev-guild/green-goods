import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import { greenGoodsGraphQL } from "./graphql";
import { getFileByHash } from "./pinata";
import { greenGoodsIndexer } from "./urql";

export enum Capital {
  SOCIAL = 0,
  MATERIAL = 1,
  FINANCIAL = 2,
  LIVING = 3,
  INTELLECTUAL = 4,
  EXPERIENTIAL = 5,
  SPIRITUAL = 6,
  CULTURAL = 7,
}

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

    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }).toPromise();

    if (error) return [];

    if (!data || !data.Action || !Array.isArray(data.Action)) return [];

    return await Promise.all(
      data.Action.map(
        async ({ id, title, startTime, endTime, capitals, media, instructions, createdAt }) => {
          // Fetch image from first media item
          const image =
            media && media.length > 0
              ? await getFileByHash(media[0])
                  .then((res) => res)
                  .catch(() => null)
              : null;

          const mediaImage = image
            ? URL.createObjectURL(image.data as Blob)
            : "/images/no-image-placeholder.png";

          // Fetch action instructions from IPFS using existing pinata module
          let actionConfig: any = null;
          try {
            if (instructions) {
              const configData = await getFileByHash(instructions);
              // Parse the data as JSON
              if (typeof configData.data === "string") {
                actionConfig = JSON.parse(configData.data);
              } else if (configData.data instanceof Blob) {
                const text = await configData.data.text();
                actionConfig = JSON.parse(text);
              } else {
                actionConfig = configData.data;
              }
            }
          } catch (error) {
            console.error(`Failed to fetch instructions for action ${id}:`, error);
          }

          if (actionConfig) {
            console.log("[getActions] Loaded instruction config", {
              id,
              title,
              hasMediaConfig: Boolean(actionConfig?.uiConfig?.media),
              detailInputKeys: Array.isArray(actionConfig?.uiConfig?.details?.inputs)
                ? (actionConfig.uiConfig.details.inputs as WorkInput[]).map((input) => input.key)
                : [],
              reviewHasCopy: Boolean(actionConfig?.uiConfig?.review),
            });
          } else {
            console.log("[getActions] No instruction config found for action", {
              id,
              title,
            });
          }

          return {
            id, // composite id stays for uniqueness but downstream selection matches numeric UID
            title,
            startTime: startTime ? Number(startTime) * 1000 : Date.now(),
            endTime: endTime ? Number(endTime) * 1000 : Date.now() + 365 * 24 * 60 * 60 * 1000, // Default to 1 year from now
            capitals: Array.isArray(capitals) ? capitals.map((c: unknown) => c as Capital) : [],
            media: [mediaImage],
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
            details:
              actionConfig?.uiConfig?.details || {
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
  } catch {
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
          createdAt
        }
      }
    `);

    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }).toPromise();

    if (error) return [];

    if (!data || !data.Garden || !Array.isArray(data.Garden)) return [];

    return await Promise.all(
      data.Garden.map(async (garden) => {
        const image = garden.bannerImage
          ? await getFileByHash(garden.bannerImage)
              .then((res) => res)
              .catch(() => null)
          : null;

        const bannerImage = image
          ? URL.createObjectURL(image.data as Blob)
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
          assessments: [],
          works: [],
          createdAt: garden.createdAt ? (garden.createdAt as number) * 1000 : Date.now(),
        };
      })
    );
  } catch {
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
          joinedVia
        }
      }
    `);

    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }).toPromise();

    if (error) return [];
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
  } catch {
    return [];
  }
}

/** Updates the authenticated user's profile metadata via the API. */
export async function updateUserProfile(
  id: string,
  customMetadata: Record<string, unknown>,
  accessToken?: string
) {
  const apiBase = import.meta.env.DEV ? "http://localhost:3000" : "https://api.greengoods.app";
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
