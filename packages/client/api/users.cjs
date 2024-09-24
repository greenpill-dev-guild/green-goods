const { PrivyClient } = require("@privy-io/server-auth");
// import type { VercelRequest, VercelResponse } from "@vercel/node";

// declare global {
//   namespace NodeJS {
//     interface ProcessEnv {
//       VITE_PRIVY_APP_ID?: string;
//       PINATA_API_KEY?: string;
//       PINATA_API_SECRET?: string;
//       PRIVY_APP_SECRET_ID?: string;
//     }
//   }
// }

export const config = {
  // runtime: "nodejs",
};

const privy = new PrivyClient(
  process.env.VITE_PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET_ID
);

export default async function handler(_request, response) {
  const users = await privy.getUsers();

  response.status(200).json(users);
}
