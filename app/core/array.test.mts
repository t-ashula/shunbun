import { expect, describe, it } from "vitest";
import { eachSlice } from "./array.mjs";

describe("eachSlice", () => {
  it("return sliced array", () => {
    const array = [...Array(10).keys()];
    const actual = [];
    const size = 3;
    const expected = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9]];
    for (const s of eachSlice(array, size)) {
      actual.push(s);
    }

    expect(actual).toStrictEqual(expected);
  });
});
