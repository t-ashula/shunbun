// downloader

import { Failure, Success, type Result } from "../core/result.mjs";
import { getLogger } from "../core/logger.mjs";

import { Fetch } from "./fetch.mjs";

type DownloaderInput = {
  requestUrl: string;

  player?: DownloadPlayers;
  method?: string;
  userAgent?: string;
  headers?: Record<string, string>;
  waitTimeout?: number;
};
type DownloaderOutput = {
  request: Request;
  response: Response;
};

type DownloadPlayers = "fetch";
class DownloaderError extends Error {}

const logger = getLogger();

const run = async (
  input: DownloaderInput
): Promise<Result<DownloaderOutput, DownloaderError>> => {
  logger.debug(`Downloader.run called. input=${JSON.stringify(input)}`);

  try {
    const request = new Request(new URL(input.requestUrl));
    const response = await Fetch.native(request);
    const output: DownloaderOutput = {
      request,
      response,
    };
    return new Success(output);
  } catch (error) {
    return new Failure(new DownloaderError("fetch failed.", { cause: error }));
  }
};

export type { DownloaderInput, DownloaderOutput };
export { run, DownloaderError };
