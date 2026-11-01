import path from "node:path";
import { createHash } from "node:crypto";
import brand from "../../branding/brand.json" with { type: "json" };

export const origin = "http://127.0.0.1:3737";

export function localPaths(env = process.env) {
  const root = env.JOBTRACK_HOME || (env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, brand.dataDirectory));
  if (!root || !path.isAbsolute(root)) {
    throw new Error("LOCALAPPDATA (or JOBTRACK_HOME for testing) must be an absolute directory.");
  }
  const home = path.resolve(root);
  const config = path.join(home, "config");
  const data = path.join(home, "data");
  const id = createHash("sha256").update(process.platform === "win32" ? home.toLowerCase() : home).digest("hex").slice(0, 24);
  const pipe = (name) => process.platform === "win32"
    ? `\\\\.\\pipe\\jobtrack-${id}-${name}`
    : path.join(config, `${name}.sock`);
  return {
    home, config, data,
    files: path.join(data, "files"),
    resumes: path.join(data, "files", "resumes"),
    backups: path.join(data, "backups"),
    database: path.join(data, "jobsync.db"),
    logs: path.join(home, "logs"),
    settings: path.join(config, "runtime.json"),
    state: path.join(config, "instance.json"),
    launcherPipe: pipe("launcher"),
    serverPipe: pipe("server"),
  };
}

export function databaseUrl(database) {
  return `file:${database.replace(/\\/g, "/")}`;
}
