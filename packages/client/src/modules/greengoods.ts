// import { greenGoodsIndexer } from "./urql";

import { User } from "@privy-io/react-auth";

export function getActions(): Action[] {
  return [
    {
      id: 0,
      startTime: 0,
      endTime: 0,
      title: "Planting",
      instructions: "cid:0x1234",
      capitals: [Capital.LIVING],
      media: [],
      createdAt: 0,
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
    },
  ];
}

export function getGardens(): GardenCard[] {
  return [
    {
      id: "0x3307e5392215f63189081ba49611eb7e1c5dabae",
      name: "Rio Claro",
      location: "Rio Claro, São Paulo",
      bannerImage:
        "https://media.discordapp.net/attachments/1258534967634559108/1277319972439457824/20240825_135614.jpg?ex=66d2026c&is=66d0b0ec&hm=97a45f46da958b3743bbe84d727f0e7e05a44628926a2e94bbec4807a9120286&=&format=webp&width=1412&height=1060",
      gardenOperators: ["0x3307e5392215f63189081ba49611eb7e1c5dabae"],
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
