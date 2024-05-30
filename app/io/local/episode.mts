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

import { LoaderError, SaverError } from "../../io/index.mjs";
import { load as loadChannels } from "../../io/local/channel.mjs";
import { listDirs } from "../../core/file.mjs";

type EpisodeLoadConfig = {
  episodeId?: EpisodeID;
  channelId?: ChannelID;
};
type EpisodeSaveConfig = {
  update?: boolean;
};
type EpisodeLocalConfig = {
  baseDir: string;
};

type EpisodeLoadLocalConfig = EpisodeLoadConfig & EpisodeLocalConfig & {};
type EpisodeSaveLocalConfig = EpisodeSaveConfig & EpisodeLocalConfig & {};

type EpisodeSaveOutput = {};

const EPISODE_FILE = "episode.json";

const logger = getLogger();

const channelsDir = (
  channelId: ChannelID,
  config: EpisodeLocalConfig,
): string => {
  return path.join(config.baseDir, channelId);
};

const episodeFilePath = (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: EpisodeLocalConfig,
): string => {
  return path.join(channelsDir(channelId, config), episodeId, EPISODE_FILE);
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
    const filePath = episodeFilePath(
      episode.channelId,
      episode.episodeId,
      config,
    );
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

const fetchSavedEpisodesOf = async (
  episodes: Episode[],
  config: EpisodeSaveLocalConfig,
): Promise<Result<Record<ChannelID, Episode[]>, Error>> => {
  const channelIds = [...new Set(episodes.map((e) => e.channelId)).values()];
  const inChannelLoading = await Promise.all(
    channelIds.map(async (channelId) => {
      return { channelId, result: await loadChannelEpisode(channelId, config) };
    }),
  );

  const episodeMap: Record<ChannelID, Episode[]> = {};
  inChannelLoading
    .filter(({ result }) => result.isSuccess()) // TODO: care Failure ?
    .forEach(({ channelId, result }) => {
      episodeMap[channelId] = result.unwrap().values; // TODO: success なのでちょくで values 取れるはず
    });
  return new Success(episodeMap);
};

const save = async (
  input: SaverInput<Episode, EpisodeLocalConfig>,
): Promise<Result<SaverOutput<Episode, EpisodeSaveOutput>, SaverError>> => {
  const { values: episodes, config } = input;

  let savedEpisodes: Record<ChannelID, Episode[]> = {};
  const fetching = await fetchSavedEpisodesOf(episodes, config);
  if (fetching.isFailure()) {
    // pass
  } else {
    savedEpisodes = fetching.value;
  }
  logger.debug(
    `savedEpisodes fetched. count(channel)=${Object.keys(savedEpisodes).length}`,
  );

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

const loadEpisode = async (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: EpisodeLocalConfig,
): Promise<Result<LoaderOutput<Episode>, LoaderError>> => {
  logger.debug(
    `loadEpisode called. channelId=${channelId} episodeId=${episodeId}`,
  );
  const filePath = episodeFilePath(channelId, episodeId, config);
  logger.debug(`loadEpisode try episode file. filePath=${filePath}`);

  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    if (isEpisode(data)) {
      return new Success({ values: [data] });
    }
    logger.warn(`unknown data found. path=${filePath}`);
    return new Success({ values: [] }); //
  } catch (err) {
    // TODO: check errno?
    logger.error(
      `read episode json file failed. path=${filePath} error=${err}`,
    );
    return new Failure(new LoaderError("load episode failed", { cause: err }));
  }
};

const loadChannelEpisode = async (
  channelId: ChannelID,
  config: EpisodeLocalConfig,
): Promise<Result<LoaderOutput<Episode>, LoaderError>> => {
  logger.debug(`loadChannelEpisode called. channelId=${channelId}`);
  const dir = channelsDir(channelId, config);
  logger.debug(`loadChannelEpisode channelsDir=${dir}`);
  const listing = await listDirs(dir);
  if (listing.isFailure()) {
    return new Failure(listing.error);
  }
  const candidates = listing.value;
  const results = await Promise.all(
    candidates.map(async (ep) => {
      return loadEpisode(channelId, ep as EpisodeID, config);
    }),
  );
  const episodes = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat();
  return new Success({ values: episodes });
};

const load = async (
  input: LoaderInput<EpisodeLoadLocalConfig>,
): Promise<Result<LoaderOutput<Episode>, LoaderError>> => {
  const { config } = input;
  logger.debug(
    `episode load called. baseDir=${config.baseDir} channelId=${config.channelId} episodeId=${config.episodeId}`,
  );
  if (config.channelId !== undefined) {
    if (config.episodeId !== undefined) {
      // single
      return loadEpisode(config.channelId, config.episodeId, config);
    }
    // channels
    return loadChannelEpisode(config.channelId, config);
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
      return loadChannelEpisode(ch.channelId, config);
    }),
  );
  const episodes = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat()
    .filter((ep) => ep !== undefined);
  if (config.episodeId !== undefined) {
    const episode = episodes.find((ep) => ep.episodeId === config.episodeId);
    if (episode !== undefined) {
      return new Success({ values: [episode] });
    }
    // XXX: or Success({ values: [] }) ?
    return new Failure(new LoaderError("episode not found"));
  }

  return new Success({ values: episodes });
};

export type {
  EpisodeLoadLocalConfig,
  EpisodeSaveLocalConfig,
  EpisodeSaveOutput,
};
export { load, save };
