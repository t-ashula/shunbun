import path from "path";
import fs from "fs/promises";

import { Failure, Success, type Result } from "../../core/result.mjs";
import type { ChannelID, Episode, EpisodeID } from "../../core/types.mjs";
import { getLogger } from "../../core/logger.mjs";
import type {
  LoaderInput,
  LoaderOutput,
  SaverInput,
  SaverOutput,
  SaverResult,
} from "../index.mjs";

import { LoaderError, SaverError } from "../index.mjs";

type EpisodeLoadConfig = {
  channelId: ChannelID;
  episodeId?: EpisodeID;
};

type EpisodeSaveConfig = {
  update?: boolean;
};

type EpisodeSaveOutput = {};

type EpisodeLocalConfig = {
  baseDir: string;
};

type EpisodeLoadLocalConfig = EpisodeLoadConfig & EpisodeLocalConfig & {};
type EpisodeSaveLocalConfig = EpisodeSaveConfig & EpisodeLocalConfig & {};

const EPISODE_DIR = "episodes";
const logger = getLogger();

const episodeDir = (config: EpisodeLocalConfig): string => {
  return path.join(config.baseDir, EPISODE_DIR);
};
const channelsDir = (
  channelId: ChannelID,
  config: EpisodeLocalConfig,
): string => {
  return path.join(episodeDir(config), channelId);
};

const episodeFilePath = (
  episode: Episode,
  config: EpisodeLocalConfig,
): string => {
  return path.join(
    channelsDir(episode.channelId, config),
    `${episode.id}.json`,
  );
};

const episodeExists = async (
  episode: Episode,
  haystack: Episode[],
): Promise<boolean> => {
  // TODO: move somewhere
  const sameEpisode = (lhs: Episode, rhs: Episode): boolean => {
    if (lhs.channelId !== rhs.channelId) {
      return false;
    }
    // same rss.guid
    if (
      lhs.theirId !== "" &&
      rhs.theirId !== "" &&
      lhs.theirId === rhs.theirId
    ) {
      return true;
    }
    // same target url
    if (
      lhs.streamURL !== "" &&
      rhs.streamURL !== "" &&
      lhs.streamURL === rhs.streamURL
    ) {
      return true;
    }
    // TODO: compare title, description, etc.
    return false;
  };
  return haystack.some((ep) => sameEpisode(ep, episode));
};

const saveEpisode = async (
  episode: Episode,
  config: EpisodeSaveLocalConfig,
): Promise<SaverResult<EpisodeSaveOutput>> => {
  try {
    const filePath = episodeFilePath(episode, config);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(episode, null, 2));
    return new Success({});
  } catch (error) {
    logger.error(
      `save episode failed. episode=${JSON.stringify(episode)} error=${error}`,
    );
    return new Failure(new SaverError("save local failed.", { cause: error }));
  }
};

const fetchSavedEpisodes = async (
  episodes: Episode[],
  config: EpisodeSaveLocalConfig,
): Promise<Record<ChannelID, Episode[]>> => {
  // const channels = episodes.map(e => e.channelId);
  const result: Record<ChannelID, Episode[]> = {};
  for (const episode of episodes) {
    const channelId = episode.channelId;
    if (channelId in result) {
      continue;
    }

    const loading = await load({
      config: { baseDir: config.baseDir, channelId },
    });
    if (loading.isFailure()) {
      logger.warn(
        `load channels episodes failed. channelId=${channelId} error=${loading.error}`,
      );
      continue; //
    }
    result[channelId] = loading.value.values;
  }
  return result;
};

const save = async (
  input: SaverInput<Episode, EpisodeLocalConfig>,
): Promise<Result<SaverOutput<Episode, EpisodeSaveOutput>, SaverError>> => {
  const { values: episodes, config } = input;

  const savedEpisodes = await fetchSavedEpisodes(episodes, config);
  const saved: Episode[] = [];
  const results: SaverResult<EpisodeSaveOutput>[] = [];
  for (const episode of episodes) {
    if (await episodeExists(episode, savedEpisodes[episode.channelId])) {
      results.push(new Success({}));
      continue;
    }
    const out = await saveEpisode(episode, config);
    if (out.isSuccess()) {
      saved.push(episode);
    }
    results.push(out);
  }
  return new Success({ results, saved });
};

const load = async (
  input: LoaderInput<EpisodeLoadLocalConfig>,
): Promise<Result<LoaderOutput<Episode>, LoaderError>> => {
  const { config } = input;
  const dir = channelsDir(config.channelId, config);
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((file) => file.endsWith(".json"));
  } catch (err) {
    logger.warn(`read dir failed. dir=${dir} error=${err}`);
    return new Failure(new LoaderError("read dir failed", { cause: err }));
  }

  // TODO: episodeId filtering
  try {
    const data = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(dir, file);
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data);
      }),
    );
    const episodes = data; // TODO: filter by type check

    return new Success({ values: episodes });
  } catch (err) {
    logger.warn(`read episode json file failed. error=${err}`);
    return new Failure(new LoaderError("read files failed", { cause: err }));
  }
};

export type {
  EpisodeLoadLocalConfig,
  EpisodeSaveLocalConfig,
  EpisodeSaveOutput,
};
export { load, save };
