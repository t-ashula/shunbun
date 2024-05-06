import path from "path";
import fs from "node:fs/promises";

import { Failure, Success, type Result } from "../../core/result.mjs";
import type { Channel, ChannelID } from "../../core/types.mjs";
import { getLogger } from "../../core/logger.mjs";
import type {
  LoaderInput,
  LoaderOutput,
  SaverInput,
  SaverOutput,
  SaverResult,
} from "../index.mjs";

import { LoaderError, SaverError } from "../index.mjs";

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

const CHANNEL_DIR = "channels";
const logger = getLogger();

const channelDir = (config: ChannelLocalConfig): string => {
  return path.join(config.baseDir, CHANNEL_DIR);
};

const channelFilePath = (
  channel: Channel,
  config: ChannelLocalConfig,
): string => {
  return path.join(channelDir(config), `${channel.id}.json`);
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
  const dir = channelDir(config);
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
  } catch (err) {
    logger.warn(`read dir failed. dir=${dir} error=${err}`);
    return new Failure(new LoaderError("read dir failed", { cause: err }));
  }

  // TODO: channelId filtering
  try {
    const data = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dir, file);
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
      }),
    );
    const channels = data; // TODO: filter by type check

    return new Success({ values: channels });
  } catch (err) {
    logger.warn(`read channel json file failed. error=${err}`);
    return new Failure(new LoaderError("read files failed", { cause: err }));
  }
};

export type {
  ChannelLoadLocalConfig,
  ChannelSaveLocalConfig,
  ChannelSaveOutput,
};
export { load, save };
