import type { StartupModelSelectorOptions } from "../extensions.js";

export function startupModelSelectorExtensionSource(options: StartupModelSelectorOptions): string {
  const startupModelsSource = JSON.stringify(options.models);
  return `import type { ExtensionAPI, SettingsManager } from "@earendil-works/pi-coding-agent";
import { ModelSelectorComponent } from "@earendil-works/pi-coding-agent";

type SelectedModel = Parameters<ExtensionAPI["setModel"]>[0];
const startupModels = ${startupModelsSource} as const;
const startupModelKeys = new Set(startupModels.map((model) => modelKey(model)));

export default function localpiStartupModelSelector(pi: ExtensionAPI): void {
  let opened = false;

  pi.on("session_start", async (event, ctx) => {
    if (opened || event.reason !== "startup" || ctx.mode !== "tui") {
      return;
    }

    const selectableModels = startupAvailableModels(ctx.modelRegistry);
    if (selectableModels.length <= 1) {
      return;
    }
    const scopedModels = selectableModels.map((model) => ({ model }));

    opened = true;
    const selected = await ctx.ui.custom<SelectedModel | undefined>((tui, _theme, _keybindings, done) => {
      const settings = {
        setDefaultModelAndProvider: () => {}
      } as unknown as SettingsManager;
      return new ModelSelectorComponent(
        tui,
        ctx.model,
        settings,
        startupModelRegistry(ctx.modelRegistry) as typeof ctx.modelRegistry,
        scopedModels,
        (model) => done(model),
        () => done(undefined)
      );
    });

    if (selected === undefined) {
      return;
    }

    const ok = await pi.setModel(selected);
    if (!ok) {
      ctx.ui.notify(\`No API key for \${selected.provider}/\${selected.id}\`, "error");
    }
  });
}

function startupAvailableModels(registry: {
  getAvailable(): SelectedModel[];
}): SelectedModel[] {
  return registry.getAvailable().filter((model) => startupModelKeys.has(modelKey(model)));
}

function startupModelRegistry(registry: {
  refresh(): void;
  getError(): string | undefined;
  getAvailable(): SelectedModel[];
  find(provider: string, modelId: string): SelectedModel | undefined;
}): typeof registry {
  return {
    refresh: () => registry.refresh(),
    getError: () => registry.getError(),
    getAvailable: () => startupAvailableModels(registry),
    find: (provider, modelId) => {
      const model = registry.find(provider, modelId);
      return model !== undefined && startupModelKeys.has(modelKey(model)) ? model : undefined;
    }
  };
}

function modelKey(model: { readonly provider: string; readonly id: string }): string {
  return \`\${model.provider}\\u0000\${model.id}\`;
}
`;
}
