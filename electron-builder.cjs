const brand = require("./branding/brand.json");
module.exports = {
  afterPack: async ({ appOutDir }) => {
    const fs = require("node:fs");
    const path = require("node:path");
    for (const file of ["runtime/node.exe", "runtime/LICENSE", "web/node_modules/prisma/build/index.js",
      "web/node_modules/@prisma/engines/schema-engine-windows.exe", "web/node_modules/.prisma/client/query_engine-windows.dll.node",
      "web/.next-desktop/BUILD_ID", "web/.next-desktop/static", "web/prisma/migrations", "web/public", "web/scripts/local/server.mjs"]) {
      if (!fs.existsSync(path.join(appOutDir, "resources", file))) throw new Error(`Incomplete desktop resources: ${file}`);
    }
  },
  appId: brand.appId,
  productName: brand.name,
  directories: { app: ".desktop-build/app", output: "dist-desktop" },
  files: ["desktop/**", "scripts/local/{runtime,paths,project,home-migration}.mjs", "branding/brand.json", "package.json", "LICENSE", "!node_modules/**"],
  extraResources: [
    { from: ".desktop-build/web", to: "web", filter: ["**/*"] },
    // electron-builder excludes a root node_modules from generic directory
    // copies. An explicit mapping is required for the standalone backend.
    { from: ".desktop-build/web/node_modules", to: "web/node_modules", filter: ["**/*",
      "!**/*.map", "!**/*.d.ts", "!**/*.d.cts", "!**/*.d.mts",
      "!**/{test,tests,__tests__,docs,examples,benchmarks}/**"] },
    { from: ".desktop-build/runtime", to: "runtime" },
  ],
  electronFuses: { runAsNode: false, enableNodeOptionsEnvironmentVariable: false, onlyLoadAppFromAsar: true },
  asar: true,
  npmRebuild: false,
  artifactName: "JobTrack-Setup-${version}.${ext}",
  win: { target: [{ target: "nsis", arch: ["x64"] }], icon: ".desktop-build/icon.ico" },
  nsis: { oneClick: true, perMachine: false, allowElevation: false, runAfterFinish: false, createDesktopShortcut: "always", createStartMenuShortcut: true, shortcutName: brand.name, installerIcon: "branding/jobtrack.ico", uninstallerIcon: "branding/jobtrack.ico", installerHeaderIcon: "branding/jobtrack.ico", deleteAppDataOnUninstall: false },
};
