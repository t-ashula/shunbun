import { expect, describe, it } from "vitest";

import { tryParseDate, tryParseDuration } from "./datetime.mjs";

describe("tryParseDate", () => {
  it.each([
    { arg: undefined, expected: undefined },
    { arg: "2024/12", expected: new Date("2024/12") },
  ])("return $expected when $arg passed", ({ arg, expected }) => {
    const actual = tryParseDate(arg);
    expect(actual).toStrictEqual(expected);
  });
});
describe("tryParseDuration", () => {
  it.each([
    { arg: undefined, expected: undefined },
    { arg: "not hhmmss", expected: undefined },
    { arg: "00:00:00", expected: 0 },
    { arg: "00:00:00.01", expected: 0.01 },
    { arg: "12:34:56.78", expected: 45296.78 },
  ])("return $expected when $arg passed", ({ arg, expected }) => {
    const actual = tryParseDuration(arg);
    expect(actual).toBe(expected);
  });
});
