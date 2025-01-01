import path from "path";
import fs from "fs/promises";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type { ChannelSlug, Episode, EpisodeSlug } from "../../core/types.mjs";
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
  episodeSlug?: EpisodeSlug;
  channelSlug?: ChannelSlug;
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
  channelSlug: ChannelSlug,
  config: EpisodeLocalConfig,
): string => {
  return path.join(config.baseDir, channelSlug);
};

const episodeFilePath = (
  channelSlug: ChannelSlug,
  episodeSlug: EpisodeSlug,
  config: EpisodeLocalConfig,
): string => {
  return path.join(channelsDir(channelSlug, config), episodeSlug, EPISODE_FILE);
};

// TODO: move somewhere
const sameEpisode = (lhs: Episode, rhs: Episode): boolean => {
  if (lhs.channelSlug !== rhs.channelSlug) {
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
    const filePath = episodeFilePath(episode.channelSlug, episode.slug, config);
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
): Promise<Result<Record<ChannelSlug, Episode[]>, Error>> => {
  const channelSlugs = [
    ...new Set(episodes.map((e) => e.channelSlug)).values(),
  ];
  const inChannelLoading = await Promise.all(
    channelSlugs.map(async (channelSlug) => {
      return {
        channelSlug,
        result: await loadChannelEpisode(channelSlug, config),
      };
    }),
  );

  const episodeMap: Record<ChannelSlug, Episode[]> = {};
  inChannelLoading
    .filter(({ result }) => result.isSuccess()) // TODO: care Failure ?
    .forEach(({ channelSlug, result }) => {
      episodeMap[channelSlug] = result.unwrap().values; // TODO: success なのでちょくで values 取れるはず
    });
  return new Success(episodeMap);
};

const save = async (
  input: SaverInput<Episode, EpisodeLocalConfig>,
): Promise<Result<SaverOutput<Episode, EpisodeSaveOutput>, SaverError>> => {
  const { values: episodes, config } = input;

  let savedEpisodes: Record<ChannelSlug, Episode[]> = {};
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
    const already = savedEpisodes[episode.channelSlug] || [];
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
  channelSlug: ChannelSlug,
  episodeSlug: EpisodeSlug,
  config: EpisodeLocalConfig,
): Promise<Result<LoaderOutput<Episode>, LoaderError>> => {
  logger.debug(
    `loadEpisode called. channelSlug=${channelSlug} episodeSlug=${episodeSlug}`,
  );
  const filePath = episodeFilePath(channelSlug, episodeSlug, config);
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
  channelSlug: ChannelSlug,
  config: EpisodeLocalConfig,
): Promise<Result<LoaderOutput<Episode>, LoaderError>> => {
  logger.debug(`loadChannelEpisode called. channelSlug=${channelSlug}`);
  const dir = channelsDir(channelSlug, config);
  logger.debug(`loadChannelEpisode channelsDir=${dir}`);
  const listing = await listDirs(dir);
  if (listing.isFailure()) {
    return new Failure(listing.error);
  }
  const candidates = listing.value;
  const results = await Promise.all(
    candidates.map(async (ep) => {
      return loadEpisode(channelSlug, ep as EpisodeSlug, config);
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
    `episode load called. baseDir=${config.baseDir} channelSlug=${config.channelSlug} episodeSlug=${config.episodeSlug}`,
  );
  if (config.channelSlug !== undefined) {
    if (config.episodeSlug !== undefined) {
      // single
      return loadEpisode(config.channelSlug, config.episodeSlug, config);
    }
    // channels
    return loadChannelEpisode(config.channelSlug, config);
  }

  // no channelSlug
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
      return loadChannelEpisode(ch.slug, config);
    }),
  );
  const episodes = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat()
    .filter((ep) => ep !== undefined);
  if (config.episodeSlug !== undefined) {
    const episode = episodes.find((ep) => ep.slug === config.episodeSlug);
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
