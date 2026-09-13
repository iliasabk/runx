import { execFileSync } from "node:child_process";
import { lstat, readlink, realpath } from "node:fs/promises";
import path from "node:path";

export function resolveGlobalNpmPrefix(workspaceRoot) {
  const prefix = execFileSync("npm", ["prefix", "-g"], {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: Object.fromEntries(
      Object.entries(process.env).filter(
        ([key]) => !key.startsWith("npm_config_") && !key.startsWith("npm_package_"),
      ),
    ),
  }).trim();

  if (!path.isAbsolute(prefix)) {
    throw new Error(`npm prefix -g returned a non-absolute path: ${prefix}`);
  }
  if (prefix === workspaceRoot || prefix.startsWith(`${workspaceRoot}${path.sep}`)) {
    throw new Error(
      `refusing to link into workspace-local prefix ${prefix}; check your global npm prefix configuration`,
    );
  }
  return prefix;
}

export async function describeSymbolicLink(filePath) {
  try {
    const stats = await lstat(filePath);
    if (stats.isSymbolicLink()) {
      const target = await readlink(filePath);
      const resolved = await realpath(filePath);
      return `${filePath} -> ${target} (${resolved})`;
    }
    return `${filePath} exists but is not a symlink`;
  } catch {
    return `${filePath} missing`;
  }
}
