import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

/**
 * Read the package version from package.json at runtime so we never have to
 * keep version strings in sync across the codebase.
 */
function readPackageVersion(): string {
  try {
    // dist/version.js lives one level below the package root; src/version.ts
    // lives two levels below (when run via ts-jest from tests). Try a couple
    // of candidate locations so this works in both compiled and source runs.
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [
      join(here, "..", "package.json"),
      join(here, "..", "..", "package.json"),
    ];
    for (const path of candidates) {
      try {
        const pkg = JSON.parse(readFileSync(path, "utf-8"));
        if (pkg && typeof pkg.version === "string") {
          return pkg.version;
        }
      } catch {
        // Try next candidate
      }
    }
  } catch {
    // fall through
  }
  return "0.0.0";
}

export const PACKAGE_VERSION: string = readPackageVersion();
