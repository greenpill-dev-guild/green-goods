const { ethers, upgrades } = require("hardhat");

async function main() {
  // Deploying
  await ethers.provider.getSigner(0);
  const network = await ethers.provider.getNetwork();
}

main();
