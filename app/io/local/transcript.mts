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

import { getLogger } from "../../core/logger.mjs";
import type {
  LoaderInput,
  LoaderOutput,
  SaverInput,
  SaverOutput,
  SaverResult,
} from "../index.mjs";
import { LoaderError, SaverError } from "../index.mjs";

type TranscriptLoadConfig = {
  channelId: ChannelID;
  episodeId: EpisodeID;
};

type TranscriptSaveConfig = {
  update?: boolean;
};

type TranscriptSaveOutput = {};

type TranscriptLocalConfig = {
  baseDir: string;
};

type TranscriptLoadLocalConfig = TranscriptLoadConfig &
  TranscriptLocalConfig & {};
type TranscriptSaveLocalConfig = TranscriptSaveConfig &
  TranscriptLocalConfig & {};

const TRANSCRIPT_FILE = "transcript.json";

const logger = getLogger();

const episodeDir = (
  channelId: ChannelID,
  episodeId: EpisodeID,
  config: TranscriptLocalConfig,
): string => {
  return path.join(config.baseDir, channelId, episodeId);
};

const saveTranscript = async (
  epTranscript: EpisodeTranscript,
  config: TranscriptSaveLocalConfig,
): Promise<SaverResult<TranscriptSaveOutput>> => {
  const episode = epTranscript.episode;
  const dir = episodeDir(episode.channelId, episode.id, config);
  const filePath = path.join(dir, TRANSCRIPT_FILE);
  try {
    await fs.mkdir(dir, { recursive: true });
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

const load = async (
  input: LoaderInput<TranscriptLoadLocalConfig>,
): Promise<Result<LoaderOutput<EpisodeTranscript>, LoaderError>> => {
  const { config } = input;
  const dir = episodeDir(config.channelId, config.episodeId, config);
  const filePath = path.join(dir, TRANSCRIPT_FILE);
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    if (isEpisodeTranscript(data)) {
      return new Success({ values: [data] });
    }
  } catch (err) {
    return new Failure(
      new LoaderError("load episode transcript failed", { cause: err }),
    );
  }
  return new Failure(new LoaderError("load episode transcript failed"));
};

export type {
  TranscriptSaveOutput,
  TranscriptLoadLocalConfig,
  TranscriptSaveLocalConfig,
};
export { load, save };
