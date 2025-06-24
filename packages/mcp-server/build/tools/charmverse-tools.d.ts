interface CharmVerseSpace {
    id: string;
    name: string;
    domain: string;
    createdAt: string;
    updatedAt: string;
}
export declare const charmverseHandlers: {
    get_space_info: () => Promise<CharmVerseSpace>;
    list_pages: ({ type, limit }: {
        type?: string;
        limit?: number;
    }) => Promise<{
        space: string;
        status: string;
        message: string;
        instructions: string[];
    }>;
    get_members: ({ role }?: {
        role?: string;
    }) => Promise<{
        space: string;
        status: string;
        message: string;
    }>;
    get_proposals: ({ status }?: {
        status?: string;
    }) => Promise<{
        space: string;
        status: string;
        message: string;
    }>;
    search_charmverse: ({ query, type }: {
        query: string;
        type?: string;
    }) => Promise<{
        query: string;
        status: string;
        message: string;
        instructions: string;
    }>;
};
export {};
