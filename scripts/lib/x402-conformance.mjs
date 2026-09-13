import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

/** @param {string} directory @param {string} requiredPath */
export function inspectGitCheckout(directory, requiredPath) {
  if (!existsSync(requiredPath)) {
    return { available: false, sha: null };
  }
  const result = spawnSync("git", ["-C", directory, "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    available: result.status === 0,
    sha: result.status === 0 ? result.stdout.trim() : null,
  };
}

/** @param {readonly string[]} args @param {string} name */
export function optionValue(args, name) {
  const index = args.indexOf(name);
  if (index !== -1) {
    return args[index + 1];
  }
  const prefix = `${name}=`;
  const inline = args.find((argument) => argument.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : undefined;
}

/** @param {unknown} value */
export function writeJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
