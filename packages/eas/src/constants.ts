// biome-ignore lint/style/noNonNullAssertion: Environment variables are required for this package to function
export const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY!;
// biome-ignore lint/style/noNonNullAssertion: Environment variables are required for this package to function
export const PRIVATE_KEY = process.env.PRIVATE_KEY!;
export const PROD = process.env.PROD === "true";
