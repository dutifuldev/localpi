#!/usr/bin/env python3
"""Launch a balanced tmux grid of concurrent localpi demo sessions."""

from __future__ import annotations

import argparse
import datetime as dt
import os
import shlex
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class LaunchPlan:
    session: str
    concurrency: int
    cwd: Path
    command: str
    attach_command: str
    start: bool
    max_safe_concurrency: int
    allow_high_concurrency: bool
    min_available_gb: float | None


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    plan = build_plan(args)

    if not plan.start:
        print_plan(plan)
        return 0

    run_preflight(plan)
    require_tmux()
    if tmux_session_exists(plan.session):
        if not args.restart:
            raise SystemExit(
                f"tmux session {plan.session!r} already exists; pass --restart to replace it"
            )
        run(["tmux", "kill-session", "-t", plan.session])

    launch_tmux_grid(plan)
    print(f"tmux session: {plan.session}")
    print(f"panes: {plan.concurrency}")
    print(f"attach: {plan.attach_command}")
    return 0


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Launch a tmux grid of concurrent localpi --demo panes."
    )
    parser.add_argument(
        "--concurrency",
        "-n",
        type=positive_int,
        required=True,
        help="number of concurrent demo panes to launch",
    )
    parser.add_argument(
        "--session",
        "-s",
        default=default_session_name(),
        help="tmux session name to create",
    )
    parser.add_argument(
        "--cwd",
        default=os.getcwd(),
        help="working directory for each tmux pane",
    )
    parser.add_argument(
        "--command",
        help="shell command to run in every pane; defaults to positional command after --",
    )
    parser.add_argument(
        "--restart",
        action="store_true",
        help="kill an existing tmux session with the same name before launching",
    )
    parser.add_argument(
        "--start",
        action="store_true",
        help="actually create the tmux session; without this flag only a launch plan is printed",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="print the launch plan without creating a tmux session; this is also the default",
    )
    parser.add_argument(
        "--max-safe-concurrency",
        type=positive_int,
        default=default_max_safe_concurrency(),
        help="maximum pane count allowed without --allow-high-concurrency",
    )
    parser.add_argument(
        "--allow-high-concurrency",
        action="store_true",
        help="allow pane counts above --max-safe-concurrency after external capacity checks",
    )
    parser.add_argument(
        "--min-available-gb",
        type=positive_float,
        default=default_min_available_gb(),
        help="refuse to launch unless this many GiB of RAM is available",
    )
    parser.add_argument(
        "command_args",
        nargs=argparse.REMAINDER,
        help="command to run in each pane, usually after --",
    )
    return parser.parse_args(argv)


def build_plan(args: argparse.Namespace) -> LaunchPlan:
    command = command_from_args(args.command, args.command_args)
    cwd = Path(args.cwd).expanduser().resolve()
    if not cwd.exists() or not cwd.is_dir():
        raise SystemExit(f"--cwd must be an existing directory: {cwd}")

    return LaunchPlan(
        session=args.session,
        concurrency=args.concurrency,
        cwd=cwd,
        command=command,
        attach_command=f"tmux attach -t {shlex.quote(args.session)}",
        start=args.start and not args.dry_run,
        max_safe_concurrency=args.max_safe_concurrency,
        allow_high_concurrency=args.allow_high_concurrency,
        min_available_gb=args.min_available_gb,
    )


def command_from_args(command: str | None, command_args: list[str]) -> str:
    if command is not None and command_args:
        raise SystemExit("use either --command or a positional command after --, not both")
    if command is not None:
        return command

    args = command_args[1:] if command_args[:1] == ["--"] else command_args
    if not args:
        return "localpi --demo"
    return shlex.join(args)


def run_preflight(plan: LaunchPlan) -> None:
    if plan.concurrency > plan.max_safe_concurrency and not plan.allow_high_concurrency:
        raise SystemExit(
            "refusing to launch "
            f"{plan.concurrency} panes without --allow-high-concurrency "
            f"(current safe limit: {plan.max_safe_concurrency})"
        )

    if not has_explicit_model(plan.command):
        raise SystemExit(
            "demo grid launch requires an explicit model: add --model <id> "
            "or set LOCALPI_MODEL for the command"
        )

    if plan.min_available_gb is not None:
        available = available_memory_gb()
        if available is None:
            raise SystemExit("could not determine available memory for --min-available-gb")
        if available < plan.min_available_gb:
            raise SystemExit(
                f"available memory is {available:.1f} GiB, below required "
                f"{plan.min_available_gb:.1f} GiB"
            )


def has_explicit_model(command: str) -> bool:
    if os.environ.get("LOCALPI_MODEL"):
        return True
    if "LOCALPI_MODEL=" in command:
        return True
    try:
        parts = shlex.split(command)
    except ValueError:
        return "--model" in command
    return "--model" in parts or any(part.startswith("--model=") for part in parts)


def launch_tmux_grid(plan: LaunchPlan) -> None:
    first_command = pane_shell_command(plan, 1)
    run(
        [
            "tmux",
            "new-session",
            "-d",
            "-s",
            plan.session,
            "-n",
            "demo",
            "-c",
            str(plan.cwd),
            first_command,
        ]
    )
    configure_tmux_window(plan.session)

    for index in range(2, plan.concurrency + 1):
        run(
            [
                "tmux",
                "split-window",
                "-t",
                f"{plan.session}:0",
                "-c",
                str(plan.cwd),
                pane_shell_command(plan, index),
            ]
        )
        run(["tmux", "select-layout", "-t", f"{plan.session}:0", "tiled"])

    run(["tmux", "select-layout", "-t", f"{plan.session}:0", "tiled"])


def configure_tmux_window(session: str) -> None:
    target = f"{session}:0"
    run(["tmux", "set-window-option", "-t", target, "remain-on-exit", "on"])
    run(["tmux", "set-window-option", "-t", target, "automatic-rename", "off"])
    run(["tmux", "set-window-option", "-t", target, "aggressive-resize", "on"])
    run(["tmux", "setw", "-t", target, "pane-border-status", "top"])
    run(["tmux", "setw", "-t", target, "pane-border-format", "#{pane_index}"])


def pane_shell_command(plan: LaunchPlan, index: int) -> str:
    env = {
        "LOCALPI_DEMO_INDEX": str(index),
        "LOCALPI_DEMO_TOTAL": str(plan.concurrency),
    }
    exports = " ".join(f"{key}={shlex.quote(value)}" for key, value in env.items())
    label = f"[localpi demo {index}/{plan.concurrency}]"
    return f"printf '%s\\n' {shlex.quote(label)}; {exports} sh -lc {shlex.quote(plan.command)}"


def print_plan(plan: LaunchPlan) -> None:
    print(f"tmux session: {plan.session}")
    print(f"panes: {plan.concurrency}")
    print(f"cwd: {plan.cwd}")
    print(f"command: {plan.command}")
    print(f"layout: tiled")
    print(f"start: {'yes' if plan.start else 'no (pass --start to create panes)'}")
    print(
        "high concurrency: "
        f"{'allowed' if plan.allow_high_concurrency else 'blocked above ' + str(plan.max_safe_concurrency)}"
    )
    available = available_memory_gb()
    if available is not None:
        print(f"available memory: {available:.1f} GiB")
    if plan.min_available_gb is not None:
        print(f"minimum available memory: {plan.min_available_gb:.1f} GiB")
    print(f"attach: {plan.attach_command}")


def require_tmux() -> None:
    if shutil.which("tmux") is None:
        raise SystemExit("tmux is required but was not found on PATH")


def tmux_session_exists(session: str) -> bool:
    result = subprocess.run(
        ["tmux", "has-session", "-t", session],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        check=False,
    )
    return result.returncode == 0


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def positive_int(value: str) -> int:
    parsed = int(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive integer")
    return parsed


def positive_float(value: str) -> float:
    parsed = float(value)
    if parsed <= 0:
        raise argparse.ArgumentTypeError("must be a positive number")
    return parsed


def default_max_safe_concurrency() -> int:
    value = os.environ.get("PI_DEMO_GRID_MAX_SAFE_CONCURRENCY")
    if value is None:
        return 4
    try:
        return positive_int(value)
    except (argparse.ArgumentTypeError, ValueError) as exc:
        raise SystemExit(
            "PI_DEMO_GRID_MAX_SAFE_CONCURRENCY must be a positive integer"
        ) from exc


def default_min_available_gb() -> float | None:
    value = os.environ.get("PI_DEMO_GRID_MIN_AVAILABLE_GB")
    if value is None or value == "":
        return None
    try:
        return positive_float(value)
    except (argparse.ArgumentTypeError, ValueError) as exc:
        raise SystemExit("PI_DEMO_GRID_MIN_AVAILABLE_GB must be a positive number") from exc


def available_memory_gb() -> float | None:
    meminfo = Path("/proc/meminfo")
    if not meminfo.exists():
        return None
    for line in meminfo.read_text(encoding="utf-8").splitlines():
        if line.startswith("MemAvailable:"):
            parts = line.split()
            if len(parts) >= 2:
                return int(parts[1]) / 1024 / 1024
    return None


def default_session_name() -> str:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%d-%H%M%S")
    return f"pi-demo-{stamp}"


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
