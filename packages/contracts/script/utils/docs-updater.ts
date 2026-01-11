import * as fs from "node:fs";
import * as path from "node:path";

/**
 * DocsUpdater - Automatically updates documentation with deployment data
 *
 * After contract deployments, this ensures docs have the latest schema UIDs
 * and contract addresses without manual copy/paste.
 */

interface DeploymentArtifact {
  schemas?: {
    workSchemaUID?: string;
    workApprovalSchemaUID?: string;
    assessmentSchemaUID?: string;
  };
  gardenToken?: string;
  actionRegistry?: string;
  workResolver?: string;
  workApprovalResolver?: string;
  [key: string]: any;
}

const CHAIN_MAP: Record<string, { name: string; chainId: number }> = {
  "42161": { name: "Arbitrum One", chainId: 42161 },
  "42220": { name: "Celo", chainId: 42220 },
  "84532": { name: "Base Sepolia", chainId: 84532 },
};

export class DocsUpdater {
  private contractsDir: string;
  private docsDir: string;

  constructor() {
    this.contractsDir = path.join(__dirname, "../../deployments");
    this.docsDir = path.join(__dirname, "../../../../docs/docs");
  }

  /**
   * Main entry point - update all docs with deployment data
   */
  async updateDocs(chainIds?: string[]): Promise<void> {
    const chains = chainIds || Object.keys(CHAIN_MAP);

    console.log("\n📝 Updating documentation with deployment data...\n");

    // Load deployment data for all chains
    const deployments: Record<string, DeploymentArtifact> = {};
    for (const chainId of chains) {
      const deploymentFile = path.join(this.contractsDir, `${chainId}-latest.json`);
      if (fs.existsSync(deploymentFile)) {
        deployments[chainId] = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
        console.log(`✅ Loaded deployment data for chain ${chainId} (${CHAIN_MAP[chainId]?.name})`);
      } else {
        console.log(`⚠️  No deployment found for chain ${chainId}, skipping`);
      }
    }

    if (Object.keys(deployments).length === 0) {
      console.log("❌ No deployments found to update docs with");
      return;
    }

    // Update schema UID table in attestations.md
    await this._updateAttestationsDoc(deployments);

    // Update API reference
    await this._updateApiReference(deployments);

    console.log("\n✅ Documentation updated successfully!\n");
  }

  /**
   * Update concepts/attestations.md with correct schema UIDs
   */
  private async _updateAttestationsDoc(deployments: Record<string, DeploymentArtifact>): Promise<void> {
    const filePath = path.join(this.docsDir, "concepts/attestations.md");

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${filePath} not found, skipping`);
      return;
    }

    let content = fs.readFileSync(filePath, "utf8");

    // Generate schema UID table content
    const tableContent = this._generateSchemaTable(deployments);

    // Replace the network schema table
    const pattern = /### Deployed Networks\s+Green Goods attestations are deployed on:[\s\S]*?(?=\n---|\n## )/;
    const replacement = `### Deployed Networks

Green Goods attestations are deployed on:

${tableContent}
`;

    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      fs.writeFileSync(filePath, content, "utf8");
      console.log("   ✅ Updated concepts/attestations.md");
    } else {
      console.log("   ⚠️  Could not find schema table section in attestations.md");
    }
  }

  /**
   * Update developer/api-reference.md with correct schema UIDs
   */
  private async _updateApiReference(deployments: Record<string, DeploymentArtifact>): Promise<void> {
    const filePath = path.join(this.docsDir, "developer/api-reference.md");

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  ${filePath} not found, skipping`);
      return;
    }

    let content = fs.readFileSync(filePath, "utf8");

    // Generate schema UID section
    const schemaSection = this._generateSchemaSection(deployments);

    // Replace the Schema UIDs section
    const pattern = /## Schema UIDs[\s\S]*?(?=\n---|\n## )/;
    const replacement = `## Schema UIDs

**For EAS GraphQL queries** - use these schema UIDs to filter attestations:

${schemaSection}
**Source**: \`packages/contracts/deployments/<chainId>-latest.json\`

`;

    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      fs.writeFileSync(filePath, content, "utf8");
      console.log("   ✅ Updated developer/api-reference.md");
    } else {
      console.log("   ⚠️  Could not find Schema UIDs section in api-reference.md");
    }
  }

  /**
   * Generate schema table for attestations.md
   */
  private _generateSchemaTable(deployments: Record<string, DeploymentArtifact>): string {
    let table = "";

    for (const [chainId, deployment] of Object.entries(deployments)) {
      const chainInfo = CHAIN_MAP[chainId];
      if (!chainInfo || !deployment.schemas) continue;

      table += `**${chainInfo.name}** (${chainId}):\n`;
      if (deployment.schemas.workSchemaUID) {
        table += `- Work Schema: \`${deployment.schemas.workSchemaUID}\`\n`;
      }
      if (deployment.schemas.workApprovalSchemaUID) {
        table += `- Approval Schema: \`${deployment.schemas.workApprovalSchemaUID}\`\n`;
      }
      if (deployment.schemas.assessmentSchemaUID) {
        table += `- Assessment Schema: \`${deployment.schemas.assessmentSchemaUID}\`\n`;
      }
      table += "\n";
    }

    return table;
  }

  /**
   * Generate schema section for api-reference.md
   */
  private _generateSchemaSection(deployments: Record<string, DeploymentArtifact>): string {
    let section = "";

    for (const [chainId, deployment] of Object.entries(deployments)) {
      const chainInfo = CHAIN_MAP[chainId];
      if (!chainInfo || !deployment.schemas) continue;

      section += `### ${chainInfo.name} (${chainId})\n\n`;
      if (deployment.schemas.workSchemaUID) {
        section += `- Work: \`${deployment.schemas.workSchemaUID}\`\n`;
      }
      if (deployment.schemas.workApprovalSchemaUID) {
        section += `- Approval: \`${deployment.schemas.workApprovalSchemaUID}\`\n`;
      }
      if (deployment.schemas.assessmentSchemaUID) {
        section += `- Assessment: \`${deployment.schemas.assessmentSchemaUID}\`\n`;
      }
      section += "\n";
    }

    return section;
  }

  /**
   * Generate a reference snippet for embedding in docs (future enhancement)
   * @param _chainIds - Optional chain IDs to include (currently unused, uses all chains)
   */
  generateContractAddressTable(_chainIds?: string[]): string {
    let table = "| Contract | Arbitrum | Celo | Base Sepolia |\n";
    table += "|----------|----------|------|-------------|\n";

    const contractKeys = [
      "gardenToken",
      "actionRegistry",
      "workResolver",
      "workApprovalResolver",
      "assessmentResolver",
    ];

    for (const key of contractKeys) {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      table += `| ${label} | `;

      for (const chainId of ["42161", "42220", "84532"]) {
        const deploymentFile = path.join(this.contractsDir, `${chainId}-latest.json`);
        if (fs.existsSync(deploymentFile)) {
          const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
          table += `\`${deployment[key]?.slice(0, 10)}...\` | `;
        } else {
          table += "N/A | ";
        }
      }
      table = table.slice(0, -3) + " |\n";
    }

    return table;
  }
}

// CLI usage
if (import.meta.main) {
  const updater = new DocsUpdater();
  const chainIds = process.argv.slice(2);
  updater.updateDocs(chainIds.length > 0 ? chainIds : undefined).catch(console.error);
}
