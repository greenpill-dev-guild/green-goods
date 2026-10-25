import { fn } from "storybook/test";
import type { ActiveGarden } from "../src/hooks/garden/useActiveGarden";
import { isInGardenListScope } from "../src/modules/garden/active-garden";
import { DEV_MOCK_AUTH_ADDRESSES } from "../src/providers/DevAuthProvider";
import type { Garden } from "../src/types/domain";
import {
  FIXTURE_IMAGE_AGROFORESTRY,
  FIXTURE_IMAGE_BANNER,
  FIXTURE_IMAGE_EDU,
  STORYBOOK_NOW_SECONDS,
} from "./fixtures";

/**
 * Home's story fixtures (the installed app's garden-scoped Home, DL-123 to DL-126): the gardens
 * the deployer mock belongs to, a garden it asked to join, and `useActiveGarden`'s five states.
 */

type MemberGarden = ActiveGarden["myGardens"]["gardens"][number];
type MemberRole = MemberGarden["membership"]["roles"][number];

/** The signed-in member in Home's stories: the `deployer` mock account. */
export const STORY_ACCOUNT = DEV_MOCK_AUTH_ADDRESSES.deployer;

function storyGarden(
  id: `0x${string}`,
  name: string,
  location: string,
  overrides: Partial<Garden> = {}
): Garden {
  return {
    id,
    chainId: 42161,
    tokenAddress: id,
    tokenID: 1n,
    name,
    description: `${name} grows food and shares the harvest with its neighbors.`,
    location,
    bannerImage: "",
    createdAt: (STORYBOOK_NOW_SECONDS - 86_400 * 90) * 1000,
    gardeners: [],
    stewards: [],
    evaluators: [],
    owners: [],
    funders: [],
    communities: [],
    assessments: [],
    works: [],
    openJoining: false,
    ...overrides,
  };
}

export const TAS_HUB = storyGarden(
  "0x6000000000000000000000000000000000000001",
  "TAS HUB",
  "Accra, Ghana",
  { bannerImage: FIXTURE_IMAGE_BANNER, stewards: [STORY_ACCOUNT] }
);
export const AIYELOJA = storyGarden(
  "0x6000000000000000000000000000000000000002",
  "Aiyeloja Family Garden",
  "Ìbàdàn, Nigeria",
  { gardeners: [STORY_ACCOUNT] }
);
export const VIDA_VERDE = storyGarden(
  "0x6000000000000000000000000000000000000003",
  "Vida Verde",
  "São Paulo, Brazil",
  { bannerImage: FIXTURE_IMAGE_AGROFORESTRY }
);
export const ILHAS = storyGarden(
  "0x6000000000000000000000000000000000000004",
  "Ilhas de Abundância",
  "Florianópolis, Brazil",
  { bannerImage: FIXTURE_IMAGE_EDU, openJoining: true }
);

/** The Community Garden: the chain's root garden, open to everyone. */
export function communityGarden(rootGardenAddress: `0x${string}`): Garden {
  return storyGarden(rootGardenAddress, "Green Goods Community Garden", "Everywhere", {
    openJoining: true,
  });
}

export function memberGarden(garden: Garden, roles: MemberRole[]): MemberGarden {
  return { garden, membership: { roles, pendingJoin: false } };
}

/** What `useActiveGarden` returns for a story: one of its five states over the member's gardens. */
export function activeGarden(
  status: ActiveGarden["status"],
  gardens: MemberGarden[] = [],
  gardenId: string | null = null
): ActiveGarden {
  const known = status !== "loading" && status !== "error";
  const memberGardenIds = known ? new Set(gardens.map(({ garden }) => garden.id.toLowerCase())) : null;
  return {
    status,
    gardenId,
    garden:
      status === "ready" ? (gardens.find(({ garden }) => garden.id === gardenId)?.garden ?? null) : null,
    myGardens: {
      gardens,
      isLoaded: known,
      isError: status === "error",
      isStale: false,
      refetch: fn(),
    },
    // The hook's own scope rule over the story's gardens.
    inScope: (named) => isInGardenListScope({ activeGardenId: gardenId, memberGardenIds }, named),
    selectGarden: fn(),
  };
}
