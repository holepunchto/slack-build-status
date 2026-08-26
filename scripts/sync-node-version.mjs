// `runs.using` takes a literal - GitHub evaluates no expression there - so each
// action.yml carries its own copy of the runtime. This makes .node-version the
// one place the version is assigned and rewrites those copies from it.
import { readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";

const USING = /^(\s*using:\s*)node\d+(\s*)$/m;

export function actionManifests(root = ".") {
  return readdirSync(root, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules",
    )
    .map((entry) => join(root, entry.name, "action.yml"))
    .filter((path) => {
      try {
        return USING.test(readFileSync(path, "utf8"));
      } catch {
        return false;
      }
    });
}

export function nodeVersion(root = ".") {
  return `node${readFileSync(join(root, ".node-version"), "utf8").trim()}`;
}

export function syncNodeVersion(root = ".") {
  const using = nodeVersion(root);
  return actionManifests(root)
    .map((path) => {
      const before = readFileSync(path, "utf8");
      const after = before.replace(USING, `$1${using}$2`);
      if (before === after) return null;
      writeFileSync(path, after);
      return path;
    })
    .filter((path) => path !== null);
}

if (process.argv[1]?.endsWith("sync-node-version.mjs")) {
  const changed = syncNodeVersion();
  console.log(
    changed.length
      ? `Updated ${changed.join(", ")} to ${nodeVersion()}`
      : `Already on ${nodeVersion()}`,
  );
}
