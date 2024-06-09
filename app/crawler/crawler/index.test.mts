import {
  expect,
  describe,
  it,
  assert,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";

import { HttpResponse } from "msw";

import type { Channel, ChannelSlug, Episode } from "../core/types.mjs";
import { Failure, Success } from "../core/result.mjs";

import { run as download, DownloaderError } from "../downloader/index.mjs";
import { run as extractEpisodes, ExtractorError } from "./extractor/index.mjs";
import type { ExtractorOutput } from "./extractor/index.mjs";

import { CrawlerError, run } from "./index.mjs";

vi.mock("../downloader/index.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  // @ts-ignore; FIXME
  return { ...actual, run: vi.fn() };
});

vi.mock("./extractor/index.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  // @ts-ignore; FIXME
  return { ...actual, run: vi.fn() };
});

beforeAll(() => {});
beforeEach(() => {});
afterEach(() => {
  vi.resetAllMocks();
});
afterAll(() => {});

const TEST_CHANNEL: Channel = {
  slug: "test" as ChannelSlug,
  name: "test channel",
  crawlURL: "https://channel.test/feed",
  mediaURL: "https://channle.test/media",
};

describe("run", () => {
  it("return a Failure when download failed.", async () => {
    // @ts-ignore; // FIXME
    download.mockImplementation(async () => {
      return new Failure(new DownloaderError("downloader something wrong."));
    });

    const input = { channel: TEST_CHANNEL };
    const result = await run(input);

    assert(result.isFailure() === true); // FIXME:

    expect(result.error).instanceOf(CrawlerError);
    expect(result.error.message).toEqual("download failed.");
    expect(result.error.cause).instanceOf(DownloaderError);
  });
  it("return a Failure when extractor failed.", async () => {
    // @ts-ignore; // FIXME
    download.mockImplementation(async () => {
      const output = {
        request: {},
        response: HttpResponse.text("<?xml>"),
      };
      return new Success(output);
    }); // @ts-ignore; FIXME
    extractEpisodes.mockImplementation(async () => {
      return new Failure(new ExtractorError("extractor something wrong."));
    });

    const input = { channel: TEST_CHANNEL };
    const result = await run(input);

    assert(result.isFailure() === true); // FIXME:

    expect(result.error).instanceOf(CrawlerError);
    expect(result.error.message).toEqual("extraction failed.");
    expect(result.error.cause).instanceOf(ExtractorError);
  });
  it("return a Success when extractor success", async () => {
    // @ts-ignore; // FIXME
    download.mockImplementation(async () => {
      const output = {
        request: {},
        response: HttpResponse.text("what ever"),
      };
      return new Success(output);
    });
    const expectedEpisodes: Episode[] = [];

    // @ts-ignore; // FIXME
    extractEpisodes.mockImplementation(async () => {
      const output: ExtractorOutput = {
        episodes: expectedEpisodes,
      };

      return new Success(output);
    });

    const input = { channel: TEST_CHANNEL };
    const result = await run(input);

    assert(result.isSuccess() === true, JSON.stringify(result)); // FIXME:
    const actual = result.value;
    expect(actual.channel).toStrictEqual(TEST_CHANNEL);
    expect(actual.episodes.length).toBe(expectedEpisodes.length);
  });
});
