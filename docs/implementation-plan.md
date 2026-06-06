# Implementation Plan

This plan migrates the renamed repository from `localagent` to `localpi` and changes the product from a generic OpenAI-compatible wrapper into a polished local Pi launcher.

## 1. Rename The Public Surface

- Rename package metadata from `@dutifuldev/localagent` to `@dutifuldev/localpi`.
- Rename the installed binary from `localagent` to `localpi`.
- Rename source namespaces from `localagent` to `localpi`.
- Rename default state from `~/.local/state/localagent` to `~/.local/state/localpi`.
- Replace `LOCALAGENT_*` environment variables with `LOCALPI_*`.
- Decide whether to keep a short compatibility shim for `localagent`; if kept, it should warn and call `localpi`.

## 2. Remove Structured Output

- Remove `--final-schema` and `--schema` from option parsing.
- Remove `LOCALAGENT_FINAL_SCHEMA`.
- Delete `src/structured/final-schema.ts`.
- Delete structured-output tests and example schemas.
- Keep a migration note that schema-constrained classifier runs belong in `localpager-agent`.
- Update known internal callers that still use `localagent --final-schema` to call `localpager-agent` instead.

## 3. Add Runtime Backends

- Add a runtime option with default `llama-server`.
- Implement a managed `llama-server` backend:
  - model alias resolution
  - custom GGUF path support
  - context window configuration
  - chat template file support
  - pid file and metadata file under localpi state
  - start, reuse, status, and stop
- Implement explicit `lmstudio` backend:
  - default base URL `http://127.0.0.1:1234/v1`
  - model probing through `/v1/models`
  - clear failures when LM Studio is not running or the model is not loaded
- Keep a generic `openai-compatible` backend for externally managed servers.

## 4. Add Default Pi Extensions

- Add a tool approval extension.
- Add a token status extension.
- Package both extensions with localpi or generate them under localpi state.
- Pass them to Pi by default.
- Add `--no-approval` for trusted sessions.
- Add `--no-token-status` if the status UI causes problems in print or non-interactive mode.

## 5. Add Default Tooling

- Default Pi tool allow list: `read,bash,edit,write,grep,find,ls`.
- Allow override with `--tools`.
- Preserve `--` forwarding for raw Pi flags.
- Keep the system prompt short and generic.

## 6. Memory Safety

- Only manage localpi-owned `llama-server` processes.
- Stop the previous localpi-owned server before starting a different managed model.
- In `llama-server` mode, detect loaded LM Studio models where possible and warn before starting a large model.
- Never silently start both LM Studio and managed `llama-server` for the same localpi command.

## 7. Verification

- Unit-test option parsing, runtime selection, Pi launch planning, and server lifecycle decisions.
- Smoke-test:
  - `localpi --list`
  - `localpi --status`
  - `localpi --model gemma-e4b -p "say ok"`
  - `localpi --model gemma-12b`
  - `localpi --runtime lmstudio --model gemma-4-e4b-it -p "say ok"`
  - approval denial in an interactive tool call
  - token status display in an interactive session
- Run `npm run check` before merging implementation changes.
