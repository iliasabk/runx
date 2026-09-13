import { mkdir, realpath, rm, symlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describeSymbolicLink, resolveGlobalNpmPrefix } from "./global-npm-prefix.mjs";

const workspaceRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const cliPackageDir = path.join(workspaceRoot, "packages", "cli");
const globalPrefix = resolveGlobalNpmPrefix(workspaceRoot);

const globalBinDir = path.join(globalPrefix, "bin");
const globalNodeModulesDir = path.join(globalPrefix, "lib", "node_modules");
const globalScopeDir = path.join(globalNodeModulesDir, "@runxhq");
const globalPackageLink = path.join(globalScopeDir, "cli");
const globalBinLink = path.join(globalBinDir, "runx");
const binLinkTarget = "../lib/node_modules/@runxhq/cli/bin/runx";

const mode = process.argv.includes("--unlink")
  ? "unlink"
  : process.argv.includes("--check")
    ? "check"
    : "link";

if (mode === "unlink") {
  await unlinkGlobal();
  process.exit(0);
}

if (mode === "check") {
  await checkGlobal();
  process.exit(0);
}

await linkGlobal();

async function linkGlobal() {
  await mkdir(globalBinDir, { recursive: true });
  await mkdir(globalScopeDir, { recursive: true });

  await replacePath(globalPackageLink, cliPackageDir, "dir");
  await replacePath(globalBinLink, binLinkTarget, "file");

  const resolvedPackage = await realpath(globalPackageLink);
  const resolvedBin = await realpath(globalBinLink);

  process.stdout.write(
    [
      "runx global link updated",
      `prefix   ${globalPrefix}`,
      `package  ${globalPackageLink} -> ${resolvedPackage}`,
      `binary   ${globalBinLink} -> ${resolvedBin}`,
      "",
      "This is a live workspace link to the native selector. Install or stage the matching platform package before using the global `runx`.",
    ].join("\n") + "\n",
  );
}

async function unlinkGlobal() {
  await rm(globalBinLink, { force: true });
  await rm(globalPackageLink, { recursive: true, force: true });
  process.stdout.write(
    [
      "runx global link removed",
      `binary   ${globalBinLink}`,
      `package  ${globalPackageLink}`,
    ].join("\n") + "\n",
  );
}

async function checkGlobal() {
  const packageState = await describeSymbolicLink(globalPackageLink);
  const binState = await describeSymbolicLink(globalBinLink);

  process.stdout.write(
    [
      "runx global link status",
      `prefix   ${globalPrefix}`,
      `package  ${packageState}`,
      `binary   ${binState}`,
    ].join("\n") + "\n",
  );
}

async function replacePath(filePath, target, symlinkType) {
  await rm(filePath, { recursive: true, force: true });
  await symlink(target, filePath, symlinkType);
}
