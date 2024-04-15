import { expect, describe, it, vi, assert } from "vitest";

import { Fetch } from "./fetch.mjs";
import { run } from "./index.mjs";

describe("run", () => {
  it("return Success with DownloaderOutput", async () => {
    const mockResponse = new Response(JSON.stringify({ data: "test data" }));
    vi.spyOn(Fetch, "native").mockImplementation(async () => mockResponse);

    const input = { requestUrl: "https://example.com" };
    const result = await run(input);

    assert(result.isSuccess() === true); // FIXME:

    expect(result.value.response.json()).resolves.toEqual({
      data: "test data",
    });
  });

  it("run throws an error when the fetch fails", async () => {
    vi.spyOn(Fetch, "native").mockImplementation(async () => {
      throw new Error("Network error");
    });

    const input = { requestUrl: "https://example.com" };
    const result = await run(input);

    assert(result.isFailure() === true); // FIXME:

    expect(result.error.message).toBe("fetch failed.");
    expect(result.error.cause).toBeInstanceOf(Error);
    expect((result.error.cause as Error).message).toBe("Network error");
  });
});
