import { PrivyClient } from "@privy-io/server-auth";
import type { VercelRequest, VercelResponse } from "@vercel/node";

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      VITE_PRIVY_APP_ID: string;
      PINATA_API_KEY: string;
      PINATA_API_SECRET: string;
      PRIVY_APP_SECRET_IDL: string;
    }
  }
}

export const config = {
  runtime: "nodejs",
};

const privy = new PrivyClient(
  process.env.VITE_PRIVY_APP_ID,
  process.env.PINATA_API_SECRET
);

export default async function handler(
  _request: VercelRequest,
  response: VercelResponse
) {
  const users = await privy.getUsers();

  response.status(200).json(users);
}
