import { describe, expect, it } from "vitest";

import { applyStartupThinkingSelection, shouldPromptForThinking } from "../src/cli/thinking.js";
import type { LocalpiOptions } from "../src/localpi/options.js";

describe("startup thinking selection", () => {
  it("prompts only for pure interactive launches with default thinking", () => {
    expect(shouldPromptForThinking(options(), true, () => Promise.resolve("low"))).toBe(true);
    expect(
      shouldPromptForThinking({ ...options(), thinkingSource: "cli" }, true, () =>
        Promise.resolve("low")
      )
    ).toBe(false);
    expect(shouldPromptForThinking(options(), false, () => Promise.resolve("low"))).toBe(false);
    expect(
      shouldPromptForThinking({ ...options(), forwardedArgs: ["-p", "say ok"] }, true, () =>
        Promise.resolve("low")
      )
    ).toBe(false);
    expect(
      shouldPromptForThinking({ ...options(), status: true }, true, () => Promise.resolve("low"))
    ).toBe(false);
  });

  it("applies the selected startup thinking level", async () => {
    await expect(
      applyStartupThinkingSelection(options(), true, () => Promise.resolve("high"))
    ).resolves.toMatchObject({
      thinking: "high",
      thinkingSource: "cli"
    });
  });

  it("keeps the default when the selector is cancelled", async () => {
    await expect(
      applyStartupThinkingSelection(options(), true, () => Promise.resolve(undefined))
    ).resolves.toMatchObject({
      thinking: "off",
      thinkingSource: "default"
    });
  });
});

function options(): LocalpiOptions {
  return {
    runtime: "lmstudio",
    baseUrl: "http://127.0.0.1:1234/v1",
    model: "auto",
    provider: undefined,
    customProviderId: "local-openai",
    providersFile: undefined,
    stateDir: "/tmp/localpi-state",
    sessionDir: "/tmp/localpi-state/sessions",
    piCommand: "pi",
    thinking: "off",
    thinkingSource: "default",
    contextWindow: undefined,
    maxTokens: 8192,
    timeoutMs: 1000,
    serverCommand: "llama-server",
    host: "127.0.0.1",
    port: 18194,
    gpuLayers: 999,
    parallel: 1,
    chatTemplate: undefined,
    tools: "read,bash,edit,write,grep,find,ls",
    approval: true,
    tokenStatus: true,
    status: false,
    stop: false,
    list: false,
    forwardedArgs: []
  };
}
