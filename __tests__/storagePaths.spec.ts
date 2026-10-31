// @vitest-environment node
import path from "node:path";
import { storagePaths } from "@/lib/storagePaths";
import { APP_CONSTANTS } from "@/lib/constants";

afterEach(() => vi.unstubAllEnvs());

it("uses the isolated native data root for every attachment and backup path", () => {
  const home = path.resolve(".local-runtime-test", "路径 空格");
  vi.stubEnv("JOBSYNC_LOCAL_RUNTIME", "1");
  vi.stubEnv("JOBSYNC_HOME", home);
  expect(storagePaths()).toEqual({
    data: path.join(home, "data"),
    files: path.join(home, "data", "files"),
    resumes: path.join(home, "data", "files", "resumes"),
    jobAttachments: path.join(home, "data", "files", "jobs"),
    backups: path.join(home, "data", "backups"),
  });
});

it("retains Docker/dev storage defaults outside native mode", () => {
  vi.stubEnv("JOBSYNC_LOCAL_RUNTIME", "");
  vi.stubEnv("JOBSYNC_HOME", path.resolve("unused"));
  expect(storagePaths().data).toBe(APP_CONSTANTS.UPLOADS_DIR);
});
