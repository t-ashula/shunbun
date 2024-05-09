import path from "path";
import fs from "fs/promises";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type {
  ChannelID,
  Episode,
  EpisodeID,
  StoredEpisode,
} from "../../core/types.mjs";
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

type StoredLoadConfig = {
  channelId: ChannelID;
  episodeId: EpisodeID;
};

type StoredSaveConfig = {
  update?: boolean;
};

type StoredSaveOutput = {};

type StoredLocalConfig = {
  baseDir: string;
};

type StoredLoadLocalConfig = StoredLoadConfig & StoredLocalConfig & {};
type StoredSaveLocalConfig = StoredSaveConfig & StoredLocalConfig & {};

const STORED_FILE = "stored.json";

const logger = getLogger();

const episodeDir = (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: StoredLocalConfig,
): string => {
  return path.join(config.baseDir, channelId, episodeId);
};

const storedFilePath = (
  episode: Episode,
  config: StoredLocalConfig,
): string => {
  return path.join(
    episodeDir(episode.channelId, episode.id, config),
    STORED_FILE,
  );
};

const saveStored = async (
  stored: StoredEpisode,
  config: StoredSaveLocalConfig,
): Promise<SaverResult<StoredSaveOutput>> => {
  const episode = stored.episode;
  const filePath = storedFilePath(episode, config);

  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(episode, null, 2));
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

const load = async (
  input: LoaderInput<StoredLoadLocalConfig>,
): Promise<Result<LoaderOutput<StoredEpisode>, LoaderError>> => {
  const { config } = input;
  const dir = episodeDir(config.channelId, config.episodeId, config);
  const filePath = path.join(dir, STORED_FILE);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    if (isStoredEpisode(data)) {
      return new Success({ values: [data] });
    }
  } catch (err) {
    return new Failure(
      new LoaderError("load stored episode failed", { cause: err }),
    );
  }
  return new Failure(new LoaderError("load stored episode failed"));
};

export type { StoredLoadLocalConfig, StoredSaveLocalConfig, StoredSaveOutput };
export { load, save };
