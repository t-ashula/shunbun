import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { fileTypeFromFile } from "file-type";
import ffmpeg from "fluent-ffmpeg";
import { getLogger } from "../core/logger.mjs";
import { Failure, Success, type Result } from "../core/result.mjs";
import type {
  StoredEpisode,
  TranscriberAPIResponse,
  Transcript,
  EpisodeTranscript,
} from "../core/types.mjs";
import { isTranscriberAPIResponse } from "../core/types.mjs";
import { run as download, stringify } from "../downloader/index.mjs";
import type { DownloaderInput } from "../downloader/index.mjs";
import { listFiles } from "../core/file.mjs";
import { randomUUID } from "node:crypto";

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

const getExtension = async (mediaFilePath: string): Promise<string> => {
  const extByPath = path.extname(mediaFilePath);
  if (extByPath !== "") {
    return extByPath.replace(/^\./, "");
  }
  const extByFile = await fileTypeFromFile(mediaFilePath);
  if (extByFile && extByFile.ext) {
    return extByFile.ext;
  }

  return "wav"; // default fallback is wave
};

const splitMediaFile = async (
  mediaFilePath: string,
  config: { splitSecond: number; workDir: string },
): Promise<Result<string[], Error>> => {
  const ext: string = await getExtension(mediaFilePath);
  try {
    await fs.mkdir(config.workDir);
    await new Promise<void>((resolve, reject) => {
      //     ffmpeg -i "$input_file" -f segment -segment_time "$segment_time" -c copy -reset_timestamps 1 "${output_prefix}_$4%03d.m4a"
      ffmpeg(mediaFilePath)
        .on("error", (err) => {
          logger.error(`ffmpeg throws. error=${err}`);
          reject(err);
        })
        .on("end", () => {
          logger.info(`ffmpeg split done.`);
          resolve();
        })
        .on("stderr", (line) => logger.info(`ffmpeg stderr: ${line}`))
        .on("stdout", (line) => logger.info(`ffmpeg stdout: ${line}`))
        .addOptions([`-loglevel info`])
        .outputOptions([
          `-c copy`,
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
    const splitted = listing.value;
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
  const parsing = await tryParseAPIResponse(response);
  if (parsing.isFailure()) {
    return new Failure(parsing.error);
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
  const workDir = path.resolve(path.join(os.tmpdir(), randomUUID()));
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
    if (fetching.isFailure()) {
      return fetching;
    }
    scripts.push(fetching.value);
  }

  // SPLIT_SECONDS で区切ったファイルの連結なのでタイムスタンプを累積させる
  const merged = scripts.reduce(
    (acc, curr, index) => {
      acc.text += curr.text;
      const offsetSegments = curr.segments.map((seg) => ({
        start: seg.start + index * SPLIT_SECONDS,
        end: seg.end + index * SPLIT_SECONDS,
        text: seg.text,
      }));
      acc.segments.concat(offsetSegments);
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
      episode: storedEpisode.episode,
      transcripts,
    },
  };
  return new Success(output);
};

export type { TranscriberInput, TranscriberOutput };
export { run, TranscriberError };
