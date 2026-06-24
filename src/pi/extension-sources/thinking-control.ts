export function thinkingControlExtensionSource(settingsPath: string): string {
  const settingsPathSource = JSON.stringify(settingsPath);
  return `import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

const levels: readonly ThinkingLevel[] = ["off", "minimal", "low", "medium", "high", "xhigh"];
const settingsPath = ${settingsPathSource};

export default function localpiThinkingControl(pi: ExtensionAPI): void {
  pi.registerCommand("thinking", {
    description: "Set localpi thinking level",
    getArgumentCompletions: (prefix) => {
      const trimmed = prefix.trim().toLowerCase();
      const matches = levels.filter((level) => level.startsWith(trimmed));
      return matches.length === 0 ? null : matches.map((level) => ({ value: level, label: level }));
    },
    handler: async (args, ctx) => {
      const requested = parseThinkingLevel(args);
      const level = requested ?? (await promptThinkingLevel(pi.getThinkingLevel(), ctx));
      if (level === undefined) {
        return;
      }
      pi.setThinkingLevel(level);
      const actual = pi.getThinkingLevel();
      await persistThinking(actual);
      ctx.ui.notify(
        actual === level ? \`thinking: \${actual}\` : \`thinking: \${actual} (clamped from \${level})\`,
        actual === level ? "info" : "warning"
      );
    }
  });

  pi.on("thinking_level_select", async (event, ctx) => {
    await persistThinking(event.level);
    ctx.ui.setStatus("localpi-thinking", \`thinking: \${event.level}\`);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    await persistThinking(pi.getThinkingLevel());
    ctx.ui.setStatus("localpi-thinking", undefined);
  });
}

async function persistThinking(level: ThinkingLevel): Promise<void> {
  const settings = await readSettings();
  settings.thinking = level;
  await mkdir(dirname(settingsPath), { recursive: true });
  await writeFile(settingsPath, \`\${JSON.stringify(settings, null, 2)}\\n\`, "utf8");
}

async function readSettings(): Promise<Record<string, unknown>> {
  try {
    const value = JSON.parse(await readFile(settingsPath, "utf8"));
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function promptThinkingLevel(
  current: ThinkingLevel,
  ctx: { readonly ui: { select(title: string, options: string[]): Promise<string | undefined> } }
): Promise<ThinkingLevel | undefined> {
  const selected = await ctx.ui.select(
    "Thinking level",
    levels.map((level) => (level === current ? \`\${level} (current)\` : level))
  );
  return selected === undefined ? undefined : parseThinkingLevel(selected);
}

function parseThinkingLevel(value: string): ThinkingLevel | undefined {
  const normalized = value.trim().split(/\\s+/u)[0]?.toLowerCase();
  return levels.find((level) => level === normalized);
}
`;
}
