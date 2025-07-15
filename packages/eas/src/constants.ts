export const ALCHEMY_API_KEY =
	process.env.ALCHEMY_API_KEY ||
	(() => {
		throw new Error("ALCHEMY_API_KEY environment variable is required");
	})();
export const PRIVATE_KEY =
	process.env.PRIVATE_KEY ||
	(() => {
		throw new Error("PRIVATE_KEY environment variable is required");
	})();
export const PROD = process.env.PROD === "true";
