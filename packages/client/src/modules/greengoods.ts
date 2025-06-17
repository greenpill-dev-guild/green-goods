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

  if (error || !data) return [];

  return await Promise.all(
    data.Action.map(
      async ({ id, title, instructions, startTime, endTime, capitals, media, createdAt }) => {
        const image = (await getFileByHash(media[0])).data;
        const mediaImage = URL.createObjectURL(image as Blob);

        return {
          id: Number.parseInt(id),
          title,
          instructions,
          startTime: startTime as number,
          endTime: endTime as number,
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
          createdAt,
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

  if (error || !data) return [];

  return await Promise.all(
    data.Garden.map(async (garden) => {
      const image = (await getFileByHash(garden.bannerImage)).data;

      const bannerImage = URL.createObjectURL(image as Blob);

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
        createdAt: new Date(garden.createdAt),
      };
    })
  );
}

export async function getGardeners(): Promise<GardenerCard[]> {
  const request = await fetch(import.meta.env.DEV ? "/api/users" : "/api/users");

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
