import { readFile } from "node:fs/promises";
import path from "node:path";

import { asObject, optionalString } from "../common/json.js";
import { parseThinkingLevel, type LocalpiOptions } from "./options.js";

export type LocalpiSettings = {
  readonly thinking?: LocalpiOptions["thinking"];
};

export function localpiSettingsPath(options: Pick<LocalpiOptions, "stateDir">): string {
  return path.join(options.stateDir, "settings.json");
}

export async function applyRememberedSettings(
  options: LocalpiOptions,
  explicit: { readonly thinking: boolean }
): Promise<LocalpiOptions> {
  const settings = await readLocalpiSettings(options);
  return {
    ...options,
    thinking:
      explicit.thinking || settings.thinking === undefined ? options.thinking : settings.thinking
  };
}

async function readLocalpiSettings(
  options: Pick<LocalpiOptions, "stateDir">
): Promise<LocalpiSettings> {
  let raw: string;
  try {
    raw = await readFile(localpiSettingsPath(options), "utf8");
  } catch (error) {
    if (isMissingFile(error)) {
      return {};
    }
    throw error;
  }
  try {
    const root = asObject(JSON.parse(raw) as unknown, "localpi settings");
    const thinking = optionalString(root["thinking"]);
    return thinking === undefined ? {} : { thinking: parseThinkingLevel(thinking) };
  } catch {
    return {};
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
