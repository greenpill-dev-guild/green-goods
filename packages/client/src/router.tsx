import { createBrowserRouter, createHashRouter } from "react-router-dom";
import { publicAppRoutes, pwaAppRoutes } from "./config/routes";

// Use hash router for IPFS builds to ensure proper SPA routing on IPFS gateways
const createRouter =
  import.meta.env.VITE_USE_HASH_ROUTER === "true" ? createHashRouter : createBrowserRouter;

export const createPublicRouter = () => createRouter(publicAppRoutes);
export const createPwaRouter = () => createRouter(pwaAppRoutes);
