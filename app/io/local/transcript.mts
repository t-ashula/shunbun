import path from "path";
import fs from "fs/promises";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type {
  EpisodeID,
  EpisodeTranscript,
  ChannelID,
} from "../../core/types.mjs";
import { isEpisodeTranscript } from "../../core/types.mjs";

import { load as loadChannels } from "../../io/local/channel.mjs";
import { getLogger } from "../../core/logger.mjs";
import type {
  LoaderInput,
  LoaderOutput,
  SaverInput,
  SaverOutput,
  SaverResult,
} from "../index.mjs";
import { LoaderError, SaverError } from "../index.mjs";
import { load as loadEpisodes } from "../../io/local/episode.mjs";
import { listDirs } from "../../core/file.mjs";

type TranscriptLoadConfig = {
  channelId?: ChannelID;
  episodeId?: EpisodeID;
};

type TranscriptSaveConfig = {
  update?: boolean;
};

type TranscriptLocalConfig = {
  baseDir: string;
};

type TranscriptLoadLocalConfig = TranscriptLoadConfig &
  TranscriptLocalConfig & {};
type TranscriptSaveLocalConfig = TranscriptSaveConfig &
  TranscriptLocalConfig & {};

type TranscriptSaveOutput = {};

const TRANSCRIPT_FILE = "transcript.json";

const logger = getLogger();

const channelsDir = (
  channelId: ChannelID,
  config: TranscriptLocalConfig,
): string => {
  return path.join(config.baseDir, channelId);
};
const episodeDir = (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: TranscriptLocalConfig,
): string => {
  return path.join(config.baseDir, channelId, episodeId);
};
const transcriptFilePath = (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: TranscriptLocalConfig,
): string => {
  return path.join(episodeDir(channelId, episodeId, config), TRANSCRIPT_FILE);
};

const saveTranscript = async (
  epTranscript: EpisodeTranscript,
  config: TranscriptSaveLocalConfig,
): Promise<SaverResult<TranscriptSaveOutput>> => {
  const episodeId = epTranscript.episodeId;
  const episodeFinding = await loadEpisodes({
    config: { episodeId, baseDir: config.baseDir },
  });
  if (episodeFinding.isFailure()) {
    return new Failure(new SaverError(`no target episode`));
  }
  const [episode] = episodeFinding.value.values;
  const filePath = transcriptFilePath(episode.channelId, episodeId, config);
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(epTranscript, null, 2));
    return new Success({});
  } catch (err) {
    logger.error(
      `save stored episode failed. transcript=${JSON.stringify(epTranscript)} error=${err}`,
    );
    return new Failure(new SaverError("save local failed.", { cause: err }));
  }
};

const save = async (
  input: SaverInput<EpisodeTranscript, TranscriptSaveLocalConfig>,
): Promise<
  Result<SaverOutput<EpisodeTranscript, TranscriptSaveOutput>, SaverError>
> => {
  const { values: epTranscripts, config } = input;

  const saved: EpisodeTranscript[] = [];
  const results: SaverResult<TranscriptSaveOutput>[] = [];
  for (const transcript of epTranscripts) {
    const out = await saveTranscript(transcript, config);
    if (out.isSuccess()) {
      saved.push(transcript);
    }
    results.push(out);
  }
  return new Success({ results, saved });
};

const loadTranscript = async (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: TranscriptLocalConfig,
): Promise<Result<LoaderOutput<EpisodeTranscript>, LoaderError>> => {
  const filePath = transcriptFilePath(channelId, episodeId, config);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    if (isEpisodeTranscript(data)) {
      return new Success({ values: [data] });
    }
    logger.warn(`unknown data found. path=${filePath}`);
    return new Success({ values: [] }); //
  } catch (err) {
    // TODO: check errno?
    logger.error(
      `read transcript json file failed. path=${filePath} error=${err}`,
    );
    return new Failure(
      new LoaderError("load transcript failed", { cause: err }),
    );
  }
};

const loadChannelTranscripts = async (
  channelId: ChannelID,
  config: TranscriptLocalConfig,
): Promise<Result<LoaderOutput<EpisodeTranscript>, LoaderError>> => {
  const dir = channelsDir(channelId, config);
  const listing = await listDirs(dir);
  if (listing.isFailure()) {
    return new Failure(listing.error);
  }
  const candidates = listing.value;
  const results = await Promise.all(
    candidates.map(async (ep) => {
      return loadTranscript(channelId, ep as EpisodeID, config);
    }),
  );
  const episodes = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat();
  return new Success({ values: episodes });
};

const load = async (
  input: LoaderInput<TranscriptLoadLocalConfig>,
): Promise<Result<LoaderOutput<EpisodeTranscript>, LoaderError>> => {
  const { config } = input;
  if (config.channelId !== undefined) {
    if (config.episodeId !== undefined) {
      return loadTranscript(config.channelId, config.episodeId, config);
    }
    return loadChannelTranscripts(config.channelId, config);
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
      return loadChannelTranscripts(ch.channelId, config);
    }),
  );
  const transcripts = results
    .filter((r) => r.isSuccess())
    .map((r) => r.value.values)
    .flat()
    .filter((ep) => ep !== undefined);
  if (config.episodeId !== undefined) {
    const episode = transcripts.find((ep) => ep.episodeId === config.episodeId);
    if (episode !== undefined) {
      return new Success({ values: [episode] });
    }
    // XXX: or Success({ values: [] }) ?
    return new Failure(new LoaderError("episode not found"));
  }

  return new Success({ values: transcripts });
};

export type {
  TranscriptSaveOutput,
  TranscriptLoadLocalConfig,
  TranscriptSaveLocalConfig,
};
export { load, save };
