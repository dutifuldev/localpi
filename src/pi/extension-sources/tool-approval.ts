export function approvalExtensionSource(): string {
  return `import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function localpiToolApproval(pi: ExtensionAPI): void {
  pi.on("before_agent_start", (event) => ({
    systemPrompt:
      event.systemPrompt +
      "\\n\\nTool approval rule: if any tool result says the tool was blocked, denied, or requires approval, the tool did not run. Do not claim blocked tools ran."
  }));

  pi.on("tool_call", async (event, ctx) => {
    const input = formatInput(event.input);

    if (!ctx.hasUI) {
      return {
        block: true,
        reason: \`Tool call "\${event.toolName}" was blocked and did not run because interactive approval is required.\`
      };
    }

    const ok = await ctx.ui.confirm(\`Allow tool call: \${event.toolName}?\`, input);
    if (!ok) {
      return { block: true, reason: "Tool call was blocked by the user and did not run." };
    }

    return undefined;
  });
}

function formatInput(input: unknown): string {
  let text: string;
  try {
    text = JSON.stringify(input, null, 2);
  } catch {
    text = String(input);
  }

  const maxLength = 4000;
  if (text.length <= maxLength) {
    return text;
  }
  return \`\${text.slice(0, maxLength)}\\n... truncated ...\`;
}
`;
}
