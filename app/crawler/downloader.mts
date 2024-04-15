// downloader

import { Failure, type Result } from "../core/result.mjs";
import { getLogger } from "../core/logger.mjs";
import { NotImplementedError } from "../core/errors.mjs";

type DownloaderInput = {
  requestUrl: string;
};
type DownloaderOutput = {
  request: Request;
  response: Response;
};

class DownloaderError extends Error {}

const logger = getLogger();

const run = async (
  input: DownloaderInput
): Promise<Result<DownloaderOutput, DownloaderError>> => {
  logger.debug(`Downloader.run called. input=${JSON.stringify(input)}`);
  return new Failure(
    new NotImplementedError("Downloader.run is not implemented")
  );
};

export type { DownloaderInput, DownloaderOutput };
export { run, DownloaderError };
