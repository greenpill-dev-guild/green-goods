import { initializePinata } from "@green-goods/shared/modules";

const DEFAULT_GATEWAY_BASE_URL = "https://greengoods.mypinata.cloud";

const pinataJwt = import.meta.env.VITE_PINATA_JWT;
const gatewayBaseUrl = import.meta.env.VITE_PINATA_GATEWAY ?? DEFAULT_GATEWAY_BASE_URL;

if (!pinataJwt) {
  console.warn(
    "VITE_PINATA_JWT is not configured. Pinata-backed media features will be unavailable."
  );
} else {
  initializePinata({
    jwt: pinataJwt,
    gatewayBaseUrl,
    // uploadUrl: "https://greengoods.mypinata.cloud",

    // uploadUrl: import.meta.env.VITE_PINATA_UPLOAD_URL,
    // endpointUrl: import.meta.env.VITE_PINATA_ENDPOINT_URL,
  });
}
