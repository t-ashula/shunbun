import path from "path";
import fs from "fs/promises";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type {
  ChannelSlug,
  EpisodeSlug,
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
import { load as loadChannels } from "../../io/local/channel.mjs";
import { load as loadEpisodes } from "../../io/local/episode.mjs";
import { listDirs } from "../../core/file.mjs";

type StoredLoadConfig = {
  episodeSlug?: EpisodeSlug;
  channelSlug?: ChannelSlug;
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
  channelSlug: ChannelSlug,
  config: StoredLocalConfig,
): string => {
  return path.join(config.baseDir, channelSlug);
};

const episodeDir = (
  channelSlug: ChannelSlug,
  episodeSlug: EpisodeSlug,
  config: StoredLocalConfig,
): string => {
  return path.join(config.baseDir, channelSlug, episodeSlug);
};

const storedFilePath = (
  channelSlug: ChannelSlug,
  episodeSlug: EpisodeSlug,
  config: StoredLocalConfig,
): string => {
  return path.join(episodeDir(channelSlug, episodeSlug, config), STORED_FILE);
};

const saveStored = async (
  stored: StoredEpisode,
  config: StoredSaveLocalConfig,
): Promise<SaverResult<StoredSaveOutput>> => {
  const episodeSlug = stored.episodeSlug;
  const episodeFinding = await loadEpisodes({
    config: { episodeSlug, baseDir: config.baseDir },
  });
  if (episodeFinding.isFailure()) {
    // TODO:
    return new Failure(new SaverError(`no target episode`));
  }
  const [episode] = episodeFinding.value.values;
  const filePath = storedFilePath(episode.channelSlug, episodeSlug, config);

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
  channelSlug: ChannelSlug,
  episodeSlug: EpisodeSlug,
  config: StoredLocalConfig,
): Promise<Result<LoaderOutput<StoredEpisode>, LoaderError>> => {
  const filePath = storedFilePath(channelSlug, episodeSlug, config);
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
  channelSlug: ChannelSlug,
  config: StoredLocalConfig,
): Promise<Result<LoaderOutput<StoredEpisode>, LoaderError>> => {
  const dir = channelsDir(channelSlug, config);
  const listing = await listDirs(dir);
  if (listing.isFailure()) {
    return new Failure(listing.error);
  }
  const candidates = listing.value;
  const results = await Promise.all(
    candidates.map(async (ep) => {
      return loadStoredEpisode(channelSlug, ep as EpisodeSlug, config);
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

  if (config.channelSlug !== undefined) {
    if (config.episodeSlug !== undefined) {
      return loadStoredEpisode(config.channelSlug, config.episodeSlug, config);
    }
    return loadChannelStoredEpisode(config.channelSlug, config);
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
      return loadChannelStoredEpisode(ch.slug, config);
    }),
  );
  const stored = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat()
    .filter((ep) => ep !== undefined);
  if (config.episodeSlug !== undefined) {
    const episode = stored.find((s) => s.episodeSlug === config.episodeSlug);
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
