declare class SearchEngine {
    private index;
    private documents;
    private cache;
    private isBuilding;
    buildIndex(): Promise<void>;
    private loadDirectory;
    private loadFile;
    private shouldIndex;
    search(query: string, options?: {
        type?: string;
        limit?: number;
    }): Promise<{}>;
    private extractSnippet;
    refreshIndex(): Promise<void>;
}
export declare const searchEngine: SearchEngine;
export {};
