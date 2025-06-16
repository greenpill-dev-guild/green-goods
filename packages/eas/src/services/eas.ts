import { EAS, SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

import { ALCHEMY_API_KEY, PRIVATE_KEY, PROD } from "../constants";

const provider = new ethers.AlchemyProvider(
	PROD ? "arbitrum" : "sepolia",
	ALCHEMY_API_KEY,
);
const signer = new ethers.Wallet(PRIVATE_KEY).connect(provider);

const easSigner = () => {
	const EASContractAddress = PROD
		? "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458"
		: "0xC2679fBD37d54388Ce493F1DB75320D236e1815e"; // Sepolia v0.26

	// Initialize the sdk with the address of the EAS Schema contract address
	const eas = new EAS(EASContractAddress);

	// Gets a default provider (in production use something else like infura/alchemy)

	// Connects an ethers style provider/signingProvider to perform read/write functions.
	// MUST be a signer to do write operations!
	return eas.connect(signer);
};

const schemaRegistry = () => {
	const schemaRegistryContractAddress = PROD
		? "0xA310da9c5B885E7fb3fbA9D66E9Ba6Df512b78eB"
		: "0x0a7E2Ff54e76B8E6659aedc9103FB21c038050D0"; // Sepolia 0.26

	const schemaRegistry = new SchemaRegistry(schemaRegistryContractAddress);

	return schemaRegistry.connect(signer);
};

export { schemaRegistry, easSigner };
