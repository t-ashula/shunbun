import Parser from "rss-parser";
import { ulid } from "ulid";
import mime from "mime";
import xml2js from "xml2js";
import type { Result } from "../../core/result.mjs";
import { Success, Failure } from "../../core/result.mjs";
import type { Episode, EpisodeID } from "../../core/types.mjs";
import { tryParseDate, tryParseDuration } from "../../core/datetime.mjs";
import { getLogger } from "../../core/logger.mjs";
import type {
  ExtractorInput,
  ExtractorOutput,
  ExtractFunction,
} from "./index.mjs";
import { ExtractorError } from "./index.mjs";

const logger = getLogger();

const run: ExtractFunction = async (
  input: ExtractorInput,
): Promise<Result<ExtractorOutput, ExtractorError>> => {
  const parser = new Parser();
  const { channel, content } = input;
  try {
    const feed = await parser.parseString(content);

    const episodes: Episode[] = feed.items.map((item) => ({
      episodeId: ulid() as EpisodeID,
      theirId: item.guid || "",
      title: item.title || "",
      publishedAt: tryParseDate(item.pubDate) || new Date(), // now ?
      description: item.itunes?.summary || item.content || "",
      streaming: "static",
      streamURL: item.enclosure?.url || "",
      channelId: channel.channelId,
      duration: tryParseDuration(item.itunes?.duration),
      expectedContentType: item.enclosure?.type,
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
  const { meta, content } = input;
  if (meta && meta.contentType) {
    const ext = mime.getExtension(meta.contentType);
    if (ext === "rss") {
      return true;
    }
  }
  if (content) {
    try {
      // FIXME: should i use rss-parser?
      const parsed = await xml2js.parseStringPromise(content, {
        explicitArray: false,
      });
      if (parsed.rss && parsed.rss.channel && parsed.rss.channel.item) {
        return true;
      }
    } catch (err) {
      // pass
      logger.info(`rss.canHandler parse xml failed. error=${err}`);
    }
  }
  return false;
};

export { run, canHandle };
