import Parser from "rss-parser";
import { ulid } from "ulid";
import { type Result, Success, Failure } from "../../core/result.mjs";
import type { Episode, EpisodeID } from "../../core/types.mjs";
import { tryParseDate } from "../../core/datetime.mjs";
import type {
  ExtractorInput,
  ExtractorOutput,
  ExtractFunction,
} from "./index.mjs";
import { ExtractorError } from "./index.mjs";

const run: ExtractFunction = async (
  input: ExtractorInput
): Promise<Result<ExtractorOutput, ExtractorError>> => {
  const parser = new Parser();
  const { channel, content } = input;
  try {
    const feed = await parser.parseString(content);

    const episodes: Episode[] = feed.items.map((item) => ({
      id: ulid() as EpisodeID,
      theirId: item.guid || "",
      title: item.title || "",
      publishedAt: tryParseDate(item.pubDate) || new Date(), // now ?
      description: item.itunes?.summary || item.content || "",
      streaming: "static",
      streamURL: item.enclosure?.url || "",
      channelId: channel.id,
    }));

    const output: ExtractorOutput = {
      episodes,
    };
    return new Success(output);
  } catch (err) {
    return new Failure(new ExtractorError("RSS Parse Failed", { cause: err }));
  }
};

const canHandle = async (input: ExtractorInput): Promise<boolean> => {
  const { meta } = input;
  if (meta && meta.contentType && meta.contentType.match(/application\/rss/)) {
    return true;
  }
  return false;
};

export { run, canHandle };
