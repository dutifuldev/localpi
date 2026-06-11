import { describe, expect, it } from "vitest";

import { asArray, asObject, optionalString, requiredString } from "../src/common/json.js";

describe("json boundary helpers", () => {
  it("accepts plain objects and rejects everything else", () => {
    expect(asObject({ id: "a" }, "payload")).toEqual({ id: "a" });
    expect(() => asObject(null, "payload")).toThrow("payload must be an object");
    expect(() => asObject([1], "payload")).toThrow("payload must be an object");
    expect(() => asObject("text", "payload")).toThrow("payload must be an object");
  });

  it("returns optional strings only for string values", () => {
    expect(optionalString("value")).toBe("value");
    expect(optionalString(7)).toBeUndefined();
    expect(optionalString(undefined)).toBeUndefined();
  });

  it("requires strings with context in the error", () => {
    expect(requiredString("value", "name")).toBe("value");
    expect(() => requiredString(7, "name")).toThrow("name must be a string");
  });

  it("accepts arrays and rejects everything else", () => {
    expect(asArray([1, 2], "items")).toEqual([1, 2]);
    expect(() => asArray({}, "items")).toThrow("items must be an array");
  });
});
