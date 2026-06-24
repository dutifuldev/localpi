import { mkdir } from "node:fs/promises";
import { createPiLaunchPlan, execPiLaunchPlan } from "@dutifuldev/pi-factory";
import type { PiAppDefinition, PiLaunchPlan } from "@dutifuldev/pi-factory";

import type { RuntimeConfig } from "./config.js";

export type LaunchPlan = PiLaunchPlan;

export async function createLaunchPlan(
  app: PiAppDefinition,
  runtimeConfig: RuntimeConfig
): Promise<LaunchPlan> {
  await mkdir(app.sessionDir, { recursive: true });
  return await createPiLaunchPlan(app, runtimeConfig);
}

export const execLaunchPlan = execPiLaunchPlan;
