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

type CheckFunction = (_input: ExtractorInput) => Promise<boolean>;

const SUPPORTED_EXTRACTORS: {
  name: string;
  checker: CheckFunction;
  handler: ExtractFunction;
}[] = [
  {
    name: "rss",
    checker: isRSS,
    handler: rssExtractor,
  },
];

const run = async (
  input: ExtractorInput,
): Promise<Result<ExtractorOutput, ExtractorError>> => {
  const supports = await Promise.all(
    SUPPORTED_EXTRACTORS.map(async ({ checker }) => checker(input)),
  );
  const i = supports.findIndex((s) => s === true);
  if (i === -1) {
    return new Failure(new ExtractorError("unsupported content"));
  }
  const extractor = SUPPORTED_EXTRACTORS[i]["handler"];
  return extractor(input);
};

export type { ExtractorInput, ExtractorOutput, ExtractFunction };
export { run, ExtractorError };
