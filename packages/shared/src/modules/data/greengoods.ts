import { DEFAULT_CHAIN_ID } from "../../config/blockchain";
import {
  Capital,
  Domain,
  type Action,
  type ActionInstructionConfig,
  type Address,
  type Garden,
  type GardenerCard,
  type WorkInput,
} from "../../types/domain";
import { defaultTemplate, instructionTemplates } from "../../utils/action/templates";
import { logger } from "../app/logger";
import { greenGoodsGraphQL } from "./graphql";
import { greenGoodsIndexer } from "./graphql-client";
import { getFileByHash, resolveIPFSUrl } from "./ipfs";

const ACTION_INSTRUCTIONS_TIMEOUT_MS = 5_000;

// Re-export Capital for backward compatibility
export { Capital };

/** Maps indexer domain string (e.g., "SOLAR") to the Domain enum value. */
function parseDomain(domain: string | undefined | null): Domain {
  if (!domain) return Domain.SOLAR;
  const map: Record<string, Domain> = {
    SOLAR: Domain.SOLAR,
    AGRO: Domain.AGRO,
    EDU: Domain.EDU,
    WASTE: Domain.WASTE,
  };
  return map[domain] ?? Domain.SOLAR;
}

function cloneInstructionConfig(config: ActionInstructionConfig): ActionInstructionConfig {
  return {
    description: config.description,
    uiConfig: {
      media: {
        ...config.uiConfig.media,
        needed: [...config.uiConfig.media.needed],
        optional: [...config.uiConfig.media.optional],
      },
      details: {
        ...config.uiConfig.details,
        inputs: [...config.uiConfig.details.inputs],
      },
      review: { ...config.uiConfig.review },
    },
  };
}

function normalizeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return [...fallback];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeWorkInputs(value: unknown, fallback: WorkInput[]): WorkInput[] {
  if (!Array.isArray(value)) return [...fallback];
  return value as WorkInput[];
}

function normalizeInstructionConfig(
  candidate: unknown,
  fallback: ActionInstructionConfig
): ActionInstructionConfig {
  const resolvedFallback = cloneInstructionConfig(fallback);
  if (!candidate || typeof candidate !== "object") return resolvedFallback;

  const config = candidate as Partial<ActionInstructionConfig>;
  const uiConfig =
    config.uiConfig && typeof config.uiConfig === "object"
      ? (config.uiConfig as Partial<ActionInstructionConfig["uiConfig"]>)
      : undefined;
  const media =
    uiConfig?.media && typeof uiConfig.media === "object"
      ? (uiConfig.media as Partial<ActionInstructionConfig["uiConfig"]["media"]>)
      : undefined;
  const details =
    uiConfig?.details && typeof uiConfig.details === "object"
      ? (uiConfig.details as Partial<ActionInstructionConfig["uiConfig"]["details"]>)
      : undefined;
  const review =
    uiConfig?.review && typeof uiConfig.review === "object"
      ? (uiConfig.review as Partial<ActionInstructionConfig["uiConfig"]["review"]>)
      : undefined;

  return {
    description:
      typeof config.description === "string" ? config.description : resolvedFallback.description,
    uiConfig: {
      media: {
        title:
          typeof media?.title === "string" ? media.title : resolvedFallback.uiConfig.media.title,
        description:
          typeof media?.description === "string"
            ? media.description
            : resolvedFallback.uiConfig.media.description,
        maxImageCount:
          typeof media?.maxImageCount === "number"
            ? media.maxImageCount
            : resolvedFallback.uiConfig.media.maxImageCount,
        minImageCount:
          typeof media?.minImageCount === "number"
            ? media.minImageCount
            : resolvedFallback.uiConfig.media.minImageCount,
        required:
          typeof media?.required === "boolean"
            ? media.required
            : resolvedFallback.uiConfig.media.required,
        needed: normalizeStringArray(media?.needed, resolvedFallback.uiConfig.media.needed),
        optional: normalizeStringArray(media?.optional, resolvedFallback.uiConfig.media.optional),
      },
      details: {
        title:
          typeof details?.title === "string"
            ? details.title
            : resolvedFallback.uiConfig.details.title,
        description:
          typeof details?.description === "string"
            ? details.description
            : resolvedFallback.uiConfig.details.description,
        feedbackPlaceholder:
          typeof details?.feedbackPlaceholder === "string"
            ? details.feedbackPlaceholder
            : resolvedFallback.uiConfig.details.feedbackPlaceholder,
        inputs: normalizeWorkInputs(details?.inputs, resolvedFallback.uiConfig.details.inputs),
      },
      review: {
        title:
          typeof review?.title === "string" ? review.title : resolvedFallback.uiConfig.review.title,
        description:
          typeof review?.description === "string"
            ? review.description
            : resolvedFallback.uiConfig.review.description,
      },
    },
  };
}

function getActionInstructionFallback(slug: string): ActionInstructionConfig {
  const template = instructionTemplates[slug] ?? defaultTemplate;
  return cloneInstructionConfig(template);
}

async function parseInstructionConfig(
  data: Blob | string,
  fallbackConfig: ActionInstructionConfig
): Promise<ActionInstructionConfig> {
  if (typeof data === "string") {
    return normalizeInstructionConfig(JSON.parse(data), fallbackConfig);
  }
  if (data instanceof Blob) {
    const text = await data.text();
    return normalizeInstructionConfig(JSON.parse(text), fallbackConfig);
  }
  return cloneInstructionConfig(fallbackConfig);
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
          slug
          instructions
          capitals
          media
          domain
          createdAt
        }
      }
    `);

    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }, "getActions");

    if (error) {
      logger.error("[getActions] Indexer query failed", { error: error.message });
      return [];
    }

    if (!data || !data.Action || !Array.isArray(data.Action)) return [];

    const instructionFailures: Array<{ actionId: string; message: string }> = [];

    const actions = await Promise.all(
      data.Action.map(
        async ({
          id,
          title,
          slug,
          startTime,
          endTime,
          capitals,
          media,
          domain,
          instructions,
          createdAt,
        }) => {
          const actionSlug = typeof slug === "string" ? slug : "";
          const fallbackConfig = getActionInstructionFallback(actionSlug);

          // Resolve media CIDs to gateway URLs
          const resolvedMedia =
            media && Array.isArray(media)
              ? media.map((cid: string) => resolveIPFSUrl(cid))
              : [];

          // Fetch action instructions from IPFS using Storacha module
          let actionConfig = fallbackConfig;
          try {
            if (instructions) {
              const configData = await getFileByHash(instructions, {
                timeoutMs: ACTION_INSTRUCTIONS_TIMEOUT_MS,
              });
              actionConfig = await parseInstructionConfig(configData.data, fallbackConfig);
            }
          } catch (error) {
            instructionFailures.push({
              actionId: id,
              message: error instanceof Error ? error.message : String(error),
            });
          }

          return {
            id, // composite id stays for uniqueness but downstream selection matches numeric UID
            title,
            slug: actionSlug,
            instructions: instructions ? resolveIPFSUrl(instructions) : undefined,
            domain: parseDomain(domain as string | undefined),
            startTime: startTime ? Number(startTime) * 1000 : Date.now(),
            endTime: endTime ? Number(endTime) * 1000 : Date.now() + 365 * 24 * 60 * 60 * 1000, // Default to 1 year from now
            capitals: Array.isArray(capitals) ? capitals.map((c: unknown) => c as Capital) : [],
            media: resolvedMedia,
            description: actionConfig.description,
            inputs: actionConfig.uiConfig.details.inputs as WorkInput[],
            mediaInfo: actionConfig.uiConfig.media,
            details: actionConfig.uiConfig.details,
            review: actionConfig.uiConfig.review,
            createdAt: createdAt ? Number(createdAt) * 1000 : Date.now(),
          };
        }
      )
    );

    if (instructionFailures.length > 0) {
      logger.warn(
        `[getActions] Failed to fetch instructions for ${instructionFailures.length}/${data.Action.length} actions`,
        {
          actionIds: instructionFailures.map((failure) => failure.actionId),
          failures: instructionFailures,
        }
      );
    }

    return actions;
  } catch (error) {
    logger.error("[getActions] Failed to fetch actions", { error });
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
          evaluators
          owners
          funders
          communities
          openJoining
          createdAt
        }
        GardenDomains(where: {chainId: {_eq: $chainId}}) {
          garden
          domainMask
        }
      }
    `);

    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }, "getGardens");

    if (error) {
      logger.error("[getGardens] Indexer query failed", { error: error.message });
      return [];
    }

    if (!data || !data.Garden || !Array.isArray(data.Garden)) return [];

    // Build a lookup from garden address -> domainMask
    const domainMap = new Map<string, number>(
      ((data.GardenDomains ?? []) as Array<{ garden: string; domainMask: number }>).map((d) => [
        d.garden,
        d.domainMask,
      ])
    );

    return data.Garden.map((garden) => {
      // DIRTY FIX: Override Octant Community Garden banner until indexer is updated
      const OCTANT_BANNER_OVERRIDE = "bafkreihslrqy363mkr4kn5skr56zcazyvikldosy433p6e5okxyxxjdyuy";
      const isOctantGarden = garden.name === "Octant Community Garden";

      const bannerImage = isOctantGarden
        ? resolveIPFSUrl(OCTANT_BANNER_OVERRIDE)
        : garden.bannerImage
          ? resolveIPFSUrl(garden.bannerImage)
          : "/images/no-image-placeholder.png";

      return {
        id: garden.id,
        chainId: garden.chainId,
        tokenAddress: garden.tokenAddress as Address,
        tokenID: BigInt(garden.tokenID),
        name: garden.name || "Unnamed Garden",
        description: garden.description || "",
        location: garden.location || "Unknown Location",
        bannerImage,
        gardeners: (garden.gardeners || []) as Address[],
        operators: (garden.operators || []) as Address[],
        evaluators: (garden.evaluators || []) as Address[],
        owners: (garden.owners || []) as Address[],
        funders: (garden.funders || []) as Address[],
        communities: (garden.communities || []) as Address[],
        openJoining: Boolean(garden.openJoining),
        domainMask: domainMap.get(garden.id) ?? 0,
        assessments: [],
        works: [],
        createdAt: garden.createdAt ? (garden.createdAt as number) * 1000 : Date.now(),
      };
    });
  } catch (error) {
    logger.error("[getGardens] Failed to fetch gardens", { error });
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
      logger.error("[getGardeners] Indexer query failed", { error: error.message });
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
    logger.error("[getGardeners] Failed to fetch gardeners", { error });
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
