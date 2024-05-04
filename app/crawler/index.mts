// crawler
import mime from "mime";
import { Failure, Success, type Result } from "../core/result.mjs";
import { getLogger } from "../core/logger.mjs";
import { run as download, stringify } from "../downloader/index.mjs";
import type {
  DownloaderInput,
  DownloaderOutput,
} from "../downloader/index.mjs";
import { run as rssExtractor } from "./extractor/rss.mjs";
import type { Channel, Episode } from "../core/types.mjs";
import type { ExtractFunction } from "./extractor/index.mjs";
import { ExtractorError } from "./extractor/index.mjs";

type CrawlerInput = {
  channel: Channel;
};
type CrawlerOutput = {
  channel: Channel;
  episodes: Episode[];
};
class CrawlerError extends Error {}

const logger = getLogger();

const run = async (
  input: CrawlerInput,
): Promise<Result<CrawlerOutput, CrawlerError>> => {
  logger.debug(`crawler.run called. input=${JSON.stringify(input)}`);

  const { channel } = input;
  const di: DownloaderInput = {
    requestUrl: channel.crawlURL,
  };

  const downloading = await download(di);
  if (downloading.isFailure()) {
    return new Failure(
      new CrawlerError("download failed.", { cause: downloading.error }),
    );
  }
  const downloaded = downloading.value;
  const extracting = await extractEpisodes(channel, downloaded);

  if (extracting.isFailure()) {
    return new Failure(
      new CrawlerError("extraction failed.", { cause: extracting.error }),
    );
  }
  const output = {
    channel,
    episodes: extracting.value,
  };
  return new Success(output);
};

const extractEpisodes = async (
  channel: Channel,
  downloaded: DownloaderOutput,
): Promise<Result<Episode[], Error>> => {
  const extractor = await selectExtractor(channel, downloaded);
  if (extractor === null) {
    return new Failure(new ExtractorError("unsupported content"));
  }

  const content = await stringify(downloaded.response);
  const extracting = await extractor({ channel, content });
  if (extracting.isFailure()) {
    return new Failure(
      new ExtractorError("extraction failed.", { cause: extracting.error }),
    );
  }
  const { episodes } = extracting.value;
  return new Success(episodes);
};

const selectExtractor = async (
  _channel: Channel,
  downloaded: DownloaderOutput,
): Promise<ExtractFunction | null> => {
  const headers = downloaded.response.headers;
  const contentType = headers.get("content-type");
  if (contentType) {
    const ext = mime.getExtension(contentType);
    switch (ext) {
      case "rss":
        return rssExtractor;
      default:
        break;
    }
  }
  return null;
};

export type { CrawlerInput, CrawlerOutput };
export { run, CrawlerError };
