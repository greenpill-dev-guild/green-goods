import { User } from "@privy-io/react-auth";

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

export function getActions(): Action[] {
  return [
    {
      id: 0,
      startTime: 0,
      endTime: 0,
      title: "Observation",
      instructions: "cid:0x1234",
      capitals: [Capital.LIVING],
      media: [],
      createdAt: 0,
      description: plantActionInstructions.description,
      inputs: plantActionInstructions.details.inputs as WorkInput[],
      mediaInfo: plantActionInstructions.media,
      details: plantActionInstructions.details,
      review: plantActionInstructions.review,
    },
    {
      id: 2,
      startTime: 0,
      endTime: 0,
      title: "Planting",
      instructions: "cid:0x1234",
      capitals: [Capital.LIVING],
      media: [],
      createdAt: 0,
      description: observerActionInstructions.description,
      inputs: observerActionInstructions.details.inputs as WorkInput[],
      mediaInfo: observerActionInstructions.media,
      details: observerActionInstructions.details,
      review: observerActionInstructions.review,
    },
  ];
}

export function getGardens(): Garden[] {
  const operators = [
    "0x2aa64E6d80390F5C017F0313cB908051BE2FD35e",
    "0xAcD59e854adf632d2322404198624F757C868C97,",
    "0x29e6cbF2450F86006292D10A3cF791955600a457",
    "0x41f842E28c5a18aAF1fCA0e5908E16d3Ff7e4E9c",
    "0x742fa58340df9Ad7c691De4Ed999CF7f71079A8F",
    "0xb084b8258e3409deCa8a5847aa5Ee9fda07a62A8",
  ];

  return [
    {
      id: "0xa9Cb249a3B651Ce82bf9E9cc48BCF41957647F48",
      name: "Root Planet",
      location: "Rio Claro, São Paulo",
      bannerImage: "https://picsum.photos/800/200",
      operators,
      gardeners: operators,
      gardenAssessments: [],
      description:
        "Observing invasive species and planting natives species to improve biodiversity.",
      tokenAddress: "0x9EF896a314B7aE98609eC0c0cA43724C768046B4",
      tokenID: 0,
    },
    {
      id: "0xa9Cb249a3B651Ce82bf9E9cc48B1957647F48",
      name: "Root Planet",
      location: "Rio Claro, São Paulo",
      bannerImage: "https://picsum.photos/800/200",
      operators,
      gardeners: operators,
      gardenAssessments: [],
      description:
        "Observing invasive species and planting natives species to improve biodiversity.",
      tokenAddress: "0x9EF896a314B7aE98609eC0c0cA43724C768046B4",
      tokenID: 0,
    },
  ];
}

export async function getGardeners(): Promise<User[]> {
  const request = await fetch(
    import.meta.env.DEV ? "http://localhost:3000/api/users" : "/api/users"
  );
  const response: User[] = await request.json();

  return response;
}
