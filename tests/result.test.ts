import { describe, expect, it } from "vitest";

import { errorMessage, fail, ok } from "../src/common/result.js";

describe("command results", () => {
  it("builds successful results with optional stdout", () => {
    expect(ok()).toEqual({ code: 0, stdout: "", stderr: "" });
    expect(ok("done\n")).toEqual({ code: 0, stdout: "done\n", stderr: "" });
  });

  it("builds failures with a trailing newline and default exit code", () => {
    expect(fail("boom")).toEqual({ code: 2, stdout: "", stderr: "boom\n" });
    expect(fail("boom\n")).toEqual({ code: 2, stdout: "", stderr: "boom\n" });
    expect(fail("boom", 3)).toEqual({ code: 3, stdout: "", stderr: "boom\n" });
  });

  it("extracts messages from errors and other thrown values", () => {
    expect(errorMessage(new Error("broken"))).toBe("broken");
    expect(errorMessage("just text")).toBe("just text");
    expect(errorMessage(42)).toBe("42");
  });
});
