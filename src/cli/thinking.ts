import type { LocalpiOptions, ThinkingLevel } from "../localpi/options.js";
import { thinkingLevels } from "../localpi/options.js";

export type ThinkingSelectionRequest = {
  readonly levels: readonly ThinkingLevel[];
  readonly current: ThinkingLevel;
};

export type ThinkingSelector = (
  request: ThinkingSelectionRequest
) => Promise<ThinkingLevel | undefined>;

export async function applyStartupThinkingSelection(
  options: LocalpiOptions,
  canPrompt: boolean,
  selectThinking: ThinkingSelector | undefined
): Promise<LocalpiOptions> {
  if (!shouldPromptForThinking(options, canPrompt, selectThinking)) {
    return options;
  }
  const selected = await selectThinking({ levels: thinkingLevels, current: options.thinking });
  return selected === undefined
    ? options
    : { ...options, thinking: selected, thinkingSource: "cli" };
}

export function shouldPromptForThinking(
  options: LocalpiOptions,
  canPrompt: boolean,
  selectThinking: ThinkingSelector | undefined
): selectThinking is ThinkingSelector {
  return (
    canPrompt &&
    selectThinking !== undefined &&
    options.thinkingSource === "default" &&
    !options.status &&
    !options.stop &&
    !options.list &&
    options.forwardedArgs.length === 0
  );
}
