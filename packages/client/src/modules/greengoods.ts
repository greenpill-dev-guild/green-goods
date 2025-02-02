import { User } from "@privy-io/react-auth";

import plantActionInstructions from "@/utils/actions/plant.json";
import observerActionInstructions from "@/utils/actions/observe.json";

import { getFileByHash } from "./pinata";
import { greenGoodsIndexer } from "./urql";
import { greenGoodsGraphQL } from "./graphql";

export enum Capital {
  SOCIAL,
  MATERIAL,
  FINANCIAL,
  LIVING,
  INTELLECTUAL,
  EXPERIENTIAL,
  SPIRITUAL,
  CULTURAL,
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
      async ({
        id,
        title,
        instructions,
        startTime,
        endTime,
        capitals,
        media,
        createdAt,
      }) => {
        const image = (await getFileByHash(media[0])).data;
        const mediaImage = URL.createObjectURL(image as Blob);

        return {
          id: parseInt(id),
          title,
          instructions,
          startTime: startTime as number,
          endTime: endTime as number,
          capitals: capitals as Capital[],
          media: [mediaImage],
          description: "",
          inputs:
            id === "1" ?
              (plantActionInstructions.details.inputs as WorkInput[])
            : (observerActionInstructions.details.inputs as WorkInput[]),
          mediaInfo:
            id === "1" ?
              plantActionInstructions.media
            : observerActionInstructions.media,
          details:
            id === "1" ?
              plantActionInstructions.details
            : observerActionInstructions.details,
          review:
            id === "1" ?
              plantActionInstructions.review
            : observerActionInstructions.review,
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

  if (error) console.error(error);
  if (!data) return [];

  return await Promise.all(
    data.Garden.map(async (garden) => {
      const image = (
        await getFileByHash("QmS8mL4x9fnNutV63pSfwRhhVgoVpw4gaDCCGaTpv6oMGW")
      ).data;

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
  const request = await fetch(
    import.meta.env.DEV ? "/api/users" : "/api/users"
  );

  const response: User[] = await request.json();

  console.log("Gardeners", response);

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
