import { access, mkdir, realpath, rm, symlink } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describeSymbolicLink, resolveGlobalNpmPrefix } from "./global-npm-prefix.mjs";

const workspaceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const nativeBinary = path.join(workspaceRoot, "crates", "target", "debug", process.platform === "win32" ? "runx.exe" : "runx");
const workerBinary = path.join(
  workspaceRoot,
  "crates",
  "target",
  "debug",
  process.platform === "win32" ? "runx-js-worker.exe" : "runx-js-worker",
);
const globalPrefix = resolveGlobalNpmPrefix(workspaceRoot);

const globalBinDir = path.join(globalPrefix, "bin");
const globalBinLink = path.join(globalBinDir, process.platform === "win32" ? "runx.exe" : "runx");

const mode = process.argv.includes("--unlink") ? "unlink" : process.argv.includes("--check") ? "check" : "link";

if (mode === "unlink") {
  await rm(globalBinLink, { force: true });
  process.stdout.write(["runx dev-native link removed", `binary   ${globalBinLink}`].join("\n") + "\n");
  process.exit(0);
}

if (mode === "check") {
  process.stdout.write(
    ["runx dev-native link status", `prefix   ${globalPrefix}`, `binary   ${await describeSymbolicLink(globalBinLink)}`].join(
      "\n",
    ) + "\n",
  );
  process.exit(0);
}

await access(nativeBinary, constants.X_OK).catch(() => {
  throw new Error(
    `native debug binary is not executable: ${nativeBinary}\n`
    + "Run: cargo build --manifest-path crates/Cargo.toml -p runx-cli -p runx-js-worker --bins",
  );
});
await access(workerBinary, constants.X_OK).catch(() => {
  throw new Error(
    `native JavaScript worker is not executable: ${workerBinary}\n`
    + "Run: cargo build --manifest-path crates/Cargo.toml -p runx-cli -p runx-js-worker --bins",
  );
});
await mkdir(globalBinDir, { recursive: true });
await rm(globalBinLink, { recursive: true, force: true });
await symlink(nativeBinary, globalBinLink, "file");

process.stdout.write(
  [
    "runx dev-native link updated",
    `prefix   ${globalPrefix}`,
    `binary   ${globalBinLink} -> ${await realpath(globalBinLink)}`,
    "",
    "This links `runx` directly to crates/target/debug/runx for workspace dogfood. Re-run after clean builds if the target directory changes.",
  ].join("\n") + "\n",
);
