import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

type ArtifactWithAbi = {
  abi?: unknown;
};

const ABI_SOURCES = [
  {
    source: "Garden.sol/GardenToken.json",
    target: "GardenToken.json",
  },
  {
    source: "Garden.sol/GardenAccount.json",
    target: "GardenAccount.json",
  },
  {
    source: "Action.sol/ActionRegistry.json",
    target: "ActionRegistry.json",
  },
  {
    source: "EAS.sol/MockEAS.json",
    target: "MockEAS.json",
  },
  {
    source: "ENS.sol/GreenGoodsENS.json",
    target: "GreenGoodsENS.json",
  },
  {
    source: "IHats.sol/IHats.json",
    target: "IHats.json",
  },
] as const;

function main(): void {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const contractsDir = path.resolve(scriptDir, "..");
  const outDir = path.join(contractsDir, "out");
  const abiDir = path.join(contractsDir, "abis");

  fs.mkdirSync(abiDir, { recursive: true });

  for (const item of ABI_SOURCES) {
    const sourcePath = path.join(outDir, item.source);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing source artifact: ${sourcePath}`);
    }

    const parsed = JSON.parse(fs.readFileSync(sourcePath, "utf8")) as ArtifactWithAbi;
    if (!Array.isArray(parsed.abi)) {
      throw new Error(`Artifact does not contain an ABI array: ${sourcePath}`);
    }

    const targetPath = path.join(abiDir, item.target);
    const nextContent = `${JSON.stringify(parsed.abi, null, 2)}\n`;
    const prevContent = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf8") : "";

    if (prevContent !== nextContent) {
      fs.writeFileSync(targetPath, nextContent);
      console.log(`updated ${path.relative(contractsDir, targetPath)}`);
    } else {
      console.log(`unchanged ${path.relative(contractsDir, targetPath)}`);
    }
  }
}

main();
