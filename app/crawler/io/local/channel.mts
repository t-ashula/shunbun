import path from "path";
import fs from "node:fs/promises";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type { Channel, ChannelSlug } from "../../core/types.mjs";
import { isChannel } from "../../core/types.mjs";
import { getLogger } from "../../core/logger.mjs";
import type {
  LoaderInput,
  LoaderOutput,
  SaverInput,
  SaverOutput,
  SaverResult,
} from "../index.mjs";

import { LoaderError, SaverError } from "../index.mjs";
import { listDirs } from "../../core/file.mjs";

type ChannelLoadConfig = {
  channelSlug?: ChannelSlug;
};
type ChannelSaveConfig = {
  update?: boolean; // TODO: move to SaveConfig.
};
type ChannelLocalConfig = {
  baseDir: string;
};
type ChannelLoadLocalConfig = ChannelLoadConfig & ChannelLocalConfig & {};
type ChannelSaveLocalConfig = ChannelSaveConfig & ChannelLocalConfig & {};
type ChannelSaveOutput = {};

const CHANNEL_FILE = "channel.json";

const logger = getLogger();

const channelFilePath = (
  channelSlug: ChannelSlug,
  config: ChannelLocalConfig,
): string => {
  return path.join(config.baseDir, channelSlug, CHANNEL_FILE);
};

const saveChannel = async (
  channel: Channel,
  config: ChannelSaveLocalConfig,
): Promise<SaverResult<ChannelSaveOutput>> => {
  try {
    const { slug } = channel;
    const filePath = channelFilePath(slug, config);

    if (!config.update) {
      try {
        await fs.access(filePath);
        return new Success({});
      } catch (err) {
        // nothing.
        // TODO: check file exists
        logger.info(`save channel skipped. slug=${slug}`);
      }
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(channel, null, 2));

    return new Success({});
  } catch (error) {
    logger.error(`Failed to save Channel: ${error}`);
    return new Failure(new SaverError("save local failed.", { cause: error }));
  }
};

const save = async (
  input: SaverInput<Channel, ChannelLoadLocalConfig>,
): Promise<Result<SaverOutput<Channel, ChannelSaveOutput>, SaverError>> => {
  const { values: channels, config } = input;

  const saved: Channel[] = [];
  const results: SaverResult<ChannelSaveOutput>[] = [];
  for (const channel of channels) {
    const out = await saveChannel(channel, config);
    if (out.isSuccess()) {
      saved.push(channel);
    }
    results.push(out);
  }
  return new Success({ results, saved });
};

const loadChannel = async (
  channelSlug: ChannelSlug,
  config: ChannelLoadLocalConfig,
): Promise<Result<LoaderOutput<Channel>, LoaderError>> => {
  const filePath = channelFilePath(channelSlug, config);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    if (isChannel(data)) {
      return new Success({ values: [data] });
    }
    logger.warn(`unknown data found. path=${filePath}`);
    return new Success({ values: [] });
  } catch (err) {
    logger.error(`local load channel failed. slug=${channelSlug} error=${err}`);
    return new Failure(new LoaderError("load channel failed", { cause: err }));
  }
};

const listChannelSlugs = async (
  config: ChannelLocalConfig,
): Promise<Result<string[], LoaderError>> => {
  // TODO: use index file
  const dir = config.baseDir;
  const listing = await listDirs(dir);
  if (listing.isFailure()) {
    logger.warn(`read dir failed. dir=${dir} error=${listing.error}`);
    return new Failure(
      new LoaderError("read dir failed", { cause: listing.error }),
    );
  }

  return listing;
};

const load = async (
  input: LoaderInput<ChannelLoadLocalConfig>,
): Promise<Result<LoaderOutput<Channel>, LoaderError>> => {
  const { config } = input;
  logger.debug(`load channel called. config=${JSON.stringify(config)}`);
  if (config.channelSlug !== undefined) {
    return loadChannel(config.channelSlug, config);
  }

  const listing = await listChannelSlugs(config);
  if (listing.isFailure()) {
    return new Failure(
      new LoaderError("list channel id failed", { cause: listing.error }),
    );
  }
  const ids = listing.value;
  const results = await Promise.all(
    ids.map(async (slug) => await loadChannel(slug as ChannelSlug, config)),
  );
  // TODO: Failure 握りつぶして良い？
  const values = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat()
    .filter((ch) => ch !== undefined);

  return new Success({ values });
};

export type {
  ChannelLoadLocalConfig,
  ChannelSaveLocalConfig,
  ChannelSaveOutput,
};
export { load, save };
