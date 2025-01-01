import { expect, describe, it } from "vitest";

import { Success, Failure } from "./result.mjs";

describe("Success", () => {
  it("isSuccess return true", () => {
    const s = new Success({});
    expect(s.isSuccess()).toBe(true);
  });
  it("isFailure return false", () => {
    const s = new Success({});
    expect(s.isFailure()).toBe(false);
  });
  it("unwrap return its value", () => {
    const v = Math.random();
    const s = new Success(v);
    expect(s.unwrap()).toBe(v);
  });
});
describe("Failure", () => {
  it("isFailure return true", () => {
    const f = new Failure({});
    expect(f.isFailure()).toBe(true);
  });
  it("isSuccess return false", () => {
    const f = new Failure({});
    expect(f.isSuccess()).toBe(false);
  });
  it("unwrap throw error", () => {
    const v = `error:${Math.random()}`;
    const f = new Failure(new Error(v));
    expect(() => f.unwrap()).toThrowError(v);
  });
});
