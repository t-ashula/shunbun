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
  _input: ExtractorInput
) => Promise<Result<ExtractorOutput, ExtractorError>>;

const run = async (
  input: ExtractorInput
): Promise<Result<ExtractorOutput, ExtractorError>> => {
  const extractor = await selectExtractor(input);
  if (extractor === null) {
    return new Failure(new ExtractorError("unsupported content"));
  }

  return extractor(input);
};

const selectExtractor = async (
  input: ExtractorInput
): Promise<ExtractFunction | null> => {
  let typeCheck = await isRSS(input);
  if (typeCheck) {
    return rssExtractor;
  }
  return null;
};

export type { ExtractorInput, ExtractorOutput, ExtractFunction };
export { run, ExtractorError };
