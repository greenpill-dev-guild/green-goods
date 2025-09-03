#!/usr/bin/env node

const { ethers } = require("ethers");
const fs = require("node:fs");
const path = require("node:path");

/**
 * Template Manager for Green Goods Factory System
 *
 * Manages deployment templates with expiration and approval workflows.
 * Integrates with existing DeploymentRegistry for secure contract deployment.
 */
class TemplateManager {
  constructor(deploymentRegistry, provider, signer) {
    this.registry = deploymentRegistry;
    this.provider = provider;
    this.signer = signer;
  }

  /**
   * Register a new deployment template
   * @param {string} name - Template name
   * @param {string} contractPath - Path to contract source
   * @param {number} expirationDays - Days until template expires
   * @param {Object} options - Additional options
   */
  async registerTemplate(name, contractPath, expirationDays = 30, options = {}) {
    console.log(`📋 Registering template: ${name}`);

    try {
      // Compile contract to get bytecode
      const bytecode = await this.getContractBytecode(contractPath);
      const templateHash = ethers.keccak256(bytecode);
      const expirationTime = Math.floor(Date.now() / 1000) + expirationDays * 24 * 60 * 60;

      // Register template with registry
      const tx = await this.registry.registerTemplate(templateHash, expirationTime);
      await tx.wait();

      // Save template metadata
      const templateData = {
        name,
        contractPath,
        templateHash,
        expirationTime,
        expirationDate: new Date(expirationTime * 1000).toISOString(),
        bytecode,
        registeredAt: new Date().toISOString(),
        registeredBy: await this.signer.getAddress(),
        ...options,
      };

      await this.saveTemplateMetadata(templateHash, templateData);

      console.log("✅ Template registered successfully:");
      console.log(`   Name: ${name}`);
      console.log(`   Hash: ${templateHash}`);
      console.log(`   Expires: ${templateData.expirationDate}`);

      return templateData;
    } catch (error) {
      console.error(`❌ Failed to register template ${name}:`, error.message);
      throw error;
    }
  }

  /**
   * Deploy contract using approved template
   * @param {string} templateHash - Hash of approved template
   * @param {string} salt - Salt for deterministic deployment
   * @param {Object} initParams - Initialization parameters
   */
  async deployFromTemplate(templateHash, salt, initParams = {}) {
    console.log(`🚀 Deploying from template: ${templateHash}`);

    try {
      // Load template metadata
      const template = await this.loadTemplateMetadata(templateHash);
      if (!template) {
        throw new Error(`Template not found: ${templateHash}`);
      }

      // Prepare initialization data
      const initData = initParams ? this.encodeInitData(initParams) : "0x";

      // Deploy via registry
      const tx = await this.registry.deployViaFactory(
        templateHash,
        template.bytecode,
        ethers.id(salt), // Convert string to bytes32
        initData,
      );

      const receipt = await tx.wait();
      const deployedAddress = await this.extractDeployedAddress(receipt);

      console.log("✅ Contract deployed successfully:");
      console.log(`   Template: ${template.name}`);
      console.log(`   Address: ${deployedAddress}`);
      console.log(`   Salt: ${salt}`);

      return {
        address: deployedAddress,
        template: template.name,
        templateHash,
        salt,
        transactionHash: receipt.hash,
      };
    } catch (deployError) {
      console.error("❌ Failed to deploy from template:", deployError.message);
      throw deployError;
    }
  }

  /**
   * List all registered templates
   */
  async listTemplates() {
    const templatesDir = this.getTemplatesDir();
    const templateFiles = fs.readdirSync(templatesDir).filter((f) => f.endsWith(".json"));

    console.log(`📋 Registered Templates (${templateFiles.length}):`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    for (const file of templateFiles) {
      try {
        const templateData = JSON.parse(fs.readFileSync(path.join(templatesDir, file), "utf8"));
        const isExpired = Date.now() / 1000 > templateData.expirationTime;
        const status = isExpired ? "❌ EXPIRED" : "✅ ACTIVE";

        console.log(`${status} ${templateData.name}`);
        console.log(`   Hash: ${templateData.templateHash}`);
        console.log(`   Expires: ${templateData.expirationDate}`);
        console.log(`   Contract: ${templateData.contractPath}`);
        console.log("");
      } catch (error) {
        console.log(`⚠️  Invalid template file: ${file}`);
      }
    }
  }

  /**
   * Get contract bytecode for template registration
   */
  async getContractBytecode(contractPath) {
    // This would typically compile the contract
    // For now, we'll read from the out/ directory
    const artifactPath = contractPath.replace("src/", "out/").replace(".sol", ".sol/");
    const contractName = path.basename(contractPath, ".sol");
    const artifactFile = path.join(artifactPath, `${contractName}.json`);

    if (!fs.existsSync(artifactFile)) {
      throw new Error(`Contract artifact not found: ${artifactFile}. Run 'forge build' first.`);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactFile, "utf8"));
    return artifact.bytecode.object;
  }

  /**
   * Encode initialization data for contract deployment
   */
  encodeInitData(_initParams) {
    // This would encode the initialization parameters
    // Implementation depends on the specific contract's initialize function
    return "0x";
  }

  /**
   * Extract deployed contract address from transaction receipt
   */
  async extractDeployedAddress(receipt) {
    // Look for ContractDeployedViaFactory event
    const factoryEvent = receipt.logs.find(
      (log) => log.topics[0] === ethers.id("ContractDeployedViaFactory(bytes32,address,bytes32,address)"),
    );

    if (factoryEvent) {
      const decoded = this.registry.interface.parseLog(factoryEvent);
      return decoded.args.deployed;
    }

    throw new Error("Could not extract deployed address from receipt");
  }

  /**
   * Save template metadata to local storage
   */
  async saveTemplateMetadata(templateHash, templateData) {
    const templatesDir = this.getTemplatesDir();
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }

    const filename = `${templateHash}.json`;
    const filepath = path.join(templatesDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(templateData, null, 2));
  }

  /**
   * Load template metadata from local storage
   */
  async loadTemplateMetadata(templateHash) {
    const templatesDir = this.getTemplatesDir();
    const filepath = path.join(templatesDir, `${templateHash}.json`);

    if (!fs.existsSync(filepath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(filepath, "utf8"));
  }

  /**
   * Get templates directory path
   */
  getTemplatesDir() {
    return path.join(__dirname, "..", "templates");
  }

  /**
   * Emergency template approval (for guardian use)
   */
  async emergencyApproveTemplate(templateHash, guardianSigner) {
    console.log(`🚨 Emergency template approval: ${templateHash}`);

    try {
      const registryWithGuardian = this.registry.connect(guardianSigner);
      const tx = await registryWithGuardian.emergencyApproveTemplate(templateHash);
      await tx.wait();

      console.log("✅ Emergency template approved (24h expiration)");
      console.log(`   Hash: ${templateHash}`);
      console.log(`   Guardian: ${await guardianSigner.getAddress()}`);

      return tx.hash;
    } catch (error) {
      console.error("❌ Emergency approval failed:", error.message);
      throw error;
    }
  }

  /**
   * Revoke deployer access (emergency guardian)
   */
  async emergencyRevokeDeployer(deployerAddress, guardianSigner) {
    console.log(`🚨 Emergency deployer revocation: ${deployerAddress}`);

    try {
      const registryWithGuardian = this.registry.connect(guardianSigner);
      const tx = await registryWithGuardian.emergencyRevokeDeployer(deployerAddress);
      await tx.wait();

      console.log("✅ Deployer access revoked");
      console.log(`   Deployer: ${deployerAddress}`);
      console.log(`   Guardian: ${await guardianSigner.getAddress()}`);

      return tx.hash;
    } catch (error) {
      console.error("❌ Emergency revocation failed:", error.message);
      throw error;
    }
  }

  /**
   * Check template status
   */
  async checkTemplateStatus(templateHash) {
    try {
      const [isApproved, expirationTime] = await Promise.all([
        this.registry.approvedTemplates(templateHash),
        this.registry.templateExpirations(templateHash),
      ]);

      const isExpired = Date.now() / 1000 > expirationTime;
      const template = await this.loadTemplateMetadata(templateHash);

      return {
        hash: templateHash,
        name: template?.name || "Unknown",
        approved: isApproved,
        expired: isExpired,
        expirationTime,
        expirationDate: new Date(expirationTime * 1000).toISOString(),
      };
    } catch (error) {
      console.error("❌ Failed to check template status:", error.message);
      throw error;
    }
  }
}

module.exports = { TemplateManager };
