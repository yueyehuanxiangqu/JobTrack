import { fileURLToPath } from "node:url";

// Launcher-only: keep import.meta.url directory resolution out of webpack.
export const projectRoot = fileURLToPath(new URL("../../", import.meta.url));
