import type { User } from "@privy-io/react-auth";
import litterActionInstructions from "@/utils/actions/litter.json";
import observerActionInstructions from "@/utils/actions/observe.json";
import plantActionInstructions from "@/utils/actions/plant.json";

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

function getActionInstructions(title: string) {
  switch (title.toLowerCase()) {
    case "identify plants":
      return observerActionInstructions;
    case "plant seedlings":
      return plantActionInstructions;
    case "litter cleanup":
      return litterActionInstructions;
  }
}

export async function getActions(chainId: number): Promise<Action[]> {
  try {
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

    console.log("🔍 getActions - Querying with chainId:", chainId);
    const { data, error } = await greenGoodsIndexer.query(QUERY, { chainId }).toPromise();

    console.log("🔍 getActions - Query result:", { data, error });
    console.log("🔍 getActions - Actions found:", data?.Action?.length || 0);

    if (error) {
      console.error("Error fetching actions:", error);
      return [];
    }

    if (!data || !data.Action || !Array.isArray(data.Action)) {
      console.warn("No actions data received");
      return [];
    }

    return await Promise.all(
      data.Action.map(async ({ id, title, startTime, endTime, capitals, media, createdAt }) => {
        const image =
          media && media.length > 0
            ? await getFileByHash(media[0])
                .then((res) => res)
                .catch((e) => {
                  console.log("Error fetching media", media[0], e);
                  return null;
                })
            : null;

        const mediaImage = image
          ? URL.createObjectURL(image.data as Blob)
          : "/images/no-image-placeholder.png";

        const instructions = getActionInstructions(title);

        return {
          id,
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
  } catch (error) {
    console.error("Unexpected error in getActions:", error);
    return [];
  }
}

export async function getGardens(chainId: number): Promise<Garden[]> {
  try {
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

    if (error) {
      console.error("Error fetching gardens:", error);
      return [];
    }

    if (!data || !data.Garden || !Array.isArray(data.Garden)) {
      console.warn("No gardens data received");
      return [];
    }

    return await Promise.all(
      data.Garden.map(async (garden) => {
        const image = garden.bannerImage
          ? await getFileByHash(garden.bannerImage)
              .then((res) => res)
              .catch((e) => {
                console.log("Error fetching garden banner", garden.bannerImage, e);
                return null;
              })
          : null;

        const bannerImage = image
          ? URL.createObjectURL(image.data as Blob)
          : "/images/no-image-placeholder.png";

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
  } catch (error) {
    console.error("Unexpected error in getGardens:", error);
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
