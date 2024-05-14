import path from "path";
import fs from "fs/promises";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type { ChannelID, EpisodeID, StoredEpisode } from "../../core/types.mjs";
import { isStoredEpisode } from "../../core/types.mjs";
import { getLogger } from "../../core/logger.mjs";
import type {
  LoaderInput,
  LoaderOutput,
  SaverInput,
  SaverOutput,
  SaverResult,
} from "../index.mjs";
import { LoaderError, SaverError } from "../index.mjs";
import { load as loadChannels } from "../../io/local/channel.mjs";
import { load as loadEpisodes } from "../../io/local/episode.mjs";
import { listDirs } from "../../core/file.mjs";

type StoredLoadConfig = {
  episodeId?: EpisodeID;
  channelId?: ChannelID;
  // TODO: storedId?: StoredID;
};
type StoredSaveConfig = {
  update?: boolean;
};
type StoredLocalConfig = {
  baseDir: string;
};

type StoredLoadLocalConfig = StoredLoadConfig & StoredLocalConfig & {};
type StoredSaveLocalConfig = StoredSaveConfig & StoredLocalConfig & {};

type StoredSaveOutput = {};

const STORED_FILE = "stored.json";

const logger = getLogger();

const channelsDir = (
  channelId: ChannelID,
  config: StoredLocalConfig,
): string => {
  return path.join(config.baseDir, channelId);
};

const episodeDir = (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: StoredLocalConfig,
): string => {
  return path.join(config.baseDir, channelId, episodeId);
};

const storedFilePath = (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: StoredLocalConfig,
): string => {
  return path.join(episodeDir(channelId, episodeId, config), STORED_FILE);
};

const saveStored = async (
  stored: StoredEpisode,
  config: StoredSaveLocalConfig,
): Promise<SaverResult<StoredSaveOutput>> => {
  const episodeId = stored.episodeId;
  const episodeFinding = await loadEpisodes({
    config: { episodeId, baseDir: config.baseDir },
  });
  if (episodeFinding.isFailure()) {
    // TODO:
    return new Failure(new SaverError(`no target episode`));
  }
  const [episode] = episodeFinding.value.values;
  const filePath = storedFilePath(episode.channelId, episodeId, config);

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(stored, null, 2));
    return new Success({});
  } catch (error) {
    logger.error(
      `save stored episode failed. stored=${JSON.stringify(stored)} error=${error}`,
    );
    return new Failure(new SaverError("save local failed.", { cause: error }));
  }
};

const save = async (
  input: SaverInput<StoredEpisode, StoredLocalConfig>,
): Promise<
  Result<SaverOutput<StoredEpisode, StoredSaveOutput>, SaverError>
> => {
  const { values: storedEpisodes, config } = input;

  const saved: StoredEpisode[] = [];
  const results: SaverResult<StoredSaveOutput>[] = [];
  for (const episode of storedEpisodes) {
    const out = await saveStored(episode, config);
    if (out.isSuccess()) {
      saved.push(episode);
    }
    results.push(out);
  }
  return new Success({ results, saved });
};

const loadStoredEpisode = async (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: StoredLocalConfig,
): Promise<Result<LoaderOutput<StoredEpisode>, LoaderError>> => {
  const filePath = storedFilePath(channelId, episodeId, config);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    if (isStoredEpisode(data)) {
      return new Success({ values: [data] });
    }
    logger.warn(`unknown data found. path=${filePath}`);
    return new Failure(new LoaderError("no stored episode found"));
  } catch (err) {
    // TODO: check errno?
    logger.error(
      `read episode json file failed. path=${filePath} error=${err}`,
    );
    return new Failure(
      new LoaderError("load episode stored failed", { cause: err }),
    );
  }
};

const loadChannelStoredEpisode = async (
  channelId: ChannelID,
  config: StoredLocalConfig,
): Promise<Result<LoaderOutput<StoredEpisode>, LoaderError>> => {
  const dir = channelsDir(channelId, config);
  const listing = await listDirs(dir);
  if (listing.isFailure()) {
    return new Failure(listing.error);
  }
  const candidates = listing.value;
  const results = await Promise.all(
    candidates.map(async (ep) => {
      return loadStoredEpisode(channelId, ep as EpisodeID, config);
    }),
  );
  const storedEpisodes = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat();
  return new Success({ values: storedEpisodes });
};

const load = async (
  input: LoaderInput<StoredLoadLocalConfig>,
): Promise<Result<LoaderOutput<StoredEpisode>, LoaderError>> => {
  const { config } = input;

  if (config.channelId !== undefined) {
    if (config.episodeId !== undefined) {
      return loadStoredEpisode(config.channelId, config.episodeId, config);
    }
    return loadChannelStoredEpisode(config.channelId, config);
  }
  // no channelId
  const channelLoading = await loadChannels({
    config: { baseDir: config.baseDir },
  });
  if (channelLoading.isFailure()) {
    return new Failure(
      new LoaderError("load episode error", { cause: channelLoading.error }),
    );
  }

  const { values: channels } = channelLoading.value;
  const results = await Promise.all(
    channels.map(async (ch) => {
      return loadChannelStoredEpisode(ch.id, config);
    }),
  );
  const stored = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat()
    .filter((ep) => ep !== undefined);
  if (config.episodeId !== undefined) {
    const episode = stored.find((s) => s.episodeId === config.episodeId);
    if (episode !== undefined) {
      return new Success({ values: [episode] });
    }
    // XXX: or Success({ values: [] }) ?
    return new Failure(new LoaderError("episode not found"));
  }

  return new Success({ values: stored });
};

export type { StoredLoadLocalConfig, StoredSaveLocalConfig, StoredSaveOutput };
export { load, save };
