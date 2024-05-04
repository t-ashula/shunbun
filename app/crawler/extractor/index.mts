import type { Result } from "../../core/result.mjs";
import { Failure } from "../../core/result.mjs";
import type { Channel, Episode } from "../../core/types.mjs";
import { run as rssExtractor, canHandle as isRSS } from "./rss.mjs";

type ExtractorInput = {
  channel: Channel;
  content: string;
  meta?: {
    url?: string;
    contentType?: string;
    path?: string;
  };
};
type ExtractorOutput = {
  episodes: Episode[];
};
class ExtractorError extends Error {}

type ExtractFunction = (
  _input: ExtractorInput,
) => Promise<Result<ExtractorOutput, ExtractorError>>;

const run = async (
  input: ExtractorInput,
): Promise<Result<ExtractorOutput, ExtractorError>> => {
  const checkers = [isRSS];
  const extractors = [rssExtractor];
  const supports = await Promise.all(
    checkers.map(async (checker) => checker(input)),
  );
  const i = supports.findIndex((s) => s === true);
  if (i === -1) {
    return new Failure(new ExtractorError("unsupported content"));
  }
  const extractor = extractors[i];
  return extractor(input);
};

export type { ExtractorInput, ExtractorOutput, ExtractFunction };
export { run, ExtractorError };
