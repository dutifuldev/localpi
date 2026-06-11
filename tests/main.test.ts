import { afterEach, describe, expect, it, vi } from "vitest";

describe("localpi entrypoint", () => {
  const previousArgv = process.argv;
  const previousExitCode = process.exitCode;

  afterEach(() => {
    process.argv = previousArgv;
    process.exitCode = previousExitCode;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("writes command output and sets the exit code", async () => {
    const stdout: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation((chunk) => {
      stdout.push(String(chunk));
      return true;
    });
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    process.argv = [...previousArgv.slice(0, 2), "--help"];

    await import("../src/cli/main.js");

    expect(stdout.join("")).toContain("localpi [localpi options] [pi options/messages]");
    expect(process.exitCode).toBe(0);
  });

  it("reports unexpected stream failures on stderr with exit code 2", async () => {
    const stderr: string[] = [];
    vi.spyOn(process.stdout, "write").mockImplementation(() => {
      throw new Error("stdout closed");
    });
    vi.spyOn(process.stderr, "write").mockImplementation((chunk) => {
      stderr.push(String(chunk));
      return true;
    });
    process.argv = [...previousArgv.slice(0, 2), "--help"];

    await import("../src/cli/main.js");

    expect(stderr.join("")).toContain("stdout closed");
    expect(process.exitCode).toBe(2);
  });
});
