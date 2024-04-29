import Parser from "rss-parser";
import { ulid } from "ulid";
import { type Result, Success, Failure } from "../core/result.mjs";
import type { Channel, Episode, EpisodeID } from "../core/types.mjs";
import { tryParseDate } from "../core/datetime.mjs";

type ExtractorInput = {
  channel: Channel;
  content: string;
};
type ExtractorOutput = {
  episodes: Episode[];
};
class ExtractorError extends Error {}

const run = async (
  input: ExtractorInput
): Promise<Result<ExtractorOutput, ExtractorError>> => {
  const parser = new Parser();
  try {
    const feed = await parser.parseString(input.content);

    const episodes: Episode[] = feed.items.map((item) => ({
      id: ulid() as EpisodeID,
      theirId: item.guid || "",
      title: item.title || "",
      published_at: tryParseDate(item.pubDate)?.toISOString() || "",
      description: item.itunes?.summary || item.content || "",
      streaming: "static",
      streamURL: item.enclosure?.url || "",
      channelId: input.channel.id,
    }));

    const output: ExtractorOutput = {
      episodes,
    };
    return new Success(output);
  } catch (err) {
    return new Failure(new ExtractorError("RSS Parse Failed", { cause: err }));
  }
};

export { run };
