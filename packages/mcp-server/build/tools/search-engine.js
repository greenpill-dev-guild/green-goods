import lunr from "lunr";
import * as fs from "fs/promises";
import * as path from "path";
import NodeCache from "node-cache";
class SearchEngine {
    index = null;
    documents = new Map();
    cache = new NodeCache({ stdTTL: 600 }); // 10 minute cache
    isBuilding = false;
    async buildIndex() {
        if (this.isBuilding)
            return;
        this.isBuilding = true;
        try {
            const docs = [];
            // Load documentation files
            await this.loadDirectory(path.join(process.cwd(), "..", "..", "docs"), "markdown", docs);
            // Load README files
            await this.loadFile(path.join(process.cwd(), "..", "..", "README.md"), "markdown", docs);
            // Load contract files
            await this.loadDirectory(path.join(process.cwd(), "..", "contracts", "src"), "solidity", docs);
            // Build Lunr index
            this.index = lunr(function () {
                this.ref("id");
                this.field("title", { boost: 10 });
                this.field("content");
                this.field("type");
                docs.forEach(doc => {
                    this.add(doc);
                });
            });
            // Store documents for retrieval
            docs.forEach(doc => {
                this.documents.set(doc.id, doc);
            });
            console.log(`Search index built with ${docs.length} documents`);
        }
        catch (error) {
            console.error("Failed to build search index:", error);
        }
        finally {
            this.isBuilding = false;
        }
    }
    async loadDirectory(dirPath, type, docs) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory() && !entry.name.startsWith(".")) {
                    await this.loadDirectory(fullPath, type, docs);
                }
                else if (entry.isFile() && this.shouldIndex(entry.name)) {
                    await this.loadFile(fullPath, type, docs);
                }
            }
        }
        catch (error) {
            // Directory might not exist
        }
    }
    async loadFile(filePath, type, docs) {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            const relativePath = path.relative(process.cwd(), filePath);
            docs.push({
                id: relativePath,
                title: path.basename(filePath),
                content: content.substring(0, 5000), // Limit content size
                type,
                path: relativePath
            });
        }
        catch (error) {
            // File might not exist
        }
    }
    shouldIndex(filename) {
        const extensions = [".md", ".txt", ".sol", ".ts", ".tsx", ".js", ".jsx"];
        return extensions.some(ext => filename.endsWith(ext));
    }
    async search(query, options = {}) {
        const cacheKey = `search_${query}_${options.type || "all"}_${options.limit || 10}`;
        const cached = this.cache.get(cacheKey);
        if (cached)
            return cached;
        if (!this.index) {
            await this.buildIndex();
        }
        if (!this.index) {
            throw new Error("Search index not available");
        }
        const results = this.index.search(query);
        const limit = options.limit || 10;
        const formattedResults = results
            .slice(0, limit)
            .map(result => {
            const doc = this.documents.get(result.ref);
            if (!doc)
                return null;
            // Extract snippet around match
            const snippet = this.extractSnippet(doc.content, query);
            return {
                score: result.score,
                file: doc.path,
                title: doc.title,
                type: doc.type,
                snippet,
                matchedTerms: Object.keys(result.matchData.metadata)
            };
        })
            .filter(Boolean);
        const response = {
            query,
            results: formattedResults,
            totalResults: results.length,
            searchTime: new Date().toISOString()
        };
        this.cache.set(cacheKey, response);
        return response;
    }
    extractSnippet(content, query, contextLength = 150) {
        const lowerContent = content.toLowerCase();
        const lowerQuery = query.toLowerCase();
        const index = lowerContent.indexOf(lowerQuery);
        if (index === -1) {
            return content.substring(0, contextLength) + "...";
        }
        const start = Math.max(0, index - contextLength / 2);
        const end = Math.min(content.length, index + lowerQuery.length + contextLength / 2);
        let snippet = content.substring(start, end);
        if (start > 0)
            snippet = "..." + snippet;
        if (end < content.length)
            snippet = snippet + "...";
        return snippet;
    }
    async refreshIndex() {
        this.documents.clear();
        this.index = null;
        this.cache.flushAll();
        await this.buildIndex();
    }
}
export const searchEngine = new SearchEngine();
//# sourceMappingURL=search-engine.js.map