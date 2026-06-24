import { writePiRuntimeConfig } from "@dutifuldev/pi-factory";
import type { PiAppDefinition, PiRuntimeConfig } from "@dutifuldev/pi-factory";

export type RuntimeConfig = PiRuntimeConfig;

export async function writeRuntimeConfig(app: PiAppDefinition): Promise<RuntimeConfig> {
  return await writePiRuntimeConfig(app);
}
