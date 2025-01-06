import { User } from "@privy-io/react-auth";

import { greenGoodsIndexer } from "./urql";
import { greenGoodsGraphQL } from "./graphql";

import plantActionInstructions from "../utils/actions/plant.json";
import observerActionInstructions from "../utils/actions/observe.json";

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
  if (!data) console.error("No data found");

  return (
    data?.Action.map(
      ({
        id,
        title,
        instructions,
        startTime,
        endTime,
        capitals,
        media,
        createdAt,
      }) => ({
        id: parseInt(id),
        title,
        instructions,
        startTime: startTime as number,
        endTime: endTime as number,
        capitals,
        media,
        description: "",
        inputs: [],
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
      })
    ) ?? []
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
  if (!data) console.error("No data found");

  // const operators = [
  //   "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
  //   "0xAcD59e854adf632d2322404198624F757C868C97,",
  //   "0x29e6cbF2450F86006292D10A3cF791955600a457",
  //   "0x41f842E28c5a18aAF1fCA0e5908E16d3Ff7e4E9c",
  //   "0x742fa58340df9Ad7c691De4Ed999CF7f71079A8F",
  //   "0xb084b8258e3409deCa8a5847aa5Ee9fda07a62A8",
  // ];

  // return [
  //   {
  //     id: "0xa9Cb249a3B651Ce82bf9E9cc48BCF41957647F48",
  //     name: "Root Planet",
  //     location: "Rio Claro, São Paulo",
  //     bannerImage: "https://picsum.photos/800/200",
  //     operators,
  //     gardeners: operators,
  //     gardenAssessments: [],
  //     description:
  //       "Observing invasive species and planting natives species to improve biodiversity.",
  //     tokenAddress: "0x9EF896a314B7aE98609eC0c0cA43724C768046B4",
  //     tokenID: 0,
  //   },
  // ];

  return (
    data?.Garden.map((garden) => ({
      id: garden.id,
      tokenAddress: garden.tokenAddress,
      tokenID: garden.tokenID as number,
      name: garden.name,
      description: garden.description,
      location: garden.location,
      bannerImage: garden.bannerImage,
      gardeners: garden.gardeners,
      operators: garden.operators,
      gardenAssessments: [],
    })) ?? []
  );
}

export async function getGardeners(): Promise<User[]> {
  const request = await fetch(
    import.meta.env.DEV ? "http://localhost:3000/api/users" : "/api/users"
  );
  const response: User[] = await request.json();

  return response;
}
