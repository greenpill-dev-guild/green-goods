import type { User } from "@privy-io/react-auth";

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

export async function getActions(): Promise<Action[]> {
  const QUERY = greenGoodsGraphQL(/* GraphQL */ `
    query Actions {
      Action {
        id
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

  const { data, error } = await greenGoodsIndexer.query(QUERY, {}).toPromise();

  if (error) console.error(error);
  if (!data) return [];

  return await Promise.all(
    data.Action.map(
      async ({ id, title, instructions, startTime, endTime, capitals, media, createdAt }) => {
        const image = await getFileByHash(media[0])
          .then((res) => res)
          .catch((e) => {
            console.log("Error", media[0], e);
            return null;
          });

        const mediaImage = image
          ? URL.createObjectURL(image.data as Blob)
          : "/images/no-image-placeholder.png";

        return {
          id: Number.parseInt(id),
          title,
          instructions,
          startTime: (startTime as number) * 1000,
          endTime: (endTime as number) * 1000,
          capitals: capitals as Capital[],
          media: [mediaImage],
          description: "",
          inputs:
            id === "1"
              ? (plantActionInstructions.details.inputs as WorkInput[])
              : (observerActionInstructions.details.inputs as WorkInput[]),
          mediaInfo: id === "1" ? plantActionInstructions.media : observerActionInstructions.media,
          details:
            id === "1" ? plantActionInstructions.details : observerActionInstructions.details,
          review: id === "1" ? plantActionInstructions.review : observerActionInstructions.review,
          createdAt: new Date(createdAt * 1000),
        };
      }
    )
  );
}

export async function getGardens(): Promise<Garden[]> {
  const QUERY = greenGoodsGraphQL(/* GraphQL */ `
    query Gardens {
      Garden {
        id
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

  const { data, error } = await greenGoodsIndexer.query(QUERY, {}).toPromise();

  if (error) console.error(error);
  if (!data) return [];

  return await Promise.all(
    data.Garden.map(async (garden) => {
      const image = await getFileByHash(garden.bannerImage)
        .then((res) => res)
        .catch((e) => {
          console.log("Error", garden.bannerImage, e);
          return null;
        });

      const bannerImage = image
        ? URL.createObjectURL(image.data as Blob)
        : "/images/no-image-placeholder.png";

      return {
        id: garden.id,
        tokenAddress: garden.tokenAddress,
        tokenID: garden.tokenID as number,
        name: garden.name,
        description: garden.description,
        location: garden.location,
        bannerImage,
        gardeners: garden.gardeners,
        operators: garden.operators,
        assessments: [],
        works: [],
        createdAt: new Date(garden.createdAt * 1000),
      };
    })
  );
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
      registeredAt: user.createdAt,
      account: user.smartWallet?.address,
      email: user.email?.address,
      phone: user.phone?.number,
      location: "",
      username: user.customMetadata?.username as string,
      avatar: user.farcaster?.pfp || (user.customMetadata?.avatar as string),
    };
  });
}
