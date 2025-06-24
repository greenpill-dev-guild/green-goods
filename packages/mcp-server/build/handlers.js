import { Octokit } from "octokit";
import * as fs from "fs/promises";
import * as path from "path";
import { searchEngine } from "./tools/search-engine.js";
import { charmverseHandlers } from "./tools/charmverse-tools.js";
// Initialize GitHub client
const github = new Octokit({ auth: process.env.GITHUB_TOKEN });
// Handler map matching your configuration
export const handlers = {
    // Include all CharmVerse handlers
    ...charmverseHandlers,
    "get_issue": async ({ repo, number }) => {
        try {
            const issue = await github.rest.issues.get({
                owner: "greenpill-dev-guild",
                repo,
                issue_number: number
            });
            return {
                title: issue.data.title,
                body: issue.data.body,
                state: issue.data.state,
                labels: issue.data.labels.map(l => typeof l === 'string' ? l : l.name),
                created_at: issue.data.created_at,
                updated_at: issue.data.updated_at,
                html_url: issue.data.html_url
            };
        }
        catch (error) {
            throw new Error(`Failed to get issue: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    "search_docs": async ({ query, type, limit }) => {
        try {
            // Use the optimized search engine
            return await searchEngine.search(query, { type, limit });
        }
        catch (error) {
            // Fallback to simple search if index not available
            const docsPath = path.join(process.cwd(), "..", "..", "docs");
            const snippets = [];
            const searchInFile = async (filePath) => {
                const content = await fs.readFile(filePath, 'utf-8');
                const lines = content.split('\n');
                lines.forEach((line, index) => {
                    if (line.toLowerCase().includes(query.toLowerCase())) {
                        snippets.push({
                            file: path.relative(process.cwd(), filePath),
                            content: line.trim(),
                            line: index + 1
                        });
                    }
                });
            };
            const files = await fs.readdir(docsPath);
            for (const file of files) {
                if (file.endsWith('.md')) {
                    await searchInFile(path.join(docsPath, file));
                }
            }
            return {
                query,
                snippets: snippets.slice(0, limit || 10),
                total: snippets.length
            };
        }
    },
    "list_issues": async ({ repo, state = "open" }) => {
        try {
            const issues = await github.rest.issues.listForRepo({
                owner: "greenpill-dev-guild",
                repo,
                state: state,
                per_page: 20
            });
            return {
                repository: `greenpill-dev-guild/${repo}`,
                state,
                count: issues.data.length,
                issues: issues.data.map(issue => ({
                    number: issue.number,
                    title: issue.title,
                    state: issue.state,
                    created_at: issue.created_at,
                    html_url: issue.html_url
                }))
            };
        }
        catch (error) {
            throw new Error(`Failed to list issues: ${error instanceof Error ? error.message : String(error)}`);
        }
    },
    "analyze_contract": async ({ contractName }) => {
        try {
            const contractPath = path.join(process.cwd(), "..", "contracts", "src");
            // Look for the contract file
            const possiblePaths = [
                path.join(contractPath, `${contractName}.sol`),
                path.join(contractPath, "accounts", `${contractName}.sol`),
                path.join(contractPath, "registries", `${contractName}.sol`),
                path.join(contractPath, "tokens", `${contractName}.sol`),
                path.join(contractPath, "resolvers", `${contractName}.sol`)
            ];
            let contractFile = null;
            for (const p of possiblePaths) {
                try {
                    await fs.access(p);
                    contractFile = p;
                    break;
                }
                catch { }
            }
            if (!contractFile) {
                throw new Error(`Contract ${contractName} not found`);
            }
            const content = await fs.readFile(contractFile, 'utf-8');
            // Basic analysis
            const analysis = {
                contractName,
                file: path.relative(process.cwd(), contractFile),
                lines: content.split('\n').length,
                hasOwnable: content.includes('Ownable'),
                hasPausable: content.includes('Pausable'),
                hasReentrancyGuard: content.includes('ReentrancyGuard'),
                functions: (content.match(/function\s+\w+/g) || []).length,
                events: (content.match(/event\s+\w+/g) || []).length,
                modifiers: (content.match(/modifier\s+\w+/g) || []).length
            };
            return analysis;
        }
        catch (error) {
            throw new Error(`Contract analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
};
//# sourceMappingURL=handlers.js.map