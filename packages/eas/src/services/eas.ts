import { ethers } from "ethers";
import { EAS, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";

import { ALCHEMY_API_KEY, PRIVATE_KEY } from "../constants";

const provider = new ethers.AlchemyProvider("sepolia", ALCHEMY_API_KEY);
const signer = new ethers.Wallet(PRIVATE_KEY).connect(provider);

const easSigner = () => {
  const EASContractAddress = "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

  // Initialize the sdk with the address of the EAS Schema contract address
  const eas = new EAS(EASContractAddress);

  // Gets a default provider (in production use something else like infura/alchemy)

  // Connects an ethers style provider/signingProvider to perform read/write functions.
  // MUST be a signer to do write operations!
  return eas.connect(signer);
};

const schemaRegistry = () => {
  const schemaRegistryContractAddress =
    "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0"; // Sepolia 0.26

  const schemaRegistry = new SchemaRegistry(schemaRegistryContractAddress);

  return schemaRegistry.connect(signer);
};

export { schemaRegistry, easSigner };
