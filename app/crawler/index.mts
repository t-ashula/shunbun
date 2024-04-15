// crawler

import { Failure, type Result } from "../core/result.mjs";
import { getLogger } from "../core/logger.mjs";
import { NotImplementedError } from "../core/errors.mjs";

type CrawlerInput = {
  url: string;
};
type CrawlerOutput = {
  url: string;
};
class CrawlerError extends Error {}

const logger = getLogger();

const run = async (
  input: CrawlerInput
): Promise<Result<CrawlerOutput, CrawlerError>> => {
  logger.debug(`crawler.run called. input=${JSON.stringify(input)}`);
  return new Failure(new NotImplementedError("Crawler.run is not implemented"));
};

export type { CrawlerInput, CrawlerOutput };
export { run, CrawlerError };
