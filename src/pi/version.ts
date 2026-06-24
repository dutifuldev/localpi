import { createRequire } from "node:module";

type PackageMetadata = {
  readonly version?: unknown;
};

const require = createRequire(import.meta.url);
const packageMetadata = loadPackageMetadata();

if (typeof packageMetadata.version !== "string") {
  throw new Error("localpi package metadata is missing a string version");
}

export const localpiVersion = packageMetadata.version;

function loadPackageMetadata(): PackageMetadata {
  for (const packagePath of ["../../package.json", "../../../package.json"]) {
    try {
      return require(packagePath) as PackageMetadata;
    } catch (error) {
      if (!isModuleNotFound(error)) {
        throw error;
      }
    }
  }
  throw new Error("localpi package metadata could not be loaded");
}

function isModuleNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND"
  );
}
