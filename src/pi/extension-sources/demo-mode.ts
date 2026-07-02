import type { DemoPrompts } from "../demo.js";

export function demoModeExtensionSource(prompts: DemoPrompts): string {
  const initialPromptSource = JSON.stringify(prompts.initial);
  const followupPromptSource = JSON.stringify(prompts.followup);
  return `import type { ExtensionAPI, ExtensionContext, TurnEndEvent } from "@earendil-works/pi-coding-agent";

const initialPrompt = ${initialPromptSource};
const followupPrompt = ${followupPromptSource};
const compactAtContextPercent = 70;
const demoCompactionInstructions = [
  "Preserve the demo narrative state, named entities, current setting,",
  "unresolved plot threads, and latest user direction.",
  "Keep the summary concise so the story can continue after compaction."
].join(" ");

export default function localpiDemoMode(pi: ExtensionAPI): void {
  let started = false;
  let stopped = false;
  let compacting = false;

  function queueInitialPrompt(): void {
    queueMicrotask(() => {
      if (!stopped) {
        pi.sendUserMessage(initialPrompt);
      }
    });
  }

  function queueFollowup(): void {
    queueMicrotask(() => {
      if (!stopped && !compacting) {
        pi.sendUserMessage(followupPrompt, { deliverAs: "followUp" });
      }
    });
  }

  function compactThenFollowup(ctx: ExtensionContext): void {
    if (compacting) {
      return;
    }
    compacting = true;
    ctx.compact({
      customInstructions: demoCompactionInstructions,
      onComplete: () => {
        compacting = false;
        queueFollowup();
      },
      onError: (error) => {
        compacting = false;
        stopped = true;
        ctx.ui.notify("Demo compaction failed: " + error.message, "error");
      }
    });
  }

  pi.on("session_start", (event, ctx) => {
    if (started || stopped || event.reason !== "startup" || ctx.mode !== "tui") {
      return;
    }
    started = true;
    queueInitialPrompt();
  });

  pi.on("turn_end", (event, ctx) => {
    if (!started || stopped || compacting || ctx.mode !== "tui") {
      return;
    }
    if (event.message.role !== "assistant") {
      return;
    }
    switch (event.message.stopReason) {
      case "aborted":
      case "error":
        stopped = true;
        return;
      case "toolUse":
        return;
    }
    if (shouldCompactBeforeFollowup(event, ctx)) {
      compactThenFollowup(ctx);
      return;
    }
    queueFollowup();
  });

  pi.on("session_shutdown", () => {
    stopped = true;
  });
}

function shouldCompactBeforeFollowup(event: TurnEndEvent, ctx: ExtensionContext): boolean {
  const contextPercent = currentContextPercent(event, ctx);
  return contextPercent !== undefined && contextPercent >= compactAtContextPercent;
}

function currentContextPercent(event: TurnEndEvent, ctx: ExtensionContext): number | undefined {
  const usage = ctx.getContextUsage();
  if (usage?.percent !== undefined && usage.percent !== null) {
    return usage.percent;
  }
  if (event.message.role !== "assistant") {
    return undefined;
  }
  const contextWindow = ctx.model?.contextWindow;
  if (contextWindow === undefined || contextWindow <= 0) {
    return undefined;
  }
  return (event.message.usage.totalTokens / contextWindow) * 100;
}
`;
}
