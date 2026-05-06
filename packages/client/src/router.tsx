import { createBrowserRouter, createHashRouter } from "react-router-dom";
import { appRoutes } from "./router.config";

// Use hash router for IPFS builds to ensure proper SPA routing on IPFS gateways
const createRouter =
  import.meta.env.VITE_USE_HASH_ROUTER === "true" ? createHashRouter : createBrowserRouter;

export { appRoutes };
export const router = createRouter(appRoutes);
