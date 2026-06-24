---
name: pi-demo-grid
description: Use when launching a tmux grid of concurrent localpi Pi demo sessions for live demonstrations, load demos, screen-filling demo walls, or side-by-side model output comparisons. Triggers include requests to demo localpi, open many Pi demo panes, launch concurrent demo requests, create a tmux demo grid, or run localpi --demo at a target concurrency.
---

# Pi Demo Grid

## Overview

Launch a balanced tmux session containing many concurrent `localpi --demo` panes.
Use the bundled script so pane creation, layout, and final attach instructions are deterministic.
This skill is intentionally conservative: first show the launch plan, then start only when the user has explicitly asked to run it.

## Workflow

1. Resolve the target concurrency.
   - If the user gives a number, use it.
   - If the user asks for a demo without a number, default to the maximum currently available concurrency for the selected backend.
   - Discover that number from the running provider or localpi status before launching. For vLLM, use the running server's configured `--max-num-seqs`.
   - "Maximum available concurrency" means the backend's configured request/sequence capacity, not an invented machine-wide estimate.
   - If the backend capacity cannot be discovered, do not guess. Show what is known and ask for the target concurrency.
   - Concurrency must be a positive integer.

2. Resolve the localpi demo command.
   - Prefer an explicit command when the user provides one.
   - Otherwise build `localpi --demo` plus any user-provided localpi flags.
   - Demo mode requires a concrete model. Make sure the command has `--model <id>` or `LOCALPI_MODEL` is set.

3. Do a safety preflight before launching.
   - Run the script without `--start` first and show the plan.
   - Do not start panes if the user only asks what would happen, asks for a command, or sounds unsure.
   - Treat high concurrency as risky for local model servers, but if the user asks to run a demo and the backend's configured max is discovered, use that discovered max by default.
   - Above 4 panes, pass `--allow-high-concurrency` only when the pane count comes from an explicit user number or a discovered backend capacity.
   - If the machine is already tight on memory, add `--min-available-gb <GiB>` or reduce concurrency before starting.
   - Do not start a model server from this skill. It should only run `localpi --demo` clients against the model/provider the user intentionally selected.

4. Launch the grid with `.agents/skills/pi-demo-grid/scripts/launch_pi_demo_grid.py --start`.
   - Use one tmux session per demo run.
   - Use `--restart` only when the user agrees to replace an existing session name.
   - The script applies tmux's `tiled` layout, which balances panes into equal sizes and naturally gives square layouts such as 2x2 for 4 and 4x4 for 16.

5. Report the final attach command exactly.
   - The user should be able to copy one command to view the session.
   - Also mention the session name and pane count.

## Commands

Preview the backend's maximum available concurrency using an explicit model.
For a vLLM server configured with `--max-num-seqs 16`:

```bash
python3 .agents/skills/pi-demo-grid/scripts/launch_pi_demo_grid.py \
  --concurrency 16 \
  --allow-high-concurrency \
  -- localpi --runtime vllm --demo --model nvidia/Gemma-4-26B-A4B-NVFP4
```

Launch the discovered maximum after reviewing the preview:

```bash
python3 .agents/skills/pi-demo-grid/scripts/launch_pi_demo_grid.py \
  --concurrency 16 \
  --allow-high-concurrency \
  --min-available-gb 24 \
  --start \
  -- localpi --runtime vllm --demo --model nvidia/Gemma-4-26B-A4B-NVFP4
```

Launch 16 panes with a named session only after checking model-server capacity:

```bash
python3 .agents/skills/pi-demo-grid/scripts/launch_pi_demo_grid.py \
  --concurrency 16 \
  --session localpi-demo-16 \
  --allow-high-concurrency \
  --start \
  -- localpi --demo --model vllm/gemma4-26b
```

Add a memory floor when the demo must leave headroom for the OS and model server:

```bash
python3 .agents/skills/pi-demo-grid/scripts/launch_pi_demo_grid.py \
  --concurrency 6 \
  --allow-high-concurrency \
  --min-available-gb 24 \
  --start \
  -- localpi --demo --model gemma-e4b
```

## Script Contract

The script:

- verifies `tmux` exists before launching
- defaults to preview mode and creates panes only when `--start` is passed
- refuses to start without an explicit model in the command or `LOCALPI_MODEL`
- refuses concurrency above the safe limit unless `--allow-high-concurrency` is passed
- optionally enforces a minimum available-memory floor with `--min-available-gb`
- refuses to reuse an existing tmux session unless `--restart` is passed
- creates all panes in one window
- runs one command per pane with `LOCALPI_DEMO_INDEX` and `LOCALPI_DEMO_TOTAL` set
- applies `tmux select-layout tiled` after each split and at the end
- sets tmux window options that keep panes visible and stable for demos
- prints `tmux attach -t <session>` as the final user-facing command

## Notes

- Do not use background one-shot localpi commands for this skill; the purpose is a live visible tmux wall.
- Do not attach automatically unless the user asks. Create the session and report the attach command.
- Do not bypass the preview and safety gates for convenience. The expensive operation is starting many concurrent localpi clients, so make that decision visible.
- When the user says "run the demo" with no pane count, they are asking for the backend's maximum available concurrency, subject to the discovery and memory checks above.
