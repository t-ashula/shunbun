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

const stringify = async (content: string | Response): Promise<string> => {
  if (content instanceof Response) {
    return await content.text();
  } else {
    return content;
  }
};

const run: ExtractFunction = async (
  input: ExtractorInput,
): Promise<Result<ExtractorOutput, ExtractorError>> => {
  const parser = new Parser();
  const { channel, content } = input;
  try {
    const text = await stringify(content);
    const feed = await parser.parseString(text);

    const episodes: Episode[] = feed.items.map((item) => ({
      id: ulid() as EpisodeID,
      theirId: item.guid || "",
      title: item.title || "",
      published_at: tryParseDate(item.pubDate)?.toISOString() || "",
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

export { run };
