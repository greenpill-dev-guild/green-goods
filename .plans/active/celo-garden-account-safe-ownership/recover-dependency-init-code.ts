#!/usr/bin/env bun

import path from "node:path";
import { rename } from "node:fs/promises";
import { AbiCoder, concat, getCreate2Address, keccak256 } from "ethers";

const PLAN_ROOT = import.meta.dir;
const OUTPUT = path.join(PLAN_ROOT, "evidence", "celo-dependency-init-code-2026-08-15.json");
const FACTORY = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const DEPLOYER = "0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6";
const RESOLVER_STUB = "0x74c96fCEa9ad0345D476f0e4feF3D8Ef29C157d9";
const abi = AbiCoder.defaultAbiCoder();

interface Artifact {
  bytecode?: { object?: string } | string;
}

interface FrozenDependency {
  name:
    | "resolverStub"
    | "guardian"
    | "workApprovalResolverProxy"
    | "assessmentResolverProxy"
    | "gardenAccountImplementation";
  sourceTransactionHash: string;
  target: string;
  salt: string;
  initCodeHash: string;
  initCodeBytes: number;
  inputHash: string;
  artifact: string;
  constructorTypes: string[];
  constructorValues: unknown[];
}

const FROZEN: FrozenDependency[] = [
  {
    name: "resolverStub",
    sourceTransactionHash: "0x63389e34d2fa3577a973900a670ca3122b55eb60dc53d152b8a251c0a6039d68",
    target: RESOLVER_STUB,
    salt: "0xb8e2b4839a4bcb20a701002667aff37c6970ddf6973f15640db4596fe770a85b",
    initCodeHash: "0x96fb6b8979f6cd563e9d88555b850957b3ae8e1e6fba2e650d38a7e724ed1296",
    initCodeBytes: 3_325,
    inputHash: "0xa061237cfdd0197ffc16e2a91e80bbc0491df53d5ad77ee25b6c87f771acfcc9",
    artifact: "out-account/ResolverStub.sol/ResolverStub.json",
    constructorTypes: [],
    constructorValues: [],
  },
  {
    name: "guardian",
    sourceTransactionHash: "0x886e68f7f9654bc3411849a9108ee05a94936b594448b511d60e9fb703b0c896",
    target: "0x05F486E3161F895Ad99f041065224F78bDf580a7",
    salt: "0xd80ce91b7f038d4f7097354209f7a70ebd75f10f05468bae191e6d2594854741",
    initCodeHash: "0xf8dfa357377f7fa9605cf12e9a6d77c5ff70adfeb96b569c1863b39e43c0cac0",
    initCodeBytes: 1_371,
    inputHash: "0x87fe92189eb740dfb1c97d63eb22aeb0a0ba5700bf41650db38c1611e8a29828",
    artifact: "out-account/AccountGuardian.sol/AccountGuardian.json",
    constructorTypes: ["address"],
    constructorValues: [DEPLOYER],
  },
  {
    name: "workApprovalResolverProxy",
    sourceTransactionHash: "0xe9556e392bb829f265d2b8df8f1c5563e7197fead20c8e86ad0343d03142b146",
    target: "0x166732eD81Ab200A099215cF33F6A712309B69F7",
    salt: "0x080469a2df89af45a71882c2e2c8da445ba6b25c409b18d8420d9dfd66dfa2ca",
    initCodeHash: "0x8934c32aa8b4f8b160873ea9ce72aaa371be43d0d8134ef56374d29a5b48ff61",
    initCodeBytes: 1_077,
    inputHash: "0x4a099f86ca54a71c5f3baa13ffd5247951875c3dddfc68dce5c304152d3cd261",
    artifact: "out-account/ERC1967Proxy.sol/ERC1967Proxy.json",
    constructorTypes: ["address", "bytes"],
    constructorValues: [
      RESOLVER_STUB,
      "0xc4d66de8000000000000000000000000fbaf2a9734eae75497e1695706cc45ddfa346ad6",
    ],
  },
  {
    name: "assessmentResolverProxy",
    sourceTransactionHash: "0x087a21164b2eaf790ded3a4f6398bf028a64ec099e234c3e43e911efc908da4e",
    target: "0x0646B09bcf3993F02957651354dC267c450CFE58",
    salt: "0xf7f59a27ff12eaee7bf0324ac79182547ea079b89528ee84911b8a128edfd4f7",
    initCodeHash: "0x8934c32aa8b4f8b160873ea9ce72aaa371be43d0d8134ef56374d29a5b48ff61",
    initCodeBytes: 1_077,
    inputHash: "0x91a1588b542eb2cce96f8d8ef0cb9054acdeca051bd6d38384f3d12d106d7596",
    artifact: "out-account/ERC1967Proxy.sol/ERC1967Proxy.json",
    constructorTypes: ["address", "bytes"],
    constructorValues: [
      RESOLVER_STUB,
      "0xc4d66de8000000000000000000000000fbaf2a9734eae75497e1695706cc45ddfa346ad6",
    ],
  },
  {
    name: "gardenAccountImplementation",
    sourceTransactionHash: "0x7e9f70b7539e5e4dc87ca8752ff036a130dfc8355a32ff6444b7ef0815dce19b",
    target: "0xE31cAeAc029A60AD17A49278Fdd58032eF9Cf692",
    salt: "0xd80ce91b7f038d4f7097354209f7a70ebd75f10f05468bae191e6d2594854741",
    initCodeHash: "0x3a708bd560aa01c10c0bdca56f9865aa66b32948bdb8325e877ed2d83ac46e98",
    initCodeBytes: 20_463,
    inputHash: "0x76a7a8db3c98149c08c5510a1bff0a1b140c7ce139e08c7d10bc49f2a073c17c",
    artifact: "out-account/Garden.sol/GardenAccount.json",
    constructorTypes: ["address", "address", "address", "address", "address", "address"],
    constructorValues: [
      "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
      "0xcA11bde05977b3631167028862bE2a173976CA11",
      "0x000000006551c19487814612e58FE06813775758",
      "0x05F486E3161F895Ad99f041065224F78bDf580a7",
      "0x166732eD81Ab200A099215cF33F6A712309B69F7",
      "0x0646B09bcf3993F02957651354dC267c450CFE58",
    ],
  },
];

function parseHistoricalRoot(): string {
  const index = Bun.argv.indexOf("--historical-root");
  if (index < 0 || !Bun.argv[index + 1]) {
    throw new Error("Usage: bun recover-dependency-init-code.ts --historical-root <historical-contracts-root>");
  }
  return path.resolve(Bun.argv[index + 1]);
}

async function readCreationCode(root: string, relativeArtifact: string): Promise<string> {
  const artifactPath = path.join(root, relativeArtifact);
  const artifact = (await Bun.file(artifactPath).json()) as Artifact;
  const bytecode = typeof artifact.bytecode === "string" ? artifact.bytecode : artifact.bytecode?.object;
  if (!bytecode || !/^0x[0-9a-f]+$/iu.test(bytecode)) {
    throw new Error(`Missing concrete creation bytecode: ${artifactPath}`);
  }
  return bytecode;
}

async function main() {
  const historicalRoot = parseHistoricalRoot();
  const dependencies = [];

  for (const expected of FROZEN) {
    const creationCode = await readCreationCode(historicalRoot, expected.artifact);
    const constructorArgs =
      expected.constructorTypes.length === 0
        ? "0x"
        : abi.encode(expected.constructorTypes, expected.constructorValues);
    const initCode = concat([creationCode, constructorArgs]);
    const initCodeHash = keccak256(initCode);
    const initCodeBytes = (initCode.length - 2) / 2;
    const predicted = getCreate2Address(FACTORY, expected.salt, initCodeHash);
    const factoryInputHash = keccak256(concat([expected.salt, initCode]));

    if (
      initCodeHash !== expected.initCodeHash ||
      initCodeBytes !== expected.initCodeBytes ||
      predicted.toLowerCase() !== expected.target.toLowerCase() ||
      factoryInputHash !== expected.inputHash
    ) {
      throw new Error(`Historical reconstruction mismatch for ${expected.name}`);
    }

    dependencies.push({
      name: expected.name,
      sourceTransactionHash: expected.sourceTransactionHash,
      salt: expected.salt,
      initCode,
    });
  }

  const bundle = {
    schemaVersion: 1,
    repositoryCommit: "175469f2fc699712a9fa8016d6aa25390282989d",
    reconstruction: {
      tokenboundCommit: "2bd70ff3fb5f1c0e562425b4d5312f619d9f2720",
      kernelCommit: "e2041f376c970fd451a8ad8177268f106a7faca2",
      compiler: "0.8.28+commit.7893614a",
      profile: "production",
      factory: FACTORY,
      verification: "byte length, init-code hash, factory-input hash, and CREATE2 target",
    },
    dependencies,
  };

  const temporary = `${OUTPUT}.tmp`;
  await Bun.write(temporary, `${JSON.stringify(bundle, null, 2)}\n`);
  await rename(temporary, OUTPUT);
  console.log(`Wrote ${OUTPUT}`);
}

await main();
