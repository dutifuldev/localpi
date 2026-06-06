import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { LocalpiOptions } from "../src/localpi/options.js";
import { resolveRuntime } from "../src/localpi/runtime.js";

describe("runtime resolution", () => {
  const servers: ReturnType<typeof createServer>[] = [];

  afterEach(async () => {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }
              resolve();
            });
          })
      )
    );
    servers.length = 0;
  });

  it("reuses a running llama-server for auto and backend model ids", async () => {
    const baseUrl = await startModelServer("served-model");

    await expect(resolveRuntime({ ...options(), baseUrl, model: "auto" })).resolves.toMatchObject({
      runtime: "llama-server/external",
      model: "served-model"
    });
    await expect(
      resolveRuntime({ ...options(), baseUrl, model: "served-model" })
    ).resolves.toMatchObject({
      runtime: "llama-server/external",
      model: "served-model"
    });
  });

  async function startModelServer(model: string): Promise<string> {
    const server = createServer((request, response) => {
      if (request.url === "/v1/models") {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ data: [{ id: model, context_length: 4096 }] }));
        return;
      }
      response.writeHead(404);
      response.end();
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", resolve);
    });
    servers.push(server);
    const address = server.address() as AddressInfo;
    return `http://127.0.0.1:${String(address.port)}/v1`;
  }
});

function options(): LocalpiOptions {
  const stateDir = "/tmp/localpi-runtime-test";
  return {
    runtime: "llama-server",
    baseUrl: undefined,
    model: "gemma-12b",
    providerId: "local-openai",
    stateDir,
    sessionDir: path.join(stateDir, "sessions"),
    piCommand: "pi",
    thinking: "off",
    contextWindow: undefined,
    maxTokens: 8192,
    timeoutMs: 1000,
    serverCommand: "llama-server",
    host: "127.0.0.1",
    port: 18194,
    gpuLayers: 999,
    parallel: 1,
    chatTemplate: undefined,
    tools: "read,bash,edit,write,grep,find,ls",
    approval: true,
    tokenStatus: true,
    status: false,
    stop: false,
    list: false,
    forwardedArgs: []
  };
}
