import type { User } from "@privy-io/react-auth";
import litterActionInstructions from "@/utils/actions/litter.json";
import observerActionInstructions from "@/utils/actions/observe.json";
import plantActionInstructions from "@/utils/actions/plant.json";
import harvestActionInstructions from "@/utils/actions/harvest.json";

import { greenGoodsGraphQL } from "./graphql";
import { DEFAULT_CHAIN_ID } from "@/config";
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

function getActionInstructions(title: string) {
  switch (title.toLowerCase()) {
    case "identify plants":
      return observerActionInstructions;
    case "plant seedlings":
      return plantActionInstructions;
    case "litter cleanup":
      return litterActionInstructions;
    case "harvest produce":
      return harvestActionInstructions;
  }
}

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
      data.Action.map(async ({ id, title, startTime, endTime, capitals, media, createdAt }) => {
        const image =
          media && media.length > 0
            ? await getFileByHash(media[0])
                .then((res) => res)
                .catch(() => null)
            : null;

        const mediaImage = image
          ? URL.createObjectURL(image.data as Blob)
          : "/images/no-image-placeholder.png";

        const instructions = getActionInstructions(title);

        return {
          id, // composite id stays for uniqueness but downstream selection matches numeric UID
          title,
          startTime: startTime ? (startTime as number) * 1000 : Date.now(),
          endTime: endTime ? (endTime as number) * 1000 : Date.now() + 365 * 24 * 60 * 60 * 1000, // Default to 1 year from now
          capitals: capitals as Capital[],
          media: [mediaImage],
          description: "",
          inputs: instructions?.details.inputs as WorkInput[],
          mediaInfo: instructions?.media,
          details: instructions?.details,
          review: instructions?.review,
          createdAt: createdAt ? (createdAt as number) * 1000 : Date.now(),
        };
      })
    );
  } catch {
    return [];
  }
}

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

        const bannerImage = image ? URL.createObjectURL(image.data as Blob) : "";

        return {
          id: garden.id,
          tokenAddress: garden.tokenAddress,
          tokenID: garden.tokenID as number,
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

export async function getGardeners(): Promise<GardenerCard[]> {
  const apiUrl = import.meta.env.DEV
    ? "http://localhost:3000/users"
    : "https://api.greengoods.app/users";

  const request = await fetch(apiUrl, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const response: User[] = await request.json();

  return response.map((user) => {
    return {
      id: user.id,
      registeredAt: new Date(user.createdAt).getTime(),
      account: user.smartWallet?.address,
      email: user.email?.address,
      phone: user.phone?.number,
      location: "",
      username: user.customMetadata?.username as string,
      avatar: user.farcaster?.pfp || (user.customMetadata?.avatar as string),
    };
  });
}

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
