import { launch } from "./runtime.mjs";

const args = process.argv.slice(2);
const command = args[0] || "start";
if (!["start", "stop", "setup", "status"].includes(command) || args.slice(1).some((arg) => !["--no-browser", "--rebuild"].includes(arg))) {
  console.error("Usage: node scripts/local/cli.mjs start|stop|setup|status [--no-browser] [--rebuild]");
  process.exitCode = 1;
} else {
  try { await launch(command, { noBrowser: args.includes("--no-browser"), rebuild: args.includes("--rebuild") }); }
  catch (error) { console.error(`\nJobSync: ${error.message}`); process.exitCode = 1; }
}
