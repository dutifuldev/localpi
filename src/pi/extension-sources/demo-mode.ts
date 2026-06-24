import type { DemoPrompts } from "../demo.js";

export function demoModeExtensionSource(prompts: DemoPrompts): string {
  const initialPromptSource = JSON.stringify(prompts.initial);
  const followupPromptSource = JSON.stringify(prompts.followup);
  return `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const initialPrompt = ${initialPromptSource};
const followupPrompt = ${followupPromptSource};

export default function localpiDemoMode(pi: ExtensionAPI): void {
  let started = false;
  let stopped = false;

  pi.on("session_start", (event, ctx) => {
    if (started || stopped || event.reason !== "startup" || ctx.mode !== "tui") {
      return;
    }
    started = true;
    queueMicrotask(() => {
      if (!stopped) {
        pi.sendUserMessage(initialPrompt);
      }
    });
  });

  pi.on("turn_end", (event, ctx) => {
    if (!started || stopped || ctx.mode !== "tui") {
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
    queueMicrotask(() => {
      if (!stopped) {
        pi.sendUserMessage(followupPrompt, { deliverAs: "followUp" });
      }
    });
  });

  pi.on("session_shutdown", () => {
    stopped = true;
  });
}
`;
}
