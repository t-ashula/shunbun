// crawler
import { Failure, Success, type Result } from "../core/result.mjs";
import { getLogger } from "../core/logger.mjs";
import { run as download, stringify } from "../downloader/index.mjs";
import type { DownloaderInput } from "../downloader/index.mjs";
import type { Channel, Episode } from "../core/types.mjs";
import type { ExtractorInput } from "./extractor/index.mjs";
import { run as extractEpisodes } from "./extractor/index.mjs";

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
  logger.info(`crawler download success. crawlURL=${channel.crawlURL}`);

  const ei: ExtractorInput = {
    channel,
    content: await stringify(downloaded.response),
    meta: {
      url: downloaded.response.url, // ???
      contentType: downloaded.response.headers.get("content-type") || "",
    },
  };
  if (downloaded.response.status !== 200) {
    logger.warn(
      `response status is not good. status=${downloaded.response.status} crawl url=${channel.crawlURL}`,
    );
    return new Failure(new CrawlerError(`crawl url status code is not good.`));
  }
  const extracting = await extractEpisodes(ei);

  if (extracting.isFailure()) {
    return new Failure(
      new CrawlerError("extraction failed.", { cause: extracting.error }),
    );
  }

  const episodes = extracting.value.episodes;
  logger.info(`crawler extraction success. episodes=${episodes.length}`);
  const output = {
    channel,
    episodes,
  };
  return new Success(output);
};

export type { CrawlerInput, CrawlerOutput };
export { run, CrawlerError };
