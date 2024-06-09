import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { ulid } from "ulid";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type { Channel, ChannelSlug } from "../../core/types.mjs";
import type { CrawlerInput } from "../../crawler/index.mjs";
import { getLogger } from "../../core/logger.mjs";
import { run as crawl } from "../../crawler/index.mjs";
import {
  load as loadChannels,
  save as saveChannels,
} from "../../io/local/channel.mjs";
import { save as saveEpisodes } from "../../io/local/episode.mjs";

const logger = getLogger();

const loadCrawlerInput = async (
  filePath: string,
): Promise<Result<CrawlerInput, Error>> => {
  try {
    const d = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(d);
    if ("channel" in data) {
      logger.info(`load file as crawlerInput. file=${filePath}}`);
      return new Success(data);
    }
    if ("crawlURL" in data) {
      logger.info(`load file as channel. file=${filePath}}`);
      return new Success({ channel: data });
    }
    return new Failure(
      new Error(
        `unknown format json. path=${filePath} data=${JSON.stringify(data)}`,
      ),
    );
  } catch (err) {
    return new Failure(new Error(`load data error`, { cause: err }));
  }
};

const isENOENT = (err: unknown): boolean => {
  if (err && err instanceof Error && "code" in err && err.code === "ENOENT") {
    return true;
  }
  return false;
};

const findOrCreateByCrawlURL = async (
  crawlURL: string,
  baseDir: string,
): Promise<Result<Channel, Error>> => {
  const loading = await loadChannels({ config: { baseDir } });
  if (loading.isSuccess()) {
    const channels = loading.value.values;
    const exists = channels.find((c) => c.crawlURL === crawlURL);
    if (exists) {
      return new Success(exists);
    }
  }

  if (loading.isFailure()) {
    const err = loading.error;
    if (isENOENT(err.cause)) {
      // no data dir
      logger.warn(`no data dir. dir=${baseDir}`);
    } else {
      return new Failure(
        new Error("find channel failed", { cause: loading.error }),
      );
    }
  }
  const channel: Channel = {
    slug: ulid() as ChannelSlug,
    crawlURL: crawlURL,
    mediaURL: crawlURL, // TODO:
    name: crawlURL, // TODO
  };

  const saving = await saveChannels({
    values: [channel],
    config: { baseDir },
  });
  if (saving.isFailure()) {
    logger.warn(`save as channel failed. error=${saving.error}`);
  }
  return new Success(channel);
};

(async () => {
  const arg = await yargs(hideBin(process.argv))
    .option("url", {
      alias: "u",
      type: "string",
      description: "crawl target url",
    })
    .option("input", {
      alias: "i",
      type: "string",
      description: "crawler input json file path",
    })
    .option("data-dir", {
      alias: "d",
      type: "string",
      description: "episode save dir",
      default: "../data/",
    })
    .check((argv) => {
      if (!argv.input && !argv.url) {
        throw new Error("Either --input or --url must be provided");
      }
      return true;
    })
    .help()
    .alias("help", "h")
    .parse();

  const input: CrawlerInput = await (async (arg) => {
    if (arg.input) {
      return (await loadCrawlerInput(arg.input)).unwrap();
    }
    if (arg.url) {
      const channel = (
        await findOrCreateByCrawlURL(arg.url, arg.dataDir)
      ).unwrap();
      return { channel };
    }
    throw new Error("no input found.");
  })(arg);
  const baseDir = path.resolve(arg.dataDir);
  const output = (await crawl(input)).unwrap();
  const episodes = output.episodes;
  console.log(`crawl done. episode count=${episodes.length}`);

  const saved = (
    await saveEpisodes({ values: episodes, config: { baseDir } })
  ).unwrap();

  console.log(JSON.stringify(saved.saved));
})();
