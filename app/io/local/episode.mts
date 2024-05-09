import path from "path";
import fs from "fs/promises";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type { ChannelID, Episode, EpisodeID } from "../../core/types.mjs";
import { isEpisode } from "../../core/types.mjs";
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

const EPISODE_FILE = "episode.json";

const logger = getLogger();

const channelsDir = (
  channelId: ChannelID,
  config: EpisodeLocalConfig,
): string => {
  return path.join(config.baseDir, channelId);
};

const episodeFilePath = (
  episode: Episode,
  config: EpisodeLocalConfig,
): string => {
  return path.join(
    channelsDir(episode.channelId, config),
    episode.id,
    EPISODE_FILE,
  );
};

// TODO: move somewhere
const sameEpisode = (lhs: Episode, rhs: Episode): boolean => {
  if (lhs.channelId !== rhs.channelId) {
    return false;
  }
  // same rss.guid
  if (lhs.theirId !== "" && rhs.theirId !== "" && lhs.theirId === rhs.theirId) {
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
    logger.debug(
      `fetchSavedEpisodes par channel. channelId=${channelId} episodeId=${episode.id} fetched=${channelId in result}`,
    );
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
      result[channelId] = [];
      continue;
    }
    const episodes = loading.value.values;
    logger.info(
      `load episode done. channelId=${channelId} episodes.length=${episodes.length}`,
    );
    result[channelId] = episodes;
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
    // TODO: reduce complexity
    const already = savedEpisodes[episode.channelId] || [];
    if (already.some((ep) => sameEpisode(ep, episode))) {
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
  const channelDir = channelsDir(config.channelId, config);
  const listing = await listDirs(channelDir);
  if (listing.isFailure()) {
    // FIXME: return success?
    logger.warn(
      `read channels dir failed. dir=${channelDir} error=${listing.error}`,
    );
    return new Failure(
      new LoaderError("read channels dir failed", { cause: listing.error }),
    );
  }

  // TODO: episodeId filtering
  const candidates = listing.value;
  logger.info(
    `listDir done. channelDir=${channelDir} candidates=${candidates.join(",")}`,
  );
  const episodes = await Promise.all(
    candidates.map(async (dir) => {
      const filePath = path.join(dir, EPISODE_FILE);
      try {
        const text = await fs.readFile(filePath, "utf-8");
        const data = JSON.parse(text);
        if (isEpisode(data)) {
          return data;
        }
      } catch (err) {
        // nothing.
        // TODO: check errno
        logger.info(
          `read episode json file failed. path=${filePath} error=${err}`,
        );
      }
      return;
    }),
  );
  const values = episodes.filter((data) => data !== undefined);

  return new Success({ values });
};

export type {
  EpisodeLoadLocalConfig,
  EpisodeSaveLocalConfig,
  EpisodeSaveOutput,
};
export { load, save };
