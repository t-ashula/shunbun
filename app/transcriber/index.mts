import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { ulid } from "ulid";
import ffmpeg from "fluent-ffmpeg";

import { getLogger } from "../core/logger.mjs";
import { Failure, Success, type Result } from "../core/result.mjs";
import type {
  StoredEpisode,
  TranscriberAPIResponse,
  Transcript,
  EpisodeTranscript,
  TranscriptID,
} from "../core/types.mjs";
import { isTranscriberAPIResponse } from "../core/types.mjs";
import { listFiles } from "../core/file.mjs";
import { run as download, stringify } from "../downloader/index.mjs";
import type { DownloaderInput } from "../downloader/index.mjs";

type TranscriberConfig = {
  apiEndpoint: string;

  // model, temperature, etc
};
type TranscriberInput = {
  storedEpisode: StoredEpisode;
  config: TranscriberConfig;
};
type TranscriberOutput = {
  episodeTranscript: EpisodeTranscript;
};
class TranscriberError extends Error {}

const SPLIT_SECONDS = 30;
const logger = getLogger();

const tryParseAPIResponse = async (
  response: Response,
): Promise<Result<TranscriberAPIResponse, TranscriberError>> => {
  const text = await stringify(response);
  if (!response.ok) {
    logger.error(`api call failed. status=${response.status} message=${text}`);
    return new Failure(
      new TranscriberError(
        `transcriber api call not ok status=${response.status}`,
      ),
    );
  }

  try {
    const data = JSON.parse(text);
    if (isTranscriberAPIResponse(data)) {
      return new Success(data as TranscriberAPIResponse);
    } else {
      return new Failure(new TranscriberError("api response type mismatch"));
    }
  } catch (err) {
    return new Failure(
      new TranscriberError("api response parse failed", { cause: err }),
    );
  }
};

// split すると mp3 のデコードがおかしくなるので wav 固定
const getExtension = async (_mediaFilePath: string): Promise<string> => {
  // const extByPath = path.extname(mediaFilePath);
  // if (extByPath !== "") {
  //   return extByPath.replace(/^\./, "");
  // }
  // const extByFile = await fileTypeFromFile(mediaFilePath);
  // if (extByFile && extByFile.ext) {
  //   return extByFile.ext;
  // }

  return "wav"; // default fallback is wave
};

const splitMediaFile = async (
  mediaFilePath: string,
  config: { splitSecond: number; workDir: string },
): Promise<Result<string[], Error>> => {
  logger.debug(
    `splitMediaFile. path=${mediaFilePath} second=${config.splitSecond} workDir=${config.workDir}`,
  );
  const ext: string = await getExtension(mediaFilePath);
  try {
    await fs.mkdir(config.workDir, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      //     ffmpeg -i "$input_file" -f segment -segment_time "$segment_time" -c copy -reset_timestamps 1 "${output_prefix}_$4%03d.m4a"
      ffmpeg(mediaFilePath)
        .on("error", (err) => {
          logger.error(`ffmpeg throws. error=${err}`);
          reject(err);
        })
        .on("end", () => {
          logger.info(`ffmpeg split done. mediaFilePath=${mediaFilePath}`);
          resolve();
        })
        .on("stderr", (line) => logger.info(`ffmpeg stderr: ${line}`))
        .on("stdout", (line) => logger.info(`ffmpeg stdout: ${line}`))
        .addOptions([`-loglevel error`])
        .outputOptions([
          `-vcodec wav`,
          `-f segment`,
          `-segment_time ${config.splitSecond}`,
          `-reset_timestamps 1`,
        ])
        .output(`${config.workDir}/%03d.${ext}`)
        .run();
    });

    const listing = await listFiles(config.workDir);
    if (listing.isFailure()) {
      return new Failure(listing.error);
    }
    const splitted = listing.value.map((fileName) =>
      path.join(config.workDir, fileName),
    );
    return new Success(splitted); // how to get splitted files name
  } catch (err) {
    return new Failure(new Error("split media failed", { cause: err }));
  }
};

const fetchTranscribeAPI = async (
  mediaFilePath: string,
  config: { apiEndpoint: string },
): Promise<Result<Transcript, Error>> => {
  const buffer = await fs.readFile(mediaFilePath);
  const mediaBlob = new Blob([buffer]);
  const fileName = path.basename(mediaFilePath);
  const formData = new FormData();
  formData.append("media", mediaBlob, fileName);
  formData.append("lang", "ja"); // TODO:
  const di: DownloaderInput = {
    requestUrl: config.apiEndpoint,
    method: "POST",
    body: formData,
  };
  const downloading = await download(di);
  if (downloading.isFailure()) {
    return new Failure(
      new TranscriberError("transcriber api call failed", {
        cause: downloading.error,
      }),
    );
  }

  const response = downloading.value.response;
  logger.info(
    `fetchTranscribeAPI. post to api done. status=${response.status} mediaFilePath=${mediaFilePath}`,
  );
  const parsing = await tryParseAPIResponse(response);
  if (parsing.isFailure()) {
    return new Failure(
      new TranscriberError("transcriber api response is unknown", {
        cause: parsing.error,
      }),
    );
  }

  const apiResponse = parsing.value;
  const transcript = {
    text: apiResponse["text"],
    lang: apiResponse["lang"],
    segments: apiResponse["segments"],
  };
  return new Success(transcript);
};

const transcribeFile = async (
  mediaFilePath: string,
  config: { apiEndpoint: string },
): Promise<Result<Transcript, Error>> => {
  const workDir = path.resolve(path.join(os.tmpdir(), "shunbun", randomUUID()));
  const splitting = await splitMediaFile(mediaFilePath, {
    splitSecond: SPLIT_SECONDS,
    workDir,
  });
  if (splitting.isFailure()) {
    return new Failure(splitting.error);
  }

  // TODO: parallelize api access
  const scripts: Transcript[] = [];
  const splitted = splitting.value;
  for (const partFilePath of splitted) {
    const fetching = await fetchTranscribeAPI(partFilePath, config);
    await fs.unlink(partFilePath);
    if (fetching.isFailure()) {
      await fs.rm(workDir, { recursive: true, force: true });
      return fetching;
    }
    scripts.push(fetching.value);
  }

  await fs.rm(workDir, { recursive: true, force: true });
  // SPLIT_SECONDS で区切ったファイルの連結なのでタイムスタンプを累積させる
  const merged = scripts.reduce(
    (acc, curr, index) => {
      acc.text += curr.text;
      const offsetSegments = curr.segments.map((seg) => ({
        start: seg.start + index * SPLIT_SECONDS,
        end: seg.end + index * SPLIT_SECONDS,
        text: seg.text,
      }));
      acc.segments.push(...offsetSegments);
      return acc;
    },
    { text: "", segments: [], lang: scripts[0].lang },
  );

  return new Success(merged);
};

const run = async (
  input: TranscriberInput,
): Promise<Result<TranscriberOutput, TranscriberError>> => {
  logger.debug(`transcriber.run called. input=${input}`);

  const { storedEpisode, config } = input;
  const { stored } = storedEpisode;

  const transcripts = [];
  for (const media of stored) {
    const filePath = media.storedKey; // TODO: check storeType
    const transcribing = await transcribeFile(filePath, config);
    if (transcribing.isFailure()) {
      return new Failure(
        new TranscriberError("transcribe file failed", {
          cause: transcribing.error,
        }),
      );
    } else {
      transcripts.push(transcribing.value);
    }
  }
  const output = {
    episodeTranscript: {
      id: ulid() as TranscriptID,
      episodeId: storedEpisode.episodeId,
      transcripts,
      transcribedAt: new Date(),
    },
  };
  return new Success(output);
};

export type { TranscriberInput, TranscriberOutput };
export { run, TranscriberError };
