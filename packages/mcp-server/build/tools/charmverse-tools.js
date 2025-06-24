import NodeCache from "node-cache";
// Cache for CharmVerse data (5 minutes TTL)
const cache = new NodeCache({ stdTTL: 300 });
// NOTE: The CharmVerse API is in early alpha and requires requesting access
// Request access via Discord: https://discord.gg/charmverse
// API docs will be available at: https://app.charmverse.io/api-docs
const CHARMVERSE_API_BASE = "https://app.charmverse.io/api";
const GREENPILL_SPACE_DOMAIN = "greenpill-dev-guild";
// Helper function to get headers with authentication
function getHeaders() {
    const headers = {
        "Content-Type": "application/json",
    };
    if (process.env.CHARMVERSE_API_KEY) {
        headers["Authorization"] = `Bearer ${process.env.CHARMVERSE_API_KEY}`;
    }
    return headers;
}
// Helper function to check if API key is configured
function checkApiKey() {
    if (!process.env.CHARMVERSE_API_KEY) {
        throw new Error("CharmVerse API key not configured. The CharmVerse API is in early alpha. " +
            "To request access:\n" +
            "1. Join their Discord: https://discord.gg/charmverse\n" +
            "2. Request API access in #🆘⎜product-support\n" +
            "3. Once you receive your API key, add it to your .env file as CHARMVERSE_API_KEY");
    }
}
export const charmverseHandlers = {
    "get_space_info": async () => {
        checkApiKey();
        const cacheKey = `space_${GREENPILL_SPACE_DOMAIN}`;
        const cached = cache.get(cacheKey);
        if (cached)
            return cached;
        try {
            // NOTE: This endpoint structure is a placeholder
            // The actual endpoint will be provided in the CharmVerse API documentation
            const response = await fetch(`${CHARMVERSE_API_BASE}/spaces/${GREENPILL_SPACE_DOMAIN}`, {
                headers: getHeaders()
            });
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("CharmVerse API endpoint not found. The API structure may have changed. " +
                        "Please check the latest documentation at https://app.charmverse.io/api-docs");
                }
                throw new Error(`Failed to fetch space info: ${response.status} ${response.statusText}`);
            }
            const data = await response.json();
            cache.set(cacheKey, data);
            return data;
        }
        catch (error) {
            throw new Error(`CharmVerse API error: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    "list_pages": async ({ type, limit = 20 }) => {
        checkApiKey();
        // For now, return a helpful message about the API status
        return {
            space: GREENPILL_SPACE_DOMAIN,
            status: "api_pending",
            message: "CharmVerse API integration is pending. Please ensure you have requested API access.",
            instructions: [
                "1. Join CharmVerse Discord: https://discord.gg/charmverse",
                "2. Request API access in #🆘⎜product-support channel",
                "3. Provide: project nature, CharmVerse domain, wallet address",
                "4. Once approved, add your API key to .env file"
            ]
        };
    },
    "get_members": async ({ role } = {}) => {
        checkApiKey();
        return {
            space: GREENPILL_SPACE_DOMAIN,
            status: "api_pending",
            message: "CharmVerse API integration is pending. Please ensure you have requested API access."
        };
    },
    "get_proposals": async ({ status } = {}) => {
        checkApiKey();
        return {
            space: GREENPILL_SPACE_DOMAIN,
            status: "api_pending",
            message: "CharmVerse API integration is pending. Please ensure you have requested API access."
        };
    },
    "search_charmverse": async ({ query, type }) => {
        checkApiKey();
        return {
            query,
            status: "api_pending",
            message: "CharmVerse API integration is pending. Please ensure you have requested API access.",
            instructions: "Visit https://app.charmverse.io/api-docs for API documentation once you have access."
        };
    }
};
//# sourceMappingURL=charmverse-tools.js.map