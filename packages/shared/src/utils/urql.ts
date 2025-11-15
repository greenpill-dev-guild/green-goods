import {
	cacheExchange,
	createClient,
	errorExchange,
	fetchExchange,
	type Client,
} from "urql";

/**
 * Create URQL client with error handling
 *
 * @param indexerUrl - The GraphQL endpoint URL
 * @returns Configured URQL client
 */
export function createUrqlClient(indexerUrl: string): Client {
	return createClient({
		url: indexerUrl,
		exchanges: [
			errorExchange({
				onError: (error) => {
					console.error("GraphQL Error:", error);
					// You could add toast notifications here if needed
				},
			}),
			cacheExchange,
			fetchExchange,
		],
		fetchOptions: () => {
			return {
				headers: {
					"Content-Type": "application/json",
				},
			};
		},
	});
}
