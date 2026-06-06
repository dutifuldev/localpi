# localpi

Localpi is a local Pi launcher for open-weight models.

The intended default runtime is a managed `llama-server` process. Localpi should be able to start or reuse that server, point Pi at it, install a small set of default tools, require approval before tool calls, and show local generation speed while the session runs.

LM Studio remains supported as an alternate runtime for people who already have an OpenAI-compatible LM Studio server running.

Localpi is intentionally generic. It should not contain classifier prompts, dataset workflows, GitHub routing logic, or final-schema output machinery. Structured classifier runs belong in caller tools such as `localpager-agent`.

Implementation status: this repository has been renamed, but the TypeScript CLI still needs the rename/runtime implementation plan applied before every `localpi` command below exists. This README documents the intended localpi surface.

See:

- [Runtime Specification](docs/runtime-specification.md)
- [Implementation Plan](docs/implementation-plan.md)

## Install

```bash
npm install
npm run build
```

During development:

```bash
npm run localpi -- --status
```

After build:

```bash
node dist/src/cli/main.js --status
```

## Runtime Model

Target default:

```bash
localpi --model gemma-12b
```

This should use `llama-server` by default.

LM Studio should be explicit:

```bash
localpi --runtime lmstudio --model gemma-4-e4b-it
```

Custom OpenAI-compatible endpoints should also remain possible:

```bash
localpi --runtime openai-compatible --base-url http://127.0.0.1:8000/v1 --model my-model
```

Localpi should avoid loading multiple heavyweight local runtimes at the same time. When using the managed `llama-server` runtime, it should either stop its previous managed server or clearly report what is already running before starting another model.

## Default Pi Behavior

Localpi should launch Pi with:

- default tools: `read,bash,edit,write,grep,find,ls`
- a system prompt that explains local tool approval and local-model limits
- an approval gate before every tool call
- token speed and token count status while responses stream
- local state under `~/.local/state/localpi`

The approval gate should make failed or denied tool calls explicit to the model so the model does not claim that a blocked command ran.

## LM Studio Alternative

LM Studio exposes an OpenAI-compatible endpoint, usually:

```text
http://127.0.0.1:1234/v1
```

Load Gemma in LM Studio:

```bash
~/.lmstudio/bin/lms server start
~/.lmstudio/bin/lms load gemma-4-e4b-it -y
```

Then run localpi against LM Studio explicitly:

```bash
localpi --runtime lmstudio --model gemma-4-e4b-it
```

## Usage

Run Pi interactively on the default local model:

```bash
localpi
```

Run a non-interactive Pi prompt:

```bash
localpi -p "summarize this repo"
```

Pin a model alias:

```bash
localpi --model gemma-e4b -p "write a detailed implementation plan"
```

Point at a different OpenAI-compatible local server:

```bash
localpi --runtime openai-compatible --base-url http://127.0.0.1:8000/v1 -p "review the src directory"
```

Pass a Pi flag that localpi also owns after `--`:

```bash
localpi --model gemma-e4b -- --model some-pi-level-value
```

Stop the managed `llama-server` runtime:

```bash
localpi --stop
```

## Options

These are the target options for the renamed tool:

- `--runtime <llama-server|lmstudio|openai-compatible>`: runtime backend. Default: `llama-server`
- `--model <alias|id|path|auto>`: model alias, model id, or GGUF path
- `--ctx <n>` / `--context-window <n>`: model context window
- `--max-tokens <n>`: generated model max output tokens
- `--base-url <url>`: OpenAI-compatible endpoint for LM Studio or custom endpoints
- `--server-command <path>`: `llama-server` executable path
- `--chat-template <path>`: optional llama.cpp chat template file
- `--state-dir <path>`: runtime state directory. Default: `~/.local/state/localpi`
- `--session-dir <path>`: Pi session directory. Default: `<state-dir>/sessions`
- `--pi-command <command>`: Pi launch command
- `--tools <list>`: Pi tools allow list. Default: `read,bash,edit,write,grep,find,ls`
- `--no-approval`: disable the tool approval gate
- `--status`: print runtime, model, and Pi config status
- `--stop`: stop the managed `llama-server` process
- `--list`: list configured model aliases

## Environment

- `LOCALPI_RUNTIME`
- `LOCALPI_MODEL`
- `LOCALPI_BASE_URL`
- `LOCALPI_STATE_DIR`
- `LOCALPI_SESSION_DIR`
- `LOCALPI_PI_CMD`
- `LOCALPI_CONTEXT_WINDOW`
- `LOCALPI_MAX_TOKENS`
- `LOCALPI_LLAMA_SERVER`
- `LOCALPI_CHAT_TEMPLATE`
- `LOCALPI_TOOLS`

## Development

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run build
npm run check
```
