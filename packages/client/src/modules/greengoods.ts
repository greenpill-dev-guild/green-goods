import { User } from "@privy-io/react-auth";

import plantActionInstructions from "../utils/actions/plant.json";
import observerActionInstructions from "../utils/actions/observe.json";

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
      id: 0,
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
  return [
    {
      id: "0xf226185e4e76d05EC2cbb9BF1B04e67E25532ecA",
      name: "Too Many Trees",
      location: "Rio Claro, São Paulo",
      bannerImage: "",
      operators: ["0x3307e5392215f63189081ba49611eb7e1c5dabae"],
      gardeners: ["0x3307e5392215f63189081ba49611eb7e1c5dabae"],
      gardenAssessments: [],
      description: "A garden in Rio Claro, São Paulo",
      tokenAddress: "",
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
