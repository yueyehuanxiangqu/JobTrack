import "server-only";
import path from "node:path";
import { APP_CONSTANTS } from "@/lib/constants";
import { localPaths } from "../../scripts/local/paths.mjs";

// Keep the existing Docker/dev defaults. Native mode is selected only by
// the local launcher; no server paths are imported into client components.
export function storagePaths() {
  const data = process.env.JOBSYNC_LOCAL_RUNTIME === "1"
    ? localPaths().data
    : APP_CONSTANTS.UPLOADS_DIR;
  return {
    data,
    files: path.join(data, "files"),
    resumes: path.join(data, "files", "resumes"),
    backups: path.join(data, "backups"),
  };
}
