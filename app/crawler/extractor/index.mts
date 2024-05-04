import type { Result } from "../../core/result.mjs";
import type { Channel, Episode } from "../../core/types.mjs";

type ExtractorInput = {
  channel: Channel;
  content: string;
};
type ExtractorOutput = {
  episodes: Episode[];
};
class ExtractorError extends Error {}

type ExtractFunction = (
  _input: ExtractorInput,
) => Promise<Result<ExtractorOutput, ExtractorError>>;

export type { ExtractorInput, ExtractorOutput, ExtractFunction };
export { ExtractorError };
