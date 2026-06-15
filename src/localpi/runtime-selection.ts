import type { CatalogModel, ModelCatalog } from "./catalog.js";
import { customPathCatalogModel } from "./managed-runtime.js";
import { defaultLlamaModelName } from "./models.js";
import type { LocalpiOptions } from "./options.js";
import { modelChoiceList } from "./runtime-connection.js";
import type { ModelSelector } from "./runtime-types.js";

export async function selectCatalogModel(
  options: LocalpiOptions,
  catalog: ModelCatalog,
  selectModel: ModelSelector | undefined
): Promise<CatalogModel> {
  const selection = normalizedSelection(options, catalog.models);
  const providerFiltered = modelsForProvider(catalog.models, selection.provider);
  if (providerFiltered.length === 0) {
    const customPath = await customPathCatalogModel(options, selection.provider, selection.model);
    if (customPath !== undefined) {
      return customPath;
    }
    if (selection.provider !== undefined) {
      throw new Error(`provider ${selection.provider} did not report usable models`);
    }
  }
  if (selection.model !== "auto") {
    return selectExplicitCatalogModel(
      options,
      providerFiltered,
      selection.provider,
      selection.model
    );
  }
  return selectAutomaticCatalogModel(providerFiltered, catalog.warnings, selectModel);
}

async function selectExplicitCatalogModel(
  options: LocalpiOptions,
  models: readonly CatalogModel[],
  provider: string | undefined,
  requested: string
): Promise<CatalogModel> {
  const matches = matchingCatalogModels(models, requested);
  const [onlyMatch] = matches;
  if (onlyMatch !== undefined && matches.length === 1) {
    return onlyMatch;
  }
  if (matches.length > 1) {
    throw new Error(
      `model ${requested} is available from multiple providers; choose one with --provider:\n${modelChoiceList(matches)}`
    );
  }
  const customPath = await customPathCatalogModel(options, provider, requested);
  if (customPath !== undefined) {
    return customPath;
  }
  throw new Error(`model ${requested} is not available; choices:\n${modelChoiceList(models)}`);
}

async function selectAutomaticCatalogModel(
  models: readonly CatalogModel[],
  warnings: readonly string[],
  selectModel: ModelSelector | undefined
): Promise<CatalogModel> {
  const loaded = models.filter((model) => model.availability === "loaded");
  const [onlyLoaded] = loaded;
  if (onlyLoaded !== undefined && loaded.length === 1) {
    return onlyLoaded;
  }
  if (loaded.length > 1) {
    const selected = selectModel === undefined ? undefined : await selectModel({ models: loaded });
    if (selected !== undefined) {
      return selected;
    }
    throw new Error(
      `multiple loaded models available; choose one with --provider and --model:\n${modelChoiceList(loaded)}`
    );
  }
  const fallback = startableFallback(models);
  if (fallback !== undefined) {
    return fallback;
  }
  throw new Error(
    `no loaded models available${warnings.length === 0 ? "" : `; ${warnings.join("; ")}`}`
  );
}

function modelsForProvider(
  models: readonly CatalogModel[],
  provider: string | undefined
): readonly CatalogModel[] {
  return provider === undefined ? models : models.filter((model) => model.providerId === provider);
}

function normalizedSelection(
  options: LocalpiOptions,
  models: readonly CatalogModel[]
): { readonly provider: string | undefined; readonly model: string } {
  const requested = options.model ?? "auto";
  if (options.provider !== undefined || requested === "auto" || isGgufFilePathRequest(requested)) {
    return { provider: options.provider, model: requested };
  }
  const separator = requested.indexOf("/");
  if (separator <= 0) {
    return { provider: options.provider, model: requested };
  }
  const provider = requested.slice(0, separator);
  if (!models.some((model) => model.providerId === provider)) {
    return { provider: options.provider, model: requested };
  }
  return { provider, model: requested.slice(separator + 1) };
}

function matchingCatalogModels(
  models: readonly CatalogModel[],
  requested: string
): readonly CatalogModel[] {
  return models.filter((model) => model.modelId === requested || model.aliases.includes(requested));
}

function isGgufFilePathRequest(value: string): boolean {
  return value.toLowerCase().endsWith(".gguf") || value.includes("\\");
}

function startableFallback(models: readonly CatalogModel[]): CatalogModel | undefined {
  const startable = models.filter((model) => model.availability === "startable");
  return (
    startable.find(
      (model) =>
        model.aliases.includes(defaultLlamaModelName()) || model.modelId === defaultLlamaModelName()
    ) ?? startable[0]
  );
}
