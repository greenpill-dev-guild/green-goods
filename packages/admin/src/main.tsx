import { bootAdmin } from "@/components/Boot/bootAdmin";

import "@/index.css";

// The boot sequence mounts a visible shell before any optional service runs,
// loads the application tree, and turns a startup failure into a recovery
// card instead of an empty root. See components/Boot/bootAdmin.tsx.
void bootAdmin();
