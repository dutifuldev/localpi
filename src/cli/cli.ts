import { errorMessage, fail, ok, type CommandResult } from "../common/result.js";
import { parseLocalpiArgs, usage } from "../localpi/options.js";
import {
  aliasListOutput,
  connectionStatus,
  resolveRuntime,
  statusOutput,
  stopRuntime
} from "../localpi/runtime.js";
import { writeRuntimeConfig } from "../pi/config.js";
import { writeDefaultExtensions } from "../pi/extensions.js";
import { createLaunchPlan, execLaunchPlan } from "../pi/launch.js";

export async function run(args: readonly string[]): Promise<CommandResult> {
  try {
    const options = parseLocalpiArgs(args);
    const commandResult = await immediateCommandResult(options);
    if (commandResult !== undefined) {
      return commandResult;
    }

    const connection = await resolveRuntime(options);
    const runtimeConfig = await writeRuntimeConfig(options, connection);
    const selectorOptions = startupModelSelectorOptions(options, connection);
    const extensions = await writeDefaultExtensions(
      options,
      selectorOptions === undefined ? {} : { startupModelSelector: selectorOptions }
    );
    const plan = await createLaunchPlan(options, runtimeConfig, connection, extensions);
    const code = await execLaunchPlan(plan);
    if (code !== 0) {
      return { code, stdout: "", stderr: "" };
    }
    return ok(connection.warnings.length === 0 ? "" : connectionStatus(connection));
  } catch (error) {
    return fail(`localpi: ${errorMessage(error)}`);
  }
}

type ParsedOptions = ReturnType<typeof parseLocalpiArgs>;

async function immediateCommandResult(options: ParsedOptions): Promise<CommandResult | undefined> {
  if (options.forwardedArgs.length === 1 && options.forwardedArgs[0] === "--help") {
    return ok(usage());
  }
  if (options.list) {
    return ok(`${await aliasListOutput()}\n`);
  }
  if (options.stop) {
    return ok(`${await stopRuntime(options)}\n`);
  }
  return options.status ? ok(`${await statusOutput(options)}\n`) : undefined;
}

function startupModelSelectorOptions(
  options: ParsedOptions,
  connection: Awaited<ReturnType<typeof resolveRuntime>>
): { readonly scopedProviderId?: string } | undefined {
  if (!process.stdin.isTTY || !process.stderr.isTTY) {
    return undefined;
  }
  if (options.model !== undefined && options.model !== "auto") {
    return undefined;
  }
  const scopedProviderId = options.provider === undefined ? undefined : connection.providerId;
  const loadedModels = connection.catalogModels.filter(
    (model) =>
      model.availability === "loaded" &&
      (scopedProviderId === undefined || model.providerId === scopedProviderId)
  );
  if (loadedModels.length <= 1) {
    return undefined;
  }
  return scopedProviderId === undefined ? {} : { scopedProviderId };
}
