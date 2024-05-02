import {
  expect,
  describe,
  it,
  assert,
  beforeAll,
  afterEach,
  afterAll,
} from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { run, DownloaderTimeoutError } from "./index.mjs";

const sleep = (msec: number) =>
  new Promise((resolve) => setTimeout(resolve, msec));

const mockServer = setupServer(
  http.get("https://mock.test/success", () => {
    return HttpResponse.json({ status: "ok" });
  }),
  http.post("https://mock.test/success", () => {
    return HttpResponse.json({ status: "ok", method: "post" });
  }),
  http.get("https://mock.test/delay/:delay", async ({ params }) => {
    const delay = Array.isArray(params.delay) ? params.delay[0] : params.delay;
    await sleep(parseInt(delay, 10));
    return HttpResponse.json({ status: "ok", delay: delay });
  }),
  http.get("https://mock.test/network-error", () => {
    return HttpResponse.error();
  }),
);
beforeAll(() => {
  mockServer.listen();
});

afterEach(() => {
  mockServer.resetHandlers();
});

afterAll(() => {
  mockServer.close();
});

describe("run", () => {
  it("return a Success with DownloaderOutput", async () => {
    const input = { requestUrl: "https://mock.test/success" };
    const result = await run(input);

    assert(result.isSuccess() === true); // FIXME:

    expect(result.value.response.json()).resolves.toEqual({
      status: "ok",
    });
  });

  it("return a Failure when the fetch fails", async () => {
    const input = { requestUrl: "https://mock.test/network-error" };
    const result = await run(input);

    assert(result.isFailure() === true); // FIXME:

    expect(result.error.message).toBe("fetch failed.");
    expect(result.error.cause).toBeInstanceOf(Error);
    // expect((result.error.cause as Error).message).toBe("Failed to connect");
  });

  it("use GET method default", async () => {
    const input = { requestUrl: "https://mock.test/success" };
    const result = await run(input);

    assert(result.isSuccess() === true); // FIXME:

    expect(result.value.request.method).toBe("GET");
  });
  it("can change method", async () => {
    const input = { requestUrl: "https://mock.test/success", method: "POST" };
    const result = await run(input);

    assert(result.isSuccess() === true); // FIXME:

    expect(result.value.request.method).toBe("POST");
    expect(result.value.response.json()).resolves.toEqual({
      status: "ok",
      method: "post",
    });
  });
  it("can change user agent", async () => {
    const userAgent = `Mozilla/${Math.ceil(Math.random() * 100)}`;
    const input = { requestUrl: "https://mock.test/success", userAgent };
    const result = await run(input);

    assert(result.isSuccess() === true); // FIXME:

    const actual = result.value.request.headers.get("user-agent");
    expect(actual).toBe(userAgent);
  });
  it("default user agent is Shunbun/version", async () => {
    const VERSION = "1.0";
    const userAgent = `Shunbun/${VERSION}`;
    const input = {
      requestUrl: "https://mock.test/success",
      headers: {},
    };
    const result = await run(input);

    assert(result.isSuccess() === true); // FIXME:

    const actual = result.value.request.headers.get("user-agent");
    expect(actual).toBe(userAgent);
  });
  it("can set request header", async () => {
    const input = {
      requestUrl: "https://mock.test/success",
      headers: { Accept: "*/*", "User-Agent": "UserAgentByHeader" },
    };
    const result = await run(input);

    assert(result.isSuccess() === true); // FIXME:

    expect(result.value.request.headers.get("Accept")).toBe("*/*");
    expect(result.value.request.headers.get("user-agent")).toBe(
      "UserAgentByHeader",
    );
  });
  it("can set request header except explicit useragent", async () => {
    const input = {
      requestUrl: "https://mock.test/success",
      headers: { "user-agent": "ByHeaderUserAgent" },
      userAgent: "ExplicitUserAgent",
    };
    const result = await run(input);

    assert(result.isSuccess() === true); // FIXME:

    const actual = result.value.request.headers.get("user-agent");
    expect(actual).toBe("ExplicitUserAgent");
  });
  it(
    "return a Failure with AbortError when the specified timeout is exceeded",
    async () => {
      const waitTimeout = 2 * 1000;

      const input = {
        requestUrl: `https://mock.test/delay/${waitTimeout * 2}`,
        waitTimeout,
      };
      const result = await run(input);

      assert(result.isFailure() === true); // FIXME:

      expect(result.error.message).toBe("fetch failed.");
      expect(result.error.cause).toBeInstanceOf(DownloaderTimeoutError);
      expect((result.error.cause as Error).message).toBe(
        `timeout exceeded. ${waitTimeout}`,
      );
    },
    { timeout: 30 * 1000 },
  );
});
