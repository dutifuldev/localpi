import type { CatalogModel } from "./catalog.js";

export type RuntimeConnection = {
  readonly runtime: string;
  readonly providerId: string;
  readonly providerName: string;
  readonly baseUrl: string;
  readonly model: string;
  readonly availableModels: readonly string[];
  readonly catalogModels: readonly CatalogModel[];
  readonly contextWindow?: number;
  readonly warnings: readonly string[];
};
