import { initializePinata } from "@green-goods/shared/modules";

const pinataJwt = import.meta.env.VITE_PINATA_JWT;
const gatewayBaseUrl = import.meta.env.VITE_PINATA_GATEWAY;

if (!pinataJwt) {
  console.warn("VITE_PINATA_JWT is not configured. Media features will be unavailable.");
} else {
  initializePinata({
    jwt: pinataJwt,
    gatewayBaseUrl,
  }).catch((err) => {
    console.error("Failed to initialize Pinata:", err);
  });
}
