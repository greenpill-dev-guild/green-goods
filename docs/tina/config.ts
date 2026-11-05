import { defineConfig } from "tinacms";
import { communityCollections } from "./collections";

export default defineConfig({
  clientId: "9af73be7-afb5-483c-87c3-11ed116109b6",
  telemetry: "disabled",
  token: process.env.TINA_TOKEN,
  branch: process.env.TINA_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || "develop",
  client: { skip: true },
  build: { publicFolder: "static", outputFolder: "admin" },
  media: { tina: { publicFolder: "static", mediaRoot: "img" } },
  schema: { collections: communityCollections },
});
