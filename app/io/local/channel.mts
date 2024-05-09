import path from "path";
import fs from "node:fs/promises";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type { Channel, ChannelID } from "../../core/types.mjs";
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
  channelId?: ChannelID;
};
type ChannelSaveConfig = {
  update?: boolean; // TODO: move to SaveConfig.
};

type ChannelSaveOutput = {};

type ChannelLocalConfig = {
  baseDir: string;
};
type ChannelLoadLocalConfig = ChannelLoadConfig & ChannelLocalConfig & {};
type ChannelSaveLocalConfig = ChannelSaveConfig & ChannelLocalConfig & {};

const CHANNEL_FILE = "channel.json";

const logger = getLogger();

const channelFilePath = (
  channel: Channel,
  config: ChannelLocalConfig,
): string => {
  return path.join(config.baseDir, channel.id, CHANNEL_FILE);
};

const saveChannel = async (
  channel: Channel,
  config: ChannelSaveLocalConfig,
): Promise<SaverResult<ChannelSaveOutput>> => {
  try {
    const filePath = channelFilePath(channel, config);

    if (!config.update) {
      try {
        await fs.access(filePath);
        return new Success({});
      } catch (err) {
        // nothing.
        // TODO: check file exists
        logger.info(`save channel skipped. id=${channel.id}`);
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

const load = async (
  input: LoaderInput<ChannelLoadLocalConfig>,
): Promise<Result<LoaderOutput<Channel>, LoaderError>> => {
  const { config } = input;
  const dir = config.baseDir;
  const listing = await listDirs(dir);
  if (listing.isFailure()) {
    logger.warn(`read dir failed. dir=${dir} error=${listing.error}`);
    return new Failure(
      new LoaderError("read dir failed", { cause: listing.error }),
    );
  }

  // TODO: channelId filtering
  const candidates = listing.value;
  const channels = await Promise.all(
    candidates.map(async (dir) => {
      const filePath = path.join(dir, CHANNEL_FILE);
      try {
        const text = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(text);
        if (isChannel(data)) {
          return data;
        }
      } catch (err) {
        // nothing.
        // TODO: check ENOENT, EACCES, etc. ?
      }
      return;
    }),
  );

  const values = channels.filter((data) => data !== undefined);

  return new Success({ values });
};

export type {
  ChannelLoadLocalConfig,
  ChannelSaveLocalConfig,
  ChannelSaveOutput,
};
export { load, save };
